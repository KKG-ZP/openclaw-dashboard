const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const DataCollector = require('./data-collector');
const AlertManager = require('./modules/alert-manager');
const ExportUtils = require('./modules/export-utils');
const Benchmark = require('./modules/benchmark');
const LogAnalyzer = require('./modules/log-analyzer');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const fsPromises = require('fs').promises;
const osUtils = require('node-os-utils');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const sockets = new Set();

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

const PORT = process.env.PORT || 44132;
const HOST = process.env.HOST || '127.0.0.1';
const collector = new DataCollector();
const alertManager = new AlertManager();
const benchmark = new Benchmark();
const logAnalyzer = new LogAnalyzer();
const endpointCache = new Map();
const ENDPOINT_CACHE_MAX_ENTRIES = Math.max(parseInt(process.env.ENDPOINT_CACHE_MAX_ENTRIES || '200', 10) || 200, 50);
const ENDPOINT_CACHE_SWEEP_MS = Math.max(parseInt(process.env.ENDPOINT_CACHE_SWEEP_MS || '60000', 10) || 60000, 10000);
const WARMUP_BASE_MS = Math.max(parseInt(process.env.WARMUP_BASE_MS || '30000', 10) || 30000, 5000);
const WARMUP_MAX_MS = Math.max(parseInt(process.env.WARMUP_MAX_MS || '120000', 10) || 120000, WARMUP_BASE_MS);
const MEMORY_SOFT_LIMIT_MB = Math.max(parseInt(process.env.MEMORY_SOFT_LIMIT_MB || '512', 10) || 512, 128);
const MEMORY_GUARD_INTERVAL_MS = Math.max(parseInt(process.env.MEMORY_GUARD_INTERVAL_MS || '30000', 10) || 30000, 10000);
const MEMORY_GUARD_COOLDOWN_MS = Math.max(parseInt(process.env.MEMORY_GUARD_COOLDOWN_MS || '180000', 10) || 180000, 30000);
let lastHttpRequestAt = Date.now();
let endpointCacheGcInterval = null;
let warmCacheTimer = null;
let memoryGuardInterval = null;
let warmupCurrentIntervalMs = WARMUP_BASE_MS;
let warmupStableRounds = 0;
let warmupLastFingerprint = null;
let lastMemoryGuardAt = 0;

function makeCacheKey(prefix, params = {}) {
  const normalized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return normalized ? `${prefix}?${normalized}` : prefix;
}

function setEndpointCacheValue(key, value, ttlMs) {
  endpointCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    lastAccessAt: Date.now()
  });
}

function sweepEndpointCache({ aggressive = false } = {}) {
  const now = Date.now();
  for (const [key, entry] of endpointCache.entries()) {
    if (!entry) {
      endpointCache.delete(key);
      continue;
    }
    if ((entry.expiresAt || 0) <= now) {
      endpointCache.delete(key);
    }
  }

  if (aggressive) {
    // 软限触发时，尽量释放更多引用，避免长时间积累
    const keep = Math.floor(ENDPOINT_CACHE_MAX_ENTRIES * 0.35);
    if (endpointCache.size > keep) {
      const sorted = [...endpointCache.entries()].sort((a, b) => (a[1].lastAccessAt || 0) - (b[1].lastAccessAt || 0));
      for (let i = 0; i < sorted.length - keep; i++) endpointCache.delete(sorted[i][0]);
    }
  }

  if (endpointCache.size > ENDPOINT_CACHE_MAX_ENTRIES) {
    const overflow = endpointCache.size - ENDPOINT_CACHE_MAX_ENTRIES;
    const sorted = [...endpointCache.entries()].sort((a, b) => (a[1].lastAccessAt || 0) - (b[1].lastAccessAt || 0));
    for (let i = 0; i < overflow; i++) endpointCache.delete(sorted[i][0]);
  }
}

async function getOrSetEndpointCache(key, ttlMs, producer) {
  const now = Date.now();
  const cached = endpointCache.get(key);
  if (cached) {
    if (cached.value !== undefined && cached.expiresAt > now) {
      cached.lastAccessAt = now;
      return cached.value;
    }
    if (cached.promise) {
      cached.lastAccessAt = now;
      return cached.promise;
    }
    endpointCache.delete(key);
  }

  const promise = Promise.resolve()
    .then(producer)
    .then((value) => {
      setEndpointCacheValue(key, value, ttlMs);
      if (endpointCache.size > ENDPOINT_CACHE_MAX_ENTRIES) sweepEndpointCache();
      return value;
    })
    .catch((error) => {
      endpointCache.delete(key);
      throw error;
    });

  endpointCache.set(key, { promise, expiresAt: now + ttlMs, lastAccessAt: now });
  if (endpointCache.size > ENDPOINT_CACHE_MAX_ENTRIES * 1.2) sweepEndpointCache();
  return promise;
}

async function withTimeout(task, timeoutMs, label) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 超时（>${timeoutMs}ms）`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 确保路径正确 - 使用绝对路径
const staticDir = path.resolve(__dirname, 'static');
const distDir = path.resolve(__dirname, 'dist');
const isProduction = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));
console.log('静态文件目录:', staticDir);
console.log('Vite 构建目录:', distDir, '(生产模式:', isProduction, ')');
console.log('__dirname:', __dirname);
console.log('静态目录存在:', fs.existsSync(staticDir));
console.log('CSS文件存在:', fs.existsSync(path.join(staticDir, 'css', 'style.css')));

// 中间件
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  lastHttpRequestAt = Date.now();
  next();
});

// 多工具统一入口路由
const toolboxStaticDir = process.env.TOOLBOX_STATIC_DIR || path.join(require('os').homedir(), 'toolbox-static', 'toolbox');
console.log('工具箱静态目录:', toolboxStaticDir, '存在:', fs.existsSync(toolboxStaticDir));

// toolbox-auth 反向代理
app.use('/toolbox/auth', createProxyMiddleware({
  target: 'http://127.0.0.1:44131',
  changeOrigin: false,
  proxyTimeout: 10000,
  timeout: 10000,
  on: {
    proxyReq: fixRequestBody,
  },
}));

// 文渊文件台反向代理（/wenyuan -> 45133）
app.use('/wenyuan', createProxyMiddleware({
  target: 'http://127.0.0.1:45133',
  changeOrigin: false,
  proxyTimeout: 15000,
  timeout: 15000,
  on: {
    proxyReq: fixRequestBody,
  },
  pathRewrite: (pathReq) => {
    const rewritten = pathReq.replace(/^\/wenyuan/, '');
    return rewritten || '/';
  },
}));

// 基金系统反向代理（/fund -> 44130）
app.use('/fund', createProxyMiddleware({
  target: 'http://127.0.0.1:44130',
  changeOrigin: false,
  proxyTimeout: 15000,
  timeout: 15000,
  on: {
    proxyReq: fixRequestBody,
  },
  pathRewrite: (pathReq) => {
    const rewritten = pathReq.replace(/^\/fund/, '');
    return rewritten || '/';
  },
}));

// 兼容旧入口：/toolbox/dashboard/api/* -> /api/*
app.use('/toolbox/dashboard/api', (req, res) => {
  const suffix = req.originalUrl.replace(/^\/toolbox\/dashboard\/api/, '') || '/';
  const normalized = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return res.redirect(302, `/api${normalized === '/' ? '' : normalized}`);
});

// 兼容旧入口：/toolbox/dashboard/* -> /dashboard/*
app.use('/toolbox/dashboard', (req, res) => {
  const suffix = req.originalUrl.replace(/^\/toolbox\/dashboard/, '') || '/';
  const normalized = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return res.redirect(302, `/dashboard${normalized === '/' ? '/' : normalized}`);
});

// 工具箱静态页（登录页/卡片页）
app.use('/toolbox', express.static(toolboxStaticDir, { index: ['index.html'] }));

// 静态文件服务 - 必须在所有API路由之前
// 调试：记录静态文件请求（必须在静态文件服务之前）
app.use('/static', (req, res, next) => {
  // Express的express.static会自动去掉URL前缀/static
  // 所以请求/static/css/style.css时，req.path会是/css/style.css
  // 但我们需要检查的是staticDir + req.path
  const relativePath = req.path.startsWith('/') ? req.path.substring(1) : req.path;
  const filePath = path.join(staticDir, relativePath);
  console.log(`[静态文件请求] ${req.method} ${req.url}`);
  console.log(`  req.path: ${req.path}`);
  console.log(`  relativePath: ${relativePath}`);
  console.log(`  映射到文件: ${filePath}`);
  console.log(`  文件存在: ${fs.existsSync(filePath)}`);
  next();
});

// Express静态文件中间件
// 注意：express.static会自动去掉URL前缀，所以/static/css/style.css会映射到staticDir/css/style.css
app.use('/static', express.static(staticDir));

// 生产模式：Vite 构建产物（JS/CSS bundles）
if (isProduction) {
  app.use('/assets', express.static(path.join(distDir, 'assets')));
}

// WebSocket客户端管理
const clients = new Set();
let isShuttingDown = false;
const SHUTDOWN_GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS || '8000', 10);

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket客户端已连接，当前连接数:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket客户端已断开，当前连接数:', clients.size);
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 广播数据到所有WebSocket客户端
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function normalizeMessageStreamLimit(rawLimit) {
  const parsed = Math.min(parseInt(rawLimit, 10) || 100, 100);
  if (parsed <= 20) return 20;
  if (parsed <= 50) return 50;
  return 100;
}

function hasRuntimeActivity() {
  return clients.size > 0 || (Date.now() - lastHttpRequestAt) < 60000;
}

function buildWarmupFingerprint(snapshot, modelUsage30, modelUsageAll) {
  const s = snapshot && snapshot.health ? snapshot.health : {};
  const usage30Summary = modelUsage30 && modelUsage30.summary ? modelUsage30.summary : {};
  const usageAllSummary = modelUsageAll && modelUsageAll.summary ? modelUsageAll.summary : {};
  return [
    snapshot?.timestamp || '',
    s.score || 0,
    s.status || '',
    usage30Summary.totalCalls || 0,
    usage30Summary.totalTokens || 0,
    usageAllSummary.totalCalls || 0,
    usageAllSummary.totalTokens || 0
  ].join('|');
}

function startEndpointCacheSweeper() {
  if (endpointCacheGcInterval) clearInterval(endpointCacheGcInterval);
  endpointCacheGcInterval = setInterval(() => {
    try {
      sweepEndpointCache();
    } catch (error) {
      console.error('清理 endpointCache 失败:', error);
    }
  }, ENDPOINT_CACHE_SWEEP_MS);
}

async function runWarmCacheOnce() {
  const [snapshot, modelUsage30, modelUsageAll] = await Promise.all([
    withTimeout(() => collector.getDashboardSnapshot(true), 12000, '预热 dashboard 快照'),
    withTimeout(() => collector.getModelUsageStats(30), 12000, '预热模型使用量(30天)'),
    withTimeout(() => collector.getModelUsageStats(null), 12000, '预热模型使用量(全量)')
  ]);

  // 预热到 endpoint cache，首个请求可直接命中
  setEndpointCacheValue(makeCacheKey('api/models/usage', { days: 30 }), modelUsage30, 60000);
  setEndpointCacheValue(makeCacheKey('api/models/usage', { days: 'all' }), modelUsageAll, 60000);
  setEndpointCacheValue('api/dashboard', {
    ...snapshot,
    alerts: alertManager.getActiveAlerts(),
    timestamp: new Date().toISOString()
  }, 15000);

  return buildWarmupFingerprint(snapshot, modelUsage30, modelUsageAll);
}

function startWarmCacheLoop() {
  if (warmCacheTimer) clearTimeout(warmCacheTimer);
  const scheduleNext = () => {
    warmCacheTimer = setTimeout(async () => {
      try {
        const fingerprint = await runWarmCacheOnce();
        const changed = fingerprint !== warmupLastFingerprint;
        warmupLastFingerprint = fingerprint;

        if (changed || hasRuntimeActivity()) {
          warmupStableRounds = 0;
          warmupCurrentIntervalMs = WARMUP_BASE_MS;
        } else {
          warmupStableRounds += 1;
          if (warmupStableRounds >= 2) {
            warmupCurrentIntervalMs = Math.min(WARMUP_MAX_MS, warmupCurrentIntervalMs * 2);
            warmupStableRounds = 0;
          }
        }
      } catch (error) {
        console.error('后台预热失败:', error.message || error);
        warmupCurrentIntervalMs = Math.min(WARMUP_MAX_MS, Math.max(WARMUP_BASE_MS, warmupCurrentIntervalMs));
      } finally {
        scheduleNext();
      }
    }, warmupCurrentIntervalMs);
  };

  // 首次启动后尽快预热，再进入动态周期
  warmupCurrentIntervalMs = 1000;
  scheduleNext();
}

function startMemoryGuardLoop() {
  if (memoryGuardInterval) clearInterval(memoryGuardInterval);
  memoryGuardInterval = setInterval(() => {
    try {
      const now = Date.now();
      if (now - lastMemoryGuardAt < MEMORY_GUARD_COOLDOWN_MS) return;
      const usage = process.memoryUsage();
      const rssMb = Math.round(usage.rss / 1024 / 1024);

      if (rssMb < MEMORY_SOFT_LIMIT_MB) return;

      console.warn(`[内存守护] RSS=${rssMb}MB 超过软限 ${MEMORY_SOFT_LIMIT_MB}MB，执行缓存清理`);
      sweepEndpointCache({ aggressive: true });
      collector.clearCache();
      if (typeof global.gc === 'function') {
        global.gc();
      }
      lastMemoryGuardAt = now;
    } catch (error) {
      console.error('内存守护执行失败:', error);
    }
  }, MEMORY_GUARD_INTERVAL_MS);
}

// 定期推送更新数据
let updateInterval;
function startPeriodicUpdates() {
  updateInterval = setInterval(async () => {
    if (isShuttingDown) return;

    try {
      const snapshot = await collector.getDashboardSnapshot();
      const { system, agents, tasks, channels, health, logs: recentLogs } = snapshot;

      // 检查告警
      const gatewayInfo = await collector.getProcessInfo('openclaw-gateway');
      const cpu = gatewayInfo ? parseFloat(gatewayInfo.cpu.replace('%', '')) : 0;
      const memoryKB = gatewayInfo ? parseInt(gatewayInfo.memory.replace(' KB', '')) : 0;
      const memoryMB = memoryKB / 1024;
      
      // 获取系统内存信息
      let memoryPercent = 0;
      try {
        const memInfo = await osUtils.mem.info();
        memoryPercent = 100 - (memInfo.freeMemPercentage || 0);
      } catch (memError) {
        // 如果获取内存信息失败，使用进程内存作为备选
        memoryPercent = memoryMB > 0 ? (memoryMB / 1024) * 10 : 0;
      }

      // 获取错误率（从共享快照中）
      const errorCount = recentLogs.filter(log => log.level === 'error').length;
      const errorRate = recentLogs.length > 0 ? (errorCount / recentLogs.length) * 100 : 0;

      const metrics = {
        cpu,
        memory: memoryPercent,
        healthScore: health.score,
        errorRate
      };

      const alertResult = await alertManager.checkAlerts(metrics);

      // 如果有新告警，通过WebSocket推送
      if (alertResult.new.length > 0) {
        broadcast({
          type: 'alert',
          timestamp: new Date().toISOString(),
          data: {
            alerts: alertResult.new,
            active: alertResult.active
          }
        });
      }

      const data = {
        type: 'update',
        timestamp: new Date().toISOString(),
        data: { system, agents, tasks, channels, health, alerts: alertResult.active }
      };
      broadcast(data);
    } catch (error) {
      console.error('推送更新数据失败:', error);
    }
  }, 5000); // 每5秒更新一次
}

// 定期记录历史数据
let historyRecordInterval;
function startHistoryRecording() {
  historyRecordInterval = setInterval(async () => {
    try {
      // 并行记录所有历史数据
      await Promise.all([
        collector.recordMetricsHistory(),
        collector.recordChannelStats(),
        collector.recordTaskStats(),
        collector.recordModelUsage(),
        collector.recordHealthHistory()
      ]);
    } catch (error) {
      console.error('记录历史数据失败:', error);
    }
  }, 5000); // 每5秒记录一次
}

// 监控配置文件变化
const configWatcher = chokidar.watch(path.join(require('os').homedir(), '.openclaw', 'openclaw.json'));
configWatcher.on('change', () => {
  console.log('配置文件已更改，清除缓存');
  collector.clearCache();
  // 立即推送更新
  setTimeout(async () => {
    if (isShuttingDown) return;

    try {
      const snapshot = await collector.getDashboardSnapshot(true);
      const data = {
        type: 'config-changed',
        timestamp: new Date().toISOString(),
        data: {
          system: snapshot.system,
          agents: snapshot.agents,
          channels: snapshot.channels
        }
      };
      broadcast(data);
    } catch (error) {
      console.error('推送配置更新失败:', error);
    }
  }, 500);
});

// API路由

// 系统概览
app.get('/api/system/overview', async (req, res) => {
  try {
    const data = await collector.getSystemOverview();
    res.json(data);
  } catch (error) {
    console.error('获取系统概览失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// Agent列表
app.get('/api/agents/list', async (req, res) => {
  try {
    const data = await collector.getAgentsList();
    res.json(data);
  } catch (error) {
    console.error('获取Agent列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// Agent状态
app.get('/api/agents/:id/status', async (req, res) => {
  try {
    const agentId = req.params.id;
    const os = require('os');
    const path = require('path');
    const agentDir = path.join(os.homedir(), '.openclaw', 'agents', agentId);
    const status = await collector.getAgentStatus(agentId, agentDir);
    res.json({ id: agentId, ...status });
  } catch (error) {
    console.error('获取Agent状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 当前任务
app.get('/api/tasks/current', async (req, res) => {
  try {
    const tasks = await collector.getTasks();
    res.json(tasks.current);
  } catch (error) {
    console.error('获取当前任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 任务历史
app.get('/api/tasks/history', async (req, res) => {
  try {
    const tasks = await collector.getTasks();
    res.json(tasks.history);
  } catch (error) {
    console.error('获取任务历史失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 通道状态
app.get('/api/channels/status', async (req, res) => {
  try {
    const data = await collector.getChannelsStatus();
    res.json(data);
  } catch (error) {
    console.error('获取通道状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 模型配额（已下线，保持兼容）
app.get('/api/models/quota', async (req, res) => {
  res.json([]);
});

// 最近日志
app.get('/api/logs/recent', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    const data = await collector.getRecentLogs(count);
    res.json(data);
  } catch (error) {
    console.error('获取最近日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 系统健康度
app.get('/api/health', async (req, res) => {
  try {
    const snapshot = await collector.getDashboardSnapshot();
    const data = snapshot.health;
    res.json(data);
  } catch (error) {
    console.error('获取系统健康度失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 历史数据API端点 ==========

// 性能指标历史
app.get('/api/metrics/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const data = await collector.getMetricsHistory(hours);
    res.json(data);
  } catch (error) {
    console.error('获取性能指标历史失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 消息统计
app.get('/api/channels/stats', async (req, res) => {
  try {
    const range = req.query.range || 'today'; // today/week/month
    const data = await collector.getChannelsStats(range);
    res.json(data);
  } catch (error) {
    console.error('获取消息统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 任务执行时间分布
app.get('/api/tasks/stats', async (req, res) => {
  try {
    const data = await collector.getTasksStats();
    res.json(data);
  } catch (error) {
    console.error('获取任务统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 模型使用统计
app.get('/api/models/stats', async (req, res) => {
  try {
    const data = await collector.getModelsStats();
    res.json(data);
  } catch (error) {
    console.error('获取模型使用统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 模型使用量统计（四维度：按模型、按Agent、按天、总计）
app.get('/api/models/usage', async (req, res) => {
  try {
    const rawDays = req.query.days;
    const days = rawDays === undefined || rawDays === '' ? null : parseInt(rawDays, 10);
    const cacheKey = makeCacheKey('api/models/usage', { days: days ?? 'all' });
    const data = await getOrSetEndpointCache(cacheKey, 60000, () =>
      withTimeout(() => collector.getModelUsageStats(days), 12000, '模型使用量统计')
    );
    res.json(data);
  } catch (error) {
    console.error('获取模型使用量统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 技能使用统计（Skill-first执行情况）
app.get('/api/skills/usage', async (req, res) => {
  try {
    const rawDays = req.query.days;
    const days = rawDays === undefined || rawDays === '' ? null : parseInt(rawDays, 10);
    const data = await collector.getSkillUsageStats(days);
    res.json(data);
  } catch (error) {
    console.error('获取技能使用统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康度历史
app.get('/api/health/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const data = await collector.getHealthHistory(hours);
    res.json(data);
  } catch (error) {
    console.error('获取健康度历史失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 阶段3：快捷操作和详情页面 API ==========

// Agent详情
app.get('/api/agents/:id/details', async (req, res) => {
  try {
    const agentId = req.params.id;
    const details = await collector.getAgentDetails(agentId);
    res.json(details);
  } catch (error) {
    console.error('获取Agent详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 会话详情
app.get('/api/agents/:agentId/sessions/:sessionId', async (req, res) => {
  try {
    const { agentId, sessionId } = req.params;
    const details = await collector.getSessionDetails(agentId, sessionId);
    res.json(details);
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 任务详情
app.get('/api/tasks/:id/details', async (req, res) => {
  try {
    const taskId = req.params.id;
    const details = await collector.getTaskDetails(taskId);
    res.json(details);
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 快捷操作：重启Gateway
app.post('/api/actions/restart-gateway', async (req, res) => {
  try {
    // 查找Gateway进程
    const { stdout } = await execAsync('ps aux | grep "openclaw-gateway" | grep -v grep');
    if (!stdout.trim()) {
      return res.status(404).json({ error: 'Gateway进程未运行' });
    }

    // 获取PID
    const pid = stdout.trim().split(/\s+/)[1];
    
    // 重启Gateway（先kill再启动）
    await execAsync(`kill ${pid}`);
    
    // 等待进程完全关闭
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 启动Gateway（假设有启动脚本）
    const os = require('os');
    const gatewayScript = path.join(os.homedir(), '.openclaw', 'scripts', 'start-gateway.sh');
    try {
      await execAsync(`bash ${gatewayScript}`, { detached: true });
    } catch (e) {
      // 如果脚本不存在，尝试直接启动
      console.log('未找到启动脚本，请手动启动Gateway');
    }

    res.json({ 
      success: true, 
      message: 'Gateway重启命令已执行',
      pid: pid 
    });
  } catch (error) {
    console.error('重启Gateway失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 快捷操作：清理日志
app.post('/api/actions/clear-logs', async (req, res) => {
  try {
    const os = require('os');
    const logsDir = path.join(os.homedir(), '.openclaw', 'logs');
    
    // 读取日志目录
    const files = await fsPromises.readdir(logsDir).catch(() => []);
    
    // 清理所有日志文件（可选：只清理旧日志）
    let clearedCount = 0;
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        // 清空文件而不是删除
        await fsPromises.writeFile(filePath, '').catch(() => {});
        clearedCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `已清理 ${clearedCount} 个日志文件` 
    });
  } catch (error) {
    console.error('清理日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 快捷操作：重新加载配置
app.post('/api/actions/reload-config', async (req, res) => {
  try {
    collector.clearCache();
    // 触发配置重新加载
    const config = await collector.getConfig();
    
    res.json({ 
      success: true, 
      message: '配置已重新加载',
      configLoaded: config !== null
    });
  } catch (error) {
    console.error('重新加载配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 阶段4：实时监控和告警系统 API ==========

// 获取系统资源详情
app.get('/api/system/resources', async (req, res) => {
  try {
    const data = await getOrSetEndpointCache('api/system/resources', 15000, async () => {
      const cpu = osUtils.cpu;
      const mem = osUtils.mem;
      const drive = osUtils.drive;
      const netstat = osUtils.netstat;

      const [cpuUsage, memInfo, driveInfo, netInfo] = await withTimeout(() => Promise.all([
        cpu.usage().catch(() => 0),
        mem.info().catch(() => ({ totalMemMb: 0, usedMemMb: 0, freeMemMb: 0 })),
        drive.info().catch(() => ({ totalGb: 0, usedGb: 0, freeGb: 0 })),
        netstat.inOut().catch(() => ({ total: { inputMb: 0, outputMb: 0 } }))
      ]), 8000, '系统资源采集');

      const gatewayInfo = await collector.getProcessInfo('openclaw-gateway');
      const gatewayCpu = gatewayInfo ? parseFloat(gatewayInfo.cpu.replace('%', '')) : 0;
      const gatewayMemoryKB = gatewayInfo ? parseInt(gatewayInfo.memory.replace(' KB', '')) : 0;
      const gatewayMemoryMB = gatewayMemoryKB / 1024;

      return {
        timestamp: new Date().toISOString(),
        system: {
          cpu: {
            usage: cpuUsage,
            cores: osUtils.cpu.count()
          },
          memory: {
            total: memInfo.totalMemMb,
            used: memInfo.usedMemMb,
            free: memInfo.freeMemMb,
            percent: memInfo.totalMemMb > 0 
              ? (memInfo.usedMemMb / memInfo.totalMemMb) * 100 
              : 0
          },
          disk: {
            total: driveInfo.totalGb,
            used: driveInfo.usedGb,
            free: driveInfo.freeGb,
            percent: driveInfo.totalGb > 0 
              ? (driveInfo.usedGb / driveInfo.totalGb) * 100 
              : 0
          },
          network: {
            input: netInfo.total.inputMb,
            output: netInfo.total.outputMb
          }
        },
        gateway: {
          cpu: gatewayCpu,
          memory: gatewayMemoryMB
        }
      };
    });

    res.json(data);
  } catch (error) {
    console.error('获取系统资源详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取告警规则
app.get('/api/alerts/rules', async (req, res) => {
  try {
    const rules = alertManager.getRules();
    res.json(rules);
  } catch (error) {
    console.error('获取告警规则失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 设置告警规则
app.post('/api/alerts/rules', async (req, res) => {
  try {
    const rules = req.body;
    await alertManager.setRules(rules);
    res.json({ success: true, message: '告警规则已更新' });
  } catch (error) {
    console.error('设置告警规则失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取告警历史
app.get('/api/alerts/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = alertManager.getHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('获取告警历史失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取活跃告警
app.get('/api/alerts/active', async (req, res) => {
  try {
    const active = alertManager.getActiveAlerts();
    res.json(active);
  } catch (error) {
    console.error('获取活跃告警失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 模型配额详细监控（已下线，保持兼容）
app.get('/api/models/quota/detailed', async (req, res) => {
  res.json({
    models: [],
    summary: {
      totalModels: 0,
      totalUsage: 0
    }
  });
});

// ========== 阶段5：数据导出和历史对比 API ==========

// 导出JSON格式
app.get('/api/export/json', async (req, res) => {
  try {
    const [system, agents, tasks, channels, logs, health] = await Promise.all([
      collector.getSystemOverview(),
      collector.getAgentsList(),
      collector.getTasks(),
      collector.getChannelsStatus(),
      collector.getRecentLogs(1000),
      collector.getHealthStatus()
    ]);

    const data = {
      timestamp: new Date().toISOString(),
      system,
      agents,
      tasks,
      channels,
      logs,
      health
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="openclaw-export-${Date.now()}.json"`);
    res.send(ExportUtils.exportJSON(data));
  } catch (error) {
    console.error('导出JSON失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 导出CSV格式
app.get('/api/export/csv', async (req, res) => {
  try {
    const type = req.query.type || 'all'; // all, agents, tasks, logs
    
    if (type === 'agents') {
      const agents = await collector.getAgentsList();
      const csv = await ExportUtils.exportAgentsCSV(agents);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agents-${Date.now()}.csv"`);
      res.send(csv);
    } else if (type === 'tasks') {
      const tasks = await collector.getTasks();
      const csv = await ExportUtils.exportTasksCSV(tasks);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.csv"`);
      res.send(csv);
    } else if (type === 'logs') {
      const logs = await collector.getRecentLogs(1000);
      const csv = await ExportUtils.exportLogsCSV(logs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // 导出所有数据
      const [agents, tasks, logs] = await Promise.all([
        collector.getAgentsList(),
        collector.getTasks(),
        collector.getRecentLogs(1000)
      ]);
      
      // 合并所有CSV数据
      const agentsCSV = await ExportUtils.exportAgentsCSV(agents);
      const tasksCSV = await ExportUtils.exportTasksCSV(tasks);
      const logsCSV = await ExportUtils.exportLogsCSV(logs);
      
      const combinedCSV = `=== Agents ===\n${agentsCSV}\n\n=== Tasks ===\n${tasksCSV}\n\n=== Logs ===\n${logsCSV}`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="openclaw-all-${Date.now()}.csv"`);
      res.send(combinedCSV);
    }
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 生成HTML报告
app.get('/api/export/report', async (req, res) => {
  try {
    const [system, agents, tasks, channels, logs, health] = await Promise.all([
      collector.getSystemOverview(),
      collector.getAgentsList(),
      collector.getTasks(),
      collector.getChannelsStatus(),
      collector.getRecentLogs(100),
      collector.getHealthStatus()
    ]);

    const data = {
      timestamp: new Date().toISOString(),
      system,
      agents,
      tasks,
      channels,
      logs: logs.slice(0, 100),
      health
    };

    const html = ExportUtils.generateHTMLReport(data);
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="openclaw-report-${Date.now()}.html"`);
    res.send(html);
  } catch (error) {
    console.error('生成HTML报告失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 历史数据对比
app.get('/api/compare', async (req, res) => {
  try {
    const start = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end) : new Date();
    
    // 获取两个时间点的数据
    const [metricsHistory, healthHistory] = await Promise.all([
      collector.getMetricsHistory(24),
      collector.getHealthHistory(24)
    ]);

    // 过滤指定时间范围的数据
    const startTime = start.getTime();
    const endTime = end.getTime();
    
    const filteredMetrics = {
      labels: [],
      cpu: [],
      memory: []
    };
    
    const filteredHealth = {
      labels: [],
      scores: [],
      statuses: []
    };

    // 这里简化处理，实际应该从历史数据文件中读取
    // 由于历史数据是按时间戳存储的，需要解析时间戳进行过滤
    
    res.json({
      start: start.toISOString(),
      end: end.toISOString(),
      metrics: filteredMetrics,
      health: filteredHealth,
      comparison: {
        avgCpu: 0,
        avgMemory: 0,
        avgHealth: 0
      }
    });
  } catch (error) {
    console.error('获取历史对比失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 统计数据
app.get('/api/statistics', async (req, res) => {
  try {
    const range = req.query.range || 'today'; // today, week, month
    
    const [agents, tasks, channels, logs, health] = await Promise.all([
      collector.getAgentsList(),
      collector.getTasks(),
      collector.getChannelsStatus(),
      collector.getRecentLogs(1000),
      collector.getHealthStatus()
    ]);

    const now = new Date();
    let startTime;
    
    if (range === 'today') {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'week') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 过滤时间范围内的数据
    const filteredTasks = {
      current: tasks.current.filter(t => new Date(t.lastUpdate) >= startTime),
      history: tasks.history.filter(t => new Date(t.lastUpdate) >= startTime)
    };

    const filteredLogs = logs.filter(log => new Date(log.timestamp) >= startTime);
    const errorLogs = filteredLogs.filter(log => log.level === 'error');
    const warnLogs = filteredLogs.filter(log => log.level === 'warn');

    const stats = {
      range,
      period: {
        start: startTime.toISOString(),
        end: now.toISOString()
      },
      agents: {
        total: agents.length,
        active: agents.filter(a => a.status === 'active').length,
        idle: agents.filter(a => a.status === 'idle').length
      },
      tasks: {
        current: filteredTasks.current.length,
        completed: filteredTasks.history.length,
        total: filteredTasks.current.length + filteredTasks.history.length
      },
      messages: {
        total: channels.reduce((sum, c) => sum + (c.messageCount || 0), 0)
      },
      logs: {
        total: filteredLogs.length,
        errors: errorLogs.length,
        warnings: warnLogs.length,
        info: filteredLogs.length - errorLogs.length - warnLogs.length
      },
      health: {
        current: health.score,
        status: health.status
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 阶段6：消息流监控和性能基准测试 API ==========

// 获取消息流
app.get('/api/messages/stream', async (req, res) => {
  try {
    const limit = normalizeMessageStreamLimit(req.query.limit);
    const agentId = req.query.agentId;
    const taskId = req.query.taskId;
    const compact = req.query.compact !== '0';
    const maxContentLength = compact ? 240 : 1000;

    // 如果指定了taskId，只返回该任务的消息
    if (taskId) {
      const taskDetails = await withTimeout(() => collector.getTaskDetails(taskId), 10000, '任务消息流');
      const taskMessages = (taskDetails.messages || []).slice(-limit).map((msg) => ({
        ...msg,
        content: typeof msg.content === 'string' && msg.content.length > maxContentLength
          ? `${msg.content.slice(0, maxContentLength)}…`
          : msg.content
      }));
      return res.json({
        messages: taskMessages,
        total: taskDetails.messageCount || 0,
        limit,
        compact
      });
    }

    const cacheKey = makeCacheKey('api/messages/stream', { limit, agentId: agentId || 'all', compact: compact ? 1 : 0 });
    const data = await getOrSetEndpointCache(cacheKey, 30000, async () => {
      const agents = await collector.getAgentsList();
      const messages = [];

      const targetAgents = agentId
        ? agents.filter(a => a.id === agentId)
        : agents;

      for (const agent of targetAgents.slice(0, 8)) {
        const agentDir = path.join(require('os').homedir(), '.openclaw', 'agents', agent.id, 'sessions');
        try {
          const files = await fsPromises.readdir(agentDir).catch(() => []);
          const sessionFiles = files
            .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted.'))
            .slice(0, 3); // 每个Agent最多3个会话，避免侧栏扫描过重

          for (const file of sessionFiles) {
            const filePath = path.join(agentDir, file);
            const content = await fsPromises.readFile(filePath, 'utf-8').catch(() => '');
            const lines = content.trim().split('\n').filter(l => l);
            const recentLines = lines.slice(-12); // 只看最近消息，避免把整段会话全塞进侧栏

            for (const line of recentLines) {
              try {
                const message = JSON.parse(line);
                const rawContent = message.content || message.text || message.message?.content || '';
                const normalizedContent = typeof rawContent === 'string'
                  ? rawContent
                  : Array.isArray(rawContent)
                    ? rawContent.map(part => part?.text || '').join('\n')
                    : '';

                messages.push({
                  role: message.role || message.message?.role || 'unknown',
                  content: normalizedContent.length > maxContentLength
                    ? `${normalizedContent.slice(0, maxContentLength)}…`
                    : normalizedContent,
                  agentId: agent.id,
                  agentName: agent.name,
                  taskId: file.replace('.jsonl', ''),
                  timestamp: message.timestamp || new Date().toISOString()
                });
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        } catch (error) {
          // 忽略Agent错误
        }
      }

      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        messages: messages.slice(-limit),
        total: messages.length,
        limit,
        compact
      };
    });

    res.json(data);
  } catch (error) {
    console.error('获取消息流失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 开始性能基准测试
app.post('/api/benchmark/start', async (req, res) => {
  try {
    if (benchmark.isRunning) {
      return res.status(400).json({ error: '基准测试已在运行中' });
    }

    // 异步执行测试
    benchmark.start().catch(error => {
      console.error('基准测试执行失败:', error);
    });

    res.json({ 
      success: true, 
      message: '基准测试已开始',
      status: benchmark.getStatus()
    });
  } catch (error) {
    console.error('启动基准测试失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取基准测试状态
app.get('/api/benchmark/status', async (req, res) => {
  try {
    const status = benchmark.getStatus();
    res.json(status);
  } catch (error) {
    console.error('获取基准测试状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取基准测试结果
app.get('/api/benchmark/results', async (req, res) => {
  try {
    const results = benchmark.getResults();
    if (!results) {
      return res.status(404).json({ error: '暂无测试结果' });
    }
    res.json(results);
  } catch (error) {
    console.error('获取基准测试结果失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 阶段7：实用工具 API ==========

// 获取配置
app.get('/api/config', async (req, res) => {
  try {
    const config = await collector.getConfig();
    if (!config) {
      return res.status(404).json({ error: '配置文件不存在' });
    }
    res.json(config);
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新配置
app.put('/api/config', async (req, res) => {
  try {
    const config = req.body;
    const CONFIG_FILE = path.join(require('os').homedir(), '.openclaw', 'openclaw.json');
    
    // 验证配置格式
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: '无效的配置格式' });
    }

    // 备份原配置
    const backupFile = `${CONFIG_FILE}.backup.${Date.now()}`;
    try {
      const currentConfig = await fsPromises.readFile(CONFIG_FILE, 'utf-8');
      await fsPromises.writeFile(backupFile, currentConfig, 'utf-8');
    } catch (e) {
      // 备份失败不影响更新
    }

    // 写入新配置
    await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    
    // 清除缓存
    collector.clearCache();

    res.json({ 
      success: true, 
      message: '配置已更新',
      backup: backupFile
    });
  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 验证配置
app.post('/api/config/validate', async (req, res) => {
  try {
    const config = req.body;
    const errors = [];

    // 基本验证
    if (!config) {
      errors.push('配置为空');
    } else {
      if (!config.gateway) errors.push('缺少gateway配置');
      if (!config.agents) errors.push('缺少agents配置');
      if (!config.channels) errors.push('缺少channels配置');
    }

    res.json({
      valid: errors.length === 0,
      errors
    });
  } catch (error) {
    console.error('验证配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 备份配置
app.get('/api/config/backup', async (req, res) => {
  try {
    const CONFIG_FILE = path.join(require('os').homedir(), '.openclaw', 'openclaw.json');
    const backupFile = `${CONFIG_FILE}.backup.${Date.now()}`;
    
    const config = await fsPromises.readFile(CONFIG_FILE, 'utf-8');
    await fsPromises.writeFile(backupFile, config, 'utf-8');

    res.json({
      success: true,
      message: '配置已备份',
      backupFile
    });
  } catch (error) {
    console.error('备份配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 分析日志
app.get('/api/logs/analyze', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const level = req.query.level || 'all';
    const keyword = req.query.keyword || '';

    const analysis = await logAnalyzer.analyzeLogs({ hours, level, keyword });
    res.json(analysis);
  } catch (error) {
    console.error('分析日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取错误统计
app.get('/api/logs/errors/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await logAnalyzer.getErrorStats(hours);
    res.json(stats);
  } catch (error) {
    console.error('获取错误统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取错误模式
app.get('/api/logs/patterns', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const patterns = await logAnalyzer.getErrorPatterns(hours);
    res.json(patterns);
  } catch (error) {
    console.error('获取错误模式失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 快捷操作：导出报告（保持向后兼容）
app.get('/api/actions/export-report', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    
    if (format === 'html') {
      return res.redirect(`/api/export/report`);
    } else if (format === 'csv') {
      return res.redirect(`/api/export/csv?type=all`);
    } else {
      return res.redirect(`/api/export/json`);
    }
  } catch (error) {
    console.error('导出报告失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 调试端点：检查静态文件路径
app.get('/api/debug/static-path', (req, res) => {
  const fs = require('fs');
  res.json({
    __dirname: __dirname,
    staticDir: staticDir,
    staticDirExists: fs.existsSync(staticDir),
    cssPath: path.join(staticDir, 'css', 'style.css'),
    cssExists: fs.existsSync(path.join(staticDir, 'css', 'style.css')),
    jsPath: path.join(staticDir, 'js', 'dashboard.js'),
    jsExists: fs.existsSync(path.join(staticDir, 'js', 'dashboard.js'))
  });
});

// 运行时状态（后台预热与内存守护）
app.get('/api/runtime/status', (req, res) => {
  const usage = process.memoryUsage();
  res.json({
    timestamp: new Date().toISOString(),
    memory: {
      rssMb: Math.round(usage.rss / 1024 / 1024),
      heapUsedMb: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(usage.heapTotal / 1024 / 1024),
      externalMb: Math.round(usage.external / 1024 / 1024),
      softLimitMb: MEMORY_SOFT_LIMIT_MB
    },
    cache: {
      endpointEntries: endpointCache.size,
      endpointMaxEntries: ENDPOINT_CACHE_MAX_ENTRIES
    },
    warmup: {
      enabled: true,
      intervalMs: warmupCurrentIntervalMs,
      baseIntervalMs: WARMUP_BASE_MS,
      maxIntervalMs: WARMUP_MAX_MS,
      stableRounds: warmupStableRounds,
      hasFingerprint: Boolean(warmupLastFingerprint),
      active: hasRuntimeActivity()
    },
    guards: {
      endpointSweepMs: ENDPOINT_CACHE_SWEEP_MS,
      memoryGuardMs: MEMORY_GUARD_INTERVAL_MS,
      memoryGuardCooldownMs: MEMORY_GUARD_COOLDOWN_MS,
      lastMemoryGuardAt: lastMemoryGuardAt ? new Date(lastMemoryGuardAt).toISOString() : null
    }
  });
});

// 完整数据（用于初始化）
app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await getOrSetEndpointCache('api/dashboard', 15000, async () => {
      // 并行获取所有数据以提高性能
      const [system, agents, tasks, channels, logs, health] = await Promise.all([
        collector.getSystemOverview(),
        collector.getAgentsList(),
        collector.getTasks(),
        collector.getChannelsStatus(),
        collector.getRecentLogs(50),
        collector.getHealthStatus()
      ]);

      // 获取活跃告警
      const activeAlerts = alertManager.getActiveAlerts();
      return {
        system,
        agents,
        tasks,
        channels,
        logs,
        health,
        alerts: activeAlerts,
        timestamp: new Date().toISOString()
      };
    });
    res.json(data);
  } catch (error) {
    console.error('获取完整数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

function sendDashboardPage(req, res) {
  // 生产模式：优先从 dist/ 目录提供 Vite 构建产物
  if (isProduction) {
    const htmlPath = path.join(distDir, 'index.html');
    return res.sendFile(htmlPath, (err) => {
      if (err) {
        console.error('发送Dashboard页面失败(dist):', err);
        // 回退到原始 index.html
        const fallback = path.join(__dirname, 'index.html');
        res.sendFile(fallback);
      }
    });
  }
  const layout = req.query.layout || 'default';
  const htmlFile = layout === 'sidebar' ? 'index-sidebar.html' : 'index.html';
  const htmlPath = path.join(__dirname, htmlFile);
  res.sendFile(htmlPath, (err) => {
    if (err) {
      console.error('发送Dashboard页面失败:', err);
      res.status(500).send(`
        <h1>无法加载页面</h1>
        <p>错误: ${err.message}</p>
        <p>文件路径: ${htmlPath}</p>
      `);
    }
  });
}

// 新入口：域名根路径是登录页
app.get('/', (req, res) => {
  const loginPath = path.join(toolboxStaticDir, 'login.html');
  res.sendFile(loginPath, (err) => {
    if (err) {
      console.error('发送登录页失败:', err);
      res.status(500).send('无法加载登录页');
    }
  });
});

// 作战中心固定入口
app.get('/dashboard', sendDashboardPage);
app.get('/dashboard/', sendDashboardPage);

// 启动服务器
server.listen(PORT, HOST, () => {
  console.log(`\n🎩 OpenClaw作战指挥中心看板服务器`);
  console.log(`   访问地址: http://${HOST}:${PORT}`);
  console.log(`   静态文件: ${path.join(__dirname, 'static')}`);
  console.log(`   配置文件: ${path.join(require('os').homedir(), '.openclaw', 'openclaw.json')}\n`);
  startPeriodicUpdates();
  startHistoryRecording();
  startEndpointCacheSweeper();
  startWarmCacheLoop();
  startMemoryGuardLoop();
});

function shutdown(signal) {
  console.log(`收到${signal}信号，正在关闭服务器...`);
  isShuttingDown = true;
  if (updateInterval) clearInterval(updateInterval);
  if (historyRecordInterval) clearInterval(historyRecordInterval);
  if (endpointCacheGcInterval) clearInterval(endpointCacheGcInterval);
  if (warmCacheTimer) clearTimeout(warmCacheTimer);
  if (memoryGuardInterval) clearInterval(memoryGuardInterval);
  sweepEndpointCache({ aggressive: true });
  collector.clearCache();
  configWatcher.close();
  for (const ws of clients) {
    try {
      ws.close(1001, 'server shutdown');
    } catch (error) {
      // ignore
    }
  }
  for (const socket of sockets) {
    try {
      socket.destroy();
    } catch (error) {
      // ignore
    }
  }
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
}

// 优雅关闭
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
