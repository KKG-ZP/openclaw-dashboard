/**
 * OpenClaw 作战指挥中心 - 优化版后端服务器
 * 
 * 优化内容：
 * 1. 新增摘要接口 (/api/dashboard/summary) - 只返回首屏必要数据
 * 2. 新增增量接口 (/api/dashboard/delta) - 支持 since/cursor 增量更新
 * 3. 新增分页接口 - Agent/任务/日志支持分页
 * 4. 接口响应压缩优化
 * 5. ETag 缓存支持
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
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
const zlib = require('zlib');
const { promisify: utilPromisify } = require('util');
const gzip = utilPromisify(zlib.gzip);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const sockets = new Set();

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const collector = new DataCollector();
const alertManager = new AlertManager();
const benchmark = new Benchmark();
const logAnalyzer = new LogAnalyzer();

// 静态文件目录
const staticDir = path.resolve(__dirname, 'static');
const toolboxStaticDir = process.env.TOOLBOX_STATIC_DIR || path.join(require('os').homedir(), 'toolbox-static', 'toolbox');

// 增量更新状态追踪
const deltaState = new Map(); // clientId -> { lastTimestamp, cursor }

// 中间件
app.use(cors());
app.use(express.json());

// 响应压缩中间件
const compressionMiddleware = async (req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;
  
  res.json = function(data) {
    const json = JSON.stringify(data);
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    if (acceptEncoding.includes('gzip') && json.length > 1024) {
      gzip(Buffer.from(json), (err, compressed) => {
        if (!err) {
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Type', 'application/json');
          originalSend.call(res, compressed);
        } else {
          originalJson.call(res, data);
        }
      });
    } else {
      originalJson.call(res, data);
    }
  };
  
  next();
};

app.use(compressionMiddleware);

// ETag 生成函数
function generateETag(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

// ETag 中间件
function etagMiddleware(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(data) {
    const etag = generateETag(data);
    const ifNoneMatch = req.headers['if-none-match'];
    
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }
    
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, must-revalidate');
    originalJson.call(res, data);
  };
  
  next();
}

// ========== 反向代理配置 ==========
app.use('/toolbox/auth', createProxyMiddleware({
  target: 'http://127.0.0.1:44131',
  changeOrigin: false,
  proxyTimeout: 10000,
  timeout: 10000,
  on: { proxyReq: fixRequestBody }
}));

app.use('/wenyuan', createProxyMiddleware({
  target: 'http://127.0.0.1:45133',
  changeOrigin: false,
  proxyTimeout: 15000,
  timeout: 15000,
  on: { proxyReq: fixRequestBody },
  pathRewrite: (pathReq) => pathReq.replace(/^\/wenyuan/, '') || '/'
}));

app.use('/fund', createProxyMiddleware({
  target: 'http://127.0.0.1:44130',
  changeOrigin: false,
  proxyTimeout: 15000,
  timeout: 15000,
  on: { proxyReq: fixRequestBody },
  pathRewrite: (pathReq) => pathReq.replace(/^\/fund/, '') || '/'
}));

// 兼容旧入口
app.use('/toolbox/dashboard', (req, res) => {
  const suffix = req.originalUrl.replace(/^\/toolbox\/dashboard/, '') || '/';
  const normalized = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return res.redirect(302, `/dashboard${normalized === '/' ? '/' : normalized}`);
});

app.use('/toolbox', express.static(toolboxStaticDir, { index: ['index.html'] }));
app.use('/static', express.static(staticDir));

// ========== WebSocket 管理 ==========
const clients = new Set();
let isShuttingDown = false;
const SHUTDOWN_GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS || '8000', 10);

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket客户端已连接，当前连接数:', clients.size);
  
  // 发送客户端ID用于增量更新
  const clientId = crypto.randomUUID();
  ws.clientId = clientId;
  deltaState.set(clientId, { lastTimestamp: Date.now(), cursor: null });
  
  ws.send(JSON.stringify({ type: 'connected', clientId }));

  ws.on('close', () => {
    clients.delete(ws);
    if (ws.clientId) {
      deltaState.delete(ws.clientId);
    }
    console.log('WebSocket客户端已断开，当前连接数:', clients.size);
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

function broadcast(data, options = {}) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // 如果指定了clientId，只发送给该客户端
      if (options.clientId && client.clientId !== options.clientId) {
        return;
      }
      client.send(message);
    }
  });
}

// ========== Task H: 摘要接口 ==========

/**
 * GET /api/dashboard/summary
 * 返回首屏所需的最小数据集，大幅减少首屏数据传输量
 */
app.get('/api/dashboard/summary', etagMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 并行获取摘要数据
    const [system, agentsSummary, tasksSummary, health] = await Promise.all([
      collector.getSystemOverview(),
      getAgentsSummary(),
      getTasksSummary(),
      collector.getHealthStatus()
    ]);

    const summary = {
      system: {
        hostname: system.hostname,
        gateway: {
          status: system.gateway.status,
          cpu: system.gateway.cpu,
          memory: system.gateway.memory,
          uptime: system.gateway.uptime
        }
      },
      agents: agentsSummary,
      tasks: tasksSummary,
      health: {
        score: health.score,
        status: health.status,
        issueCount: health.issues ? health.issues.length : 0
      },
      timestamp: new Date().toISOString(),
      _meta: {
        version: '2.0',
        isSummary: true,
        responseTime: Date.now() - startTime
      }
    };

    res.json(summary);
  } catch (error) {
    console.error('获取摘要数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取 Agent 摘要（只返回关键字段，限制数量）
async function getAgentsSummary() {
  const agents = await collector.getAgentsList();
  return {
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    idle: agents.filter(a => a.status === 'idle').length,
    list: agents.slice(0, 10).map(a => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      status: a.status,
      sessionCount: a.sessionCount,
      role: a.role
    }))
  };
}

// 获取任务摘要
async function getTasksSummary() {
  const tasks = await collector.getTasks();
  return {
    currentCount: tasks.current.length,
    historyCount: tasks.history.length,
    recent: tasks.current.slice(0, 5).map(t => ({
      id: t.id,
      agentName: t.agentName,
      title: t.title,
      status: t.status
    }))
  };
}

// ========== Task H: 增量接口 ==========

/**
 * GET /api/dashboard/delta
 * 支持增量更新，只返回自上次请求以来的变化数据
 * 
 * Query 参数:
 * - since: 时间戳 (ISO 8601)，返回该时间之后的变化
 * - cursor: 游标，用于分页
 * - clientId: 客户端标识，用于服务端追踪状态
 */
app.get('/api/dashboard/delta', async (req, res) => {
  try {
    const { since, cursor, clientId } = req.query;
    const startTime = Date.now();
    
    // 解析 since 时间戳
    const sinceTime = since ? new Date(since).getTime() : Date.now() - 60000; // 默认1分钟前
    const now = Date.now();
    
    // 获取变化的数据
    const delta = await getDeltaData(sinceTime, cursor);
    
    // 更新客户端状态
    if (clientId) {
      deltaState.set(clientId, {
        lastTimestamp: now,
        cursor: delta.nextCursor
      });
    }

    res.json({
      ...delta,
      _meta: {
        since: new Date(sinceTime).toISOString(),
        serverTime: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        hasMore: !!delta.nextCursor
      }
    });
  } catch (error) {
    console.error('获取增量数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取变化数据
async function getDeltaData(sinceTime, cursor) {
  const changes = {
    agents: { updated: [], removed: [] },
    tasks: { updated: [], removed: [] },
    logs: { added: [] },
    system: null
  };
  
  // 获取最新数据
  const [agents, tasks, logs, system] = await Promise.all([
    collector.getAgentsList(),
    collector.getTasks(),
    collector.getRecentLogs(20),
    collector.getSystemOverview()
  ]);
  
  // 筛选变化的 Agent（基于 lastActivity）
  agents.forEach(agent => {
    if (agent.lastActivity) {
      const activityTime = new Date(agent.lastActivity).getTime();
      if (activityTime > sinceTime) {
        changes.agents.updated.push({
          id: agent.id,
          status: agent.status,
          sessionCount: agent.sessionCount,
          lastActivity: agent.lastActivity
        });
      }
    }
  });
  
  // 筛选变化的 Task
  const allTasks = [...tasks.current, ...tasks.history];
  allTasks.forEach(task => {
    const updateTime = new Date(task.lastUpdate).getTime();
    if (updateTime > sinceTime) {
      changes.tasks.updated.push({
        id: task.id,
        status: task.status,
        lastUpdate: task.lastUpdate,
        messageCount: task.messageCount
      });
    }
  });
  
  // 新日志（基于时间戳）
  changes.logs.added = logs.filter(log => {
    const logTime = new Date(log.timestamp).getTime();
    return logTime > sinceTime;
  });
  
  // 系统状态（总是返回最新）
  changes.system = {
    gateway: {
      status: system.gateway.status,
      cpu: system.gateway.cpu,
      memory: system.gateway.memory
    }
  };
  
  return {
    changes,
    nextCursor: changes.logs.added.length >= 20 ? `cursor_${Date.now()}` : null
  };
}

// ========== Task H: 分页接口 ==========

/**
 * GET /api/agents/list-paginated
 * 分页获取 Agent 列表
 * 
 * Query 参数:
 * - page: 页码 (默认 1)
 * - limit: 每页数量 (默认 10, 最大 50)
 * - status: 状态筛选 (all/active/idle)
 */
app.get('/api/agents/list-paginated', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const statusFilter = req.query.status || 'all';
    
    let agents = await collector.getAgentsList();
    
    // 状态筛选
    if (statusFilter !== 'all') {
      agents = agents.filter(a => a.status === statusFilter);
    }
    
    const total = agents.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedAgents = agents.slice(start, start + limit);
    
    res.json({
      data: paginatedAgents,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('获取分页Agent列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tasks/list-paginated
 * 分页获取任务列表
 * 
 * Query 参数:
 * - page: 页码 (默认 1)
 * - limit: 每页数量 (默认 10, 最大 50)
 * - type: 任务类型 (current/history/all)
 * - agentId: 按 Agent 筛选
 */
app.get('/api/tasks/list-paginated', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const type = req.query.type || 'all';
    const agentId = req.query.agentId;
    
    const tasks = await collector.getTasks();
    let allTasks = [];
    
    if (type === 'current') {
      allTasks = tasks.current;
    } else if (type === 'history') {
      allTasks = tasks.history;
    } else {
      allTasks = [...tasks.current, ...tasks.history];
    }
    
    // Agent 筛选
    if (agentId) {
      allTasks = allTasks.filter(t => t.agentId === agentId);
    }
    
    const total = allTasks.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedTasks = allTasks.slice(start, start + limit);
    
    res.json({
      data: paginatedTasks,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('获取分页任务列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/logs/paginated
 * 分页获取日志（支持游标）
 * 
 * Query 参数:
 * - cursor: 游标（用于分页）
 * - limit: 每页数量 (默认 50, 最大 200)
 * - level: 日志级别筛选 (error/warn/info/all)
 * - startTime: 开始时间 (ISO 8601)
 * - endTime: 结束时间 (ISO 8601)
 */
app.get('/api/logs/paginated', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const cursor = req.query.cursor;
    const levelFilter = req.query.level || 'all';
    const startTime = req.query.startTime ? new Date(req.query.startTime) : null;
    const endTime = req.query.endTime ? new Date(req.query.endTime) : null;
    
    // 获取日志
    let logs = await collector.getRecentLogs(limit * 2); // 多取一些用于筛选
    
    // 级别筛选
    if (levelFilter !== 'all') {
      logs = logs.filter(l => l.level === levelFilter);
    }
    
    // 时间范围筛选
    if (startTime || endTime) {
      logs = logs.filter(l => {
        const logTime = new Date(l.timestamp);
        if (startTime && logTime < startTime) return false;
        if (endTime && logTime > endTime) return false;
        return true;
      });
    }
    
    // 游标分页
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = logs.findIndex(l => l.timestamp === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const paginatedLogs = logs.slice(startIndex, startIndex + limit);
    const nextCursor = paginatedLogs.length === limit 
      ? paginatedLogs[paginatedLogs.length - 1].timestamp 
      : null;
    
    res.json({
      data: paginatedLogs,
      pagination: {
        limit,
        nextCursor,
        hasMore: !!nextCursor,
        total: logs.length
      }
    });
  } catch (error) {
    console.error('获取分页日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 原有 API 路由（保持兼容） ==========

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

// 模型配额
app.get('/api/models/quota', async (req, res) => {
  try {
    const data = await collector.getModelsQuota();
    res.json(data);
  } catch (error) {
    console.error('获取模型配额失败:', error);
    res.status(500).json({ error: error.message });
  }
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
    const data = await collector.getHealthStatus();
    res.json(data);
  } catch (error) {
    console.error('获取系统健康度失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 历史数据API
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

app.get('/api/models/usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await collector.getModelUsageStats(days);
    res.json(data);
  } catch (error) {
    console.error('获取模型使用量统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// 完整数据（用于初始化）
app.get('/api/dashboard', async (req, res) => {
  try {
    const [system, agents, tasks, channels, models, logs, health] = await Promise.all([
      collector.getSystemOverview(),
      collector.getAgentsList(),
      collector.getTasks(),
      collector.getChannelsStatus(),
      collector.getModelsQuota(),
      collector.getRecentLogs(50),
      collector.getHealthStatus()
    ]);

    const activeAlerts = alertManager.getActiveAlerts();

    const data = {
      system,
      agents,
      tasks,
      channels,
      models,
      logs,
      health,
      alerts: activeAlerts,
      timestamp: new Date().toISOString()
    };
    res.json(data);
  } catch (error) {
    console.error('获取完整数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 定期推送更新 ==========
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
      
      let memoryPercent = 0;
      try {
        const memInfo = await osUtils.mem.info();
        memoryPercent = 100 - (memInfo.freeMemPercentage || 0);
      } catch (memError) {
        memoryPercent = memoryMB > 0 ? (memoryMB / 1024) * 10 : 0;
      }

      const errorCount = recentLogs.filter(log => log.level === 'error').length;
      const errorRate = recentLogs.length > 0 ? (errorCount / recentLogs.length) * 100 : 0;

      const metrics = { cpu, memory: memoryPercent, healthScore: health.score, errorRate };
      const alertResult = await alertManager.checkAlerts(metrics);

      // 发送增量更新而非全量
      const deltaPayload = {
        type: 'delta',
        timestamp: new Date().toISOString(),
        data: {
          system: { gateway: system.gateway },
          agents: agents.slice(0, 5).map(a => ({ id: a.id, status: a.status, sessionCount: a.sessionCount })),
          health: { score: health.score, status: health.status },
          alerts: alertResult.active
        }
      };
      
      broadcast(deltaPayload);
    } catch (error) {
      console.error('推送更新数据失败:', error);
    }
  }, 5000);
}

// 定期记录历史数据
let historyRecordInterval;
function startHistoryRecording() {
  historyRecordInterval = setInterval(async () => {
    try {
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
  }, 5000);
}

// 监控配置文件变化
const configWatcher = chokidar.watch(path.join(require('os').homedir(), '.openclaw', 'openclaw.json'));
configWatcher.on('change', () => {
  console.log('配置文件已更改，清除缓存');
  collector.clearCache();
  setTimeout(async () => {
    if (isShuttingDown) return;
    try {
      const snapshot = await collector.getDashboardSnapshot(true);
      broadcast({
        type: 'config-changed',
        timestamp: new Date().toISOString(),
        data: { system: snapshot.system, agents: snapshot.agents, channels: snapshot.channels }
      });
    } catch (error) {
      console.error('推送配置更新失败:', error);
    }
  }, 500);
});

// 页面路由
function sendDashboardPage(req, res) {
  const layout = req.query.layout || 'default';
  const htmlFile = layout === 'sidebar' ? 'index-sidebar.html' : 'index.html';
  const htmlPath = path.join(__dirname, htmlFile);
  res.sendFile(htmlPath, (err) => {
    if (err) {
      console.error('发送Dashboard页面失败:', err);
      res.status(500).send(`<h1>无法加载页面</h1><p>错误: ${err.message}</p>`);
    }
  });
}

app.get('/', (req, res) => {
  const loginPath = path.join(toolboxStaticDir, 'login.html');
  res.sendFile(loginPath, (err) => {
    if (err) {
      console.error('发送登录页失败:', err);
      res.status(500).send('无法加载登录页');
    }
  });
});

app.get('/dashboard', sendDashboardPage);
app.get('/dashboard/', sendDashboardPage);

// 启动服务器
server.listen(PORT, HOST, () => {
  console.log(`\n🎩 OpenClaw作战指挥中心看板服务器 (优化版)`);
  console.log(`   访问地址: http://${HOST}:${PORT}`);
  console.log(`   新增接口:`);
  console.log(`     - GET /api/dashboard/summary      (摘要接口)`);
  console.log(`     - GET /api/dashboard/delta        (增量接口)`);
  console.log(`     - GET /api/agents/list-paginated  (分页Agent)`);
  console.log(`     - GET /api/tasks/list-paginated   (分页任务)`);
  console.log(`     - GET /api/logs/paginated         (分页日志)`);
  console.log(`\n`);
  startPeriodicUpdates();
  startHistoryRecording();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  if (updateInterval) clearInterval(updateInterval);
  if (historyRecordInterval) clearInterval(historyRecordInterval);
  configWatcher.close();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  if (updateInterval) clearInterval(updateInterval);
  if (historyRecordInterval) clearInterval(historyRecordInterval);
  configWatcher.close();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
