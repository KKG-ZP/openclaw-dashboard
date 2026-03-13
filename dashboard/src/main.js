/**
 * OpenClaw Dashboard — 主入口
 * Vite ES module 架构，按优先级加载面板
 */

// === Core ===
import { bus } from './core/event-bus.js';
import { Disposable } from './core/disposable.js';
import { WebSocketManager } from './core/websocket.js';
import { fetchJson, postAction } from './core/api-client.js';

// === Utils ===
import { escapeHtml } from './utils/html-escape.js';
import { formatRelativeTime, formatTokens } from './utils/time-format.js';

// === Components ===
import { NotificationCenter } from './components/notifications.js';
import { AgentTopology } from './panels/agent-topology.js';

// === Charts (lazy — not needed for first paint) ===
let chartsManager = null;

// === CSS ===
import '../static/css/style.css';
import '../static/css/layout-improvements.css';
import '../static/css/right-sidebar.css';
import './styles/skeleton.css';

// ============================================================
// Dashboard — 主控制器
// ============================================================
class Dashboard extends Disposable {
  constructor() {
    super();
    this.ws = new WebSocketManager();
    this.data = {};
    this.autoScroll = true;
    this.panelRefreshState = { modelUsage: 0, skillUsage: 0, resources: 0, alerts: 0, statistics: 0, messages: 0 };
    this.modelTokenDimension = 'total';
    this._layoutTimeouts = [];
    this.topology = new AgentTopology();
    this._modelUsageRequestSeq = 0;
    this._modelUsageDataCache = new Map();
    this._modelUsageInFlight = new Map();

    // Wire up event bus
    bus.on('ws:message', msg => this._handleWsMessage(msg));
    bus.on('ws:status', status => this._updateConnectionStatus(status));
    bus.on('request:refresh', () => this.loadInitialData());
  }

  async init() {
    this.ws.connect();
    this._setupEventListeners();
    await this.loadInitialData();
    this._startClock();
    this._startPolling();

    // Lazy-load charts after first paint
    requestIdleCallback(async () => {
      const mod = await import('./charts/charts-manager.js');
      chartsManager = new mod.ChartsManager();
      chartsManager.init();
    });
  }

  // --- WebSocket ---
  _handleWsMessage(message) {
    if (message.type === 'update' && message.data) {
      this.data = { ...this.data, ...message.data };
      this.updateAllPanels();
    } else if (message.type === 'config-changed') {
      this.loadInitialData();
    } else if (message.type === 'alert' && message.data) {
      if (window._notificationCenter && message.data.alerts) {
        message.data.alerts.forEach(alert => {
          window._notificationCenter.addNotification({
            title: `告警: ${alert.ruleName}`,
            message: alert.message,
            type: alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'
          });
        });
      }
    }
  }

  _updateConnectionStatus(status) {
    const indicator = document.getElementById('connectionStatus');
    if (!indicator) return;
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('span:last-child');
    if (!dot || !text) return;
    dot.className = 'status-dot';
    if (status === 'connected') { dot.classList.add('connected'); text.textContent = '已连接'; }
    else if (status === 'disconnected') { dot.classList.add('disconnected'); text.textContent = '已断开'; }
    else if (status === 'error') { dot.classList.add('disconnected'); text.textContent = '连接错误'; }
    else { text.textContent = '连接中...'; }
  }

  // --- Event Listeners ---
  _setupEventListeners() {
    const clearLogsBtn = document.getElementById('clearLogs');
    if (clearLogsBtn) this.addListener(clearLogsBtn, 'click', () => {
      const lc = document.getElementById('logContainer');
      if (lc) lc.innerHTML = '';
    });

    const toggleBtn = document.getElementById('toggleAutoScroll');
    if (toggleBtn) this.addListener(toggleBtn, 'click', (e) => {
      this.autoScroll = !this.autoScroll;
      e.target.textContent = `自动滚动: ${this.autoScroll ? 'ON' : 'OFF'}`;
    });

    this._setupQuickActions();

    // Agent view toggle
    const agentsHeader = document.querySelector('[data-card-id="agents"] .card-actions');
    if (agentsHeader) {
      const toggle = document.createElement('div');
      toggle.className = 'topo-view-toggle';
      toggle.innerHTML = `
        <button class="topo-view-btn active" data-view="list">列表</button>
        <button class="topo-view-btn" data-view="topology">拓扑</button>
      `;
      agentsHeader.appendChild(toggle);
      this.addListener(toggle, 'click', (e) => {
        const btn = e.target.closest('.topo-view-btn');
        if (!btn) return;
        toggle.querySelectorAll('.topo-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.topology.setViewMode(btn.dataset.view);
        this.updateAgentsList();
      });
    }
  }

  _setupQuickActions() {
    const restartBtn = document.getElementById('restartGateway');
    if (restartBtn) this.addListener(restartBtn, 'click', async () => {
      if (!confirm('确定要重启Gateway吗？')) return;
      await this._executeAction('restart-gateway', '重启Gateway');
    });
    const clearLogsActionBtn = document.getElementById('clearLogsAction');
    if (clearLogsActionBtn) this.addListener(clearLogsActionBtn, 'click', async () => {
      if (!confirm('确定要清理所有日志文件吗？')) return;
      await this._executeAction('clear-logs', '清理日志');
    });
    const reloadConfigBtn = document.getElementById('reloadConfig');
    if (reloadConfigBtn) this.addListener(reloadConfigBtn, 'click', async () => {
      await this._executeAction('reload-config', '重新加载配置');
    });
    const exportReportBtn = document.getElementById('exportReport');
    if (exportReportBtn) this.addListener(exportReportBtn, 'click', () => {
      const format = prompt('选择导出格式：\n1. JSON\n2. CSV', '1');
      window.location.href = `/api/actions/export-report?format=${format === '2' ? 'csv' : 'json'}`;
    });
  }

  async _executeAction(action, actionName) {
    try {
      const result = await postAction(action);
      alert(`${actionName}成功：${result.message || '操作完成'}`);
      if (action === 'reload-config') this.loadInitialData();
    } catch (error) {
      alert(`${actionName}失败：${error.message}`);
    }
  }

  // --- Data Loading ---
  async loadInitialData() {
    try {
      const data = await fetchJson('/api/dashboard');
      this.data = data;
      // Share data with search manager
      if (window._searchManager) window._searchManager.setDashboardData(data);
      this.updateAllPanels();
    } catch (error) {
      console.error('加载初始数据失败:', error);
      // 如果有缓存数据，不显示错误
      if (this.data && Object.keys(this.data).length > 0) {
        this.updateAllPanels();
      } else {
        this._showLoadingError();
        // 5秒后自动重试
        this.addTimeout(() => this.loadInitialData(), 5000);
      }
    }
  }

  _showLoadingError() {
    ['systemOverview', 'agentsList', 'currentTasks', 'channelsStatus', 'taskHistory', 'skillUsageStats', 'logContainer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="empty-state" style="color: var(--error);">❌ 无法加载数据</div>';
    });
  }

  // --- Panel Updates ---
  updateAllPanels() {
    this.updateHealthPanel();
    this.updateSystemOverview();
    this.updateAgentsList();
    this.updateCurrentTasks();
    this.updateChannelsStatus();
    this.updateTaskHistory();

    // 模型使用量和技能统计使用时段感知的更新频率
    // 工作时间(8:00-24:00)每60秒，夜间(0:00-8:00)不更新
    const hour = new Date().getHours();
    const isNightTime = hour >= 0 && hour < 8;
    const modelUsageInterval = isNightTime ? Infinity : 60000;
    const skillUsageInterval = isNightTime ? Infinity : 60000;

    this._maybeRefresh('modelUsage', modelUsageInterval, () => this.updateModelUsageStats());
    this._maybeRefresh('skillUsage', skillUsageInterval, () => this.updateSkillUsageStats());
    this.updateLogs();

    if (window._sidebarManager) {
      this._maybeRefresh('resources', 15000, () => this._updateResourcesPanel());
      this._maybeRefresh('alerts', 15000, () => this._updateAlertsPanel());
      this._maybeRefresh('statistics', 20000, () => this._updateStatisticsPanel());
      this._maybeRefresh('messages', 30000, () => this._updateMessagesPanel());
    }

    if (chartsManager) chartsManager.updateAllCharts();

    // Layout: single ResizeObserver handles this, but force one sync layout
    this._triggerLayout();
  }

  _triggerLayout() {
    // Clear old timeouts
    this._layoutTimeouts.forEach(id => clearTimeout(id));
    this._layoutTimeouts = [];

    const runLayout = () => {
      if (window._dragDrop && window._dragDrop.layoutMasonry) window._dragDrop.layoutMasonry();
    };
    const grid = document.querySelector('.grid');
    if (grid) void grid.offsetHeight;
    runLayout();
    requestAnimationFrame(runLayout);
    // Reduced from 7 timeouts to 2 fallbacks
    [200, 1000].forEach(ms => {
      this._layoutTimeouts.push(setTimeout(runLayout, ms));
    });
  }

  _maybeRefresh(key, minMs, fn) {
    const now = Date.now();
    if ((now - (this.panelRefreshState[key] || 0)) < minMs) return;
    this.panelRefreshState[key] = now;
    Promise.resolve().then(fn).catch(e => console.error(`刷新面板失败: ${key}`, e));
  }

  // --- Polling & Clock ---
  _startPolling() {
    this.addInterval(() => {
      if (!this.ws.isConnected) this.loadInitialData();
    }, 10000);
  }

  _startClock() {
    const updateClock = () => {
      const el = document.getElementById('updateTime');
      if (el) el.textContent = new Date().toLocaleTimeString('zh-CN');
    };
    updateClock();
    this.addInterval(updateClock, 1000);
  }

  // --- Health Panel ---
  updateHealthPanel() {
    if (!this.data || !this.data.health) {
      const panel = document.getElementById('healthScore');
      const scoreVal = panel && panel.querySelector('.score-value');
      if (scoreVal) scoreVal.textContent = '--';
      const statusPanel = document.getElementById('healthStatus');
      if (statusPanel) statusPanel.innerHTML = '<div class="status-badge">检测中...</div>';
      return;
    }
    const health = this.data.health;
    const scoreElement = document.getElementById('healthScore')?.querySelector('.score-value');
    if (!scoreElement) return;
    scoreElement.textContent = health.score;
    scoreElement.style.animation = health.score >= 80 ? 'scoreGlow 2s ease-in-out infinite' :
                                   health.score >= 50 ? 'scoreGlow 1.5s ease-in-out infinite' :
                                   'scoreGlow 1s ease-in-out infinite';
    const statusBadge = document.getElementById('healthStatus')?.querySelector('.status-badge');
    if (!statusBadge) return;
    statusBadge.className = 'status-badge';
    if (health.status === 'healthy') { statusBadge.classList.add('healthy'); statusBadge.textContent = '健康'; }
    else if (health.status === 'warning') { statusBadge.classList.add('warning'); statusBadge.textContent = '警告'; }
    else { statusBadge.classList.add('critical'); statusBadge.textContent = '严重'; }
    const issuesContainer = document.getElementById('healthIssues');
    if (!issuesContainer) return;
    if (health.issues && health.issues.length > 0) {
      issuesContainer.innerHTML = health.issues.map(issue => `<div class="issue-item">${issue.message}</div>`).join('');
    } else {
      issuesContainer.innerHTML = '';
    }
  }
  // --- System Overview ---
  updateSystemOverview() {
    if (!this.data.system) return;
    const system = this.data.system;
    const isRunning = system.gateway.status === 'running';
    // 使用主机整体CPU使用率
    const cpuValue = typeof system.hostCpu === 'number' ? system.hostCpu : (parseFloat(system.gateway.cpu) || 0);
    const memoryStr = system.gateway.memory || '0 KB';
    const memoryKB = parseFloat(memoryStr.replace(/[^\d.]/g, '')) || 0;
    const memoryMB = memoryStr.includes('KB') ? memoryKB / 1024 : memoryKB;
    const rawTotalMemory = Number(system.totalMemory);
    const totalMemoryMB = (rawTotalMemory > 0 && !isNaN(rawTotalMemory)) ? rawTotalMemory : 2048;
    const memoryPercent = Math.min(100, Math.max(0, (memoryMB / totalMemoryMB) * 100));
    const getCpuColor = (val) => val > 80 ? '#ef4444' : val > 50 ? '#f59e0b' : '#3b82f6';
    const getMemColor = (val) => val > 80 ? '#ef4444' : val > 50 ? '#f59e0b' : '#8b5cf6';
    const cpuColor = getCpuColor(cpuValue);
    const memColor = getMemColor(memoryPercent);
    const r = 26, circ = 2 * Math.PI * r;
    const html = `
      <div class="so-metric-grid" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div style="padding: 14px; border-radius: 10px; text-align: center; background: ${isRunning ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${isRunning ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};">
          <div style="font-size: 1.8em; margin-bottom: 6px;">${isRunning ? '✅' : '❌'}</div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">Gateway</div>
          <div style="font-size: 0.9em; font-weight: 600; color: ${isRunning ? '#10b981' : '#ef4444'};">${isRunning ? '运行中' : '已停止'}</div>
        </div>
        <div style="padding: 14px; border-radius: 10px; text-align: center; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2);">
          <div style="position: relative; width: 60px; height: 60px; margin: 0 auto 8px;">
            <svg width="60" height="60" style="transform: rotate(-90deg);">
              <circle cx="30" cy="30" r="${r}" fill="none" stroke="rgba(59, 130, 246, 0.2)" stroke-width="6"/>
              <circle cx="30" cy="30" r="${r}" fill="none" stroke="${cpuColor}" stroke-width="6" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - cpuValue / 100)}" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.85em; font-weight: 700; color: ${cpuColor};">${cpuValue.toFixed(0)}%</div>
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">CPU 占用</div>
        </div>
        <div style="padding: 14px; border-radius: 10px; text-align: center; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
          <div style="position: relative; width: 60px; height: 60px; margin: 0 auto 8px;">
            <svg width="60" height="60" style="transform: rotate(-90deg);">
              <circle cx="30" cy="30" r="${r}" fill="none" stroke="rgba(139, 92, 246, 0.2)" stroke-width="6"/>
              <circle cx="30" cy="30" r="${r}" fill="none" stroke="${memColor}" stroke-width="6" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - memoryPercent / 100)}" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7em; font-weight: 700; color: ${memColor};" title="${memoryPercent.toFixed(1)}% (${memoryMB.toFixed(0)}MB / ${totalMemoryMB}MB)">${memoryMB.toFixed(0)}MB</div>
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);" title="${memoryPercent.toFixed(1)}% 占用">内存占用</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; font-size: 0.85em;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px; min-width: 0;">
          <span style="font-size: 1.1em;">🏠</span><span style="color: var(--text-secondary);">主机</span>
          <span title="${system.hostname}" style="margin-left: auto; font-weight: 500; min-width: 0; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${system.hostname}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">🔢</span><span style="color: var(--text-secondary);">PID</span>
          <span style="margin-left: auto; font-weight: 500;">${system.gateway.pid || 'N/A'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">⏱️</span><span style="color: var(--text-secondary);">运行时间</span>
          <span style="margin-left: auto; font-weight: 500;">${system.gateway.uptime || 'N/A'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">🌐</span><span style="color: var(--text-secondary);">端口</span>
          <span style="margin-left: auto; font-weight: 500;">${system.gateway.port || 'N/A'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">📦</span><span style="color: var(--text-secondary);">Node.js</span>
          <span style="margin-left: auto; font-weight: 500;">${system.nodeVersion}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px; min-width: 0;">
          <span style="font-size: 1.1em;">🖥️</span><span style="color: var(--text-secondary);">架构</span>
          <span title="${system.platform} ${system.arch}" style="margin-left: auto; font-weight: 500; min-width: 0; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${system.platform} ${system.arch}</span>
        </div>
      </div>
    `;
    const sysPanel = document.getElementById('systemOverview');
    if (sysPanel) sysPanel.innerHTML = html;
  }
  // --- Agents List (with topology view toggle) ---
  updateAgentsList() {
    if (!this.data.agents || this.data.agents.length === 0) {
      const al = document.getElementById('agentsList');
      if (al) al.innerHTML = '<div class="empty-state">暂无Agent</div>';
      return;
    }
    if (window._searchManager && window._searchManager.currentFilters?.agents?.keyword) {
      window._searchManager.filterAgents();
      return;
    }

    // Topology view mode
    if (this.topology.viewMode === 'topology') {
      const al = document.getElementById('agentsList');
      if (al) {
        const topoHtml = this.topology.renderTopology(this.data.agents);
        const swimlaneHtml = (this.data.tasks && this.data.tasks.current)
          ? this.topology.renderSwimlane(this.data.tasks.current, this.data.agents)
          : '';
        al.innerHTML = topoHtml + swimlaneHtml;
      }
      return;
    }

    // List view (original)
    const agents = this.data.agents;
    const agentMap = new Map(agents.map(a => [a.id, a]));
    const childrenMap = new Map();
    const ensureBucket = (pid) => { if (!childrenMap.has(pid)) childrenMap.set(pid, []); return childrenMap.get(pid); };
    agents.forEach(agent => {
      if (agent.parentId && agentMap.has(agent.parentId)) ensureBucket(agent.parentId).push(agent.id);
      if (agent.subagents) agent.subagents.forEach(subId => {
        if (agentMap.has(subId)) { const b = ensureBucket(agent.id); if (!b.includes(subId)) b.push(subId); }
      });
    });
    const childAgentIds = new Set(Array.from(childrenMap.values()).flat());
    const mainAgents = agents.filter(a => !childAgentIds.has(a.id));
    const activeCount = agents.filter(a => a.status === 'active').length;
    const idleCount = agents.filter(a => a.status === 'idle').length;
    const totalSessions = agents.reduce((sum, a) => sum + (a.sessionCount || 0), 0);

    const html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #3b82f6;">${agents.length}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">Agent 总数</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #10b981;">${activeCount}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">活跃中</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #f59e0b;">${idleCount}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">空闲中</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(167, 139, 250, 0.1)); padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 2em; font-weight: 700; color: #8b5cf6;">${totalSessions}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary);">总会话数</div>
        </div>
      </div>
      <div class="org-tree">
        ${mainAgents.map(agent => this._renderAgentNode(agent, agentMap, childrenMap, 0)).join('')}
      </div>
    `;
    const al = document.getElementById('agentsList');
    if (al) al.innerHTML = html;
  }
  _renderAgentNode(agent, agentMap, childrenMap, level) {
    const childIds = childrenMap.get(agent.id) || [];
    const hasSubagents = childIds.length > 0;
    const isActive = agent.status === 'active';
    const statusColor = isActive ? '#10b981' : '#f59e0b';
    const statusBg = isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
    const statusText = isActive ? '活跃' : '空闲';

    if (level === 0) {
      let subagentsHtml = '';
      if (hasSubagents) {
        const groupMetaMap = {
          'direct-department': { label: '直属部门', icon: '🏛️', accent: '#2563eb', accentBg: 'rgba(37, 99, 235, 0.1)', accentBorder: 'rgba(37, 99, 235, 0.18)' },
          'special-envoy': { label: '特使机构', icon: '📜', accent: '#d97706', accentBg: 'rgba(217, 119, 6, 0.1)', accentBorder: 'rgba(217, 119, 6, 0.18)' },
          'managed-agent': { label: '下级 Agent', icon: '🧩', accent: '#0f766e', accentBg: 'rgba(15, 118, 110, 0.1)', accentBorder: 'rgba(15, 118, 110, 0.18)' },
          'runtime-subagent': { label: '下级 Agent', icon: '🧩', accent: '#0f766e', accentBg: 'rgba(15, 118, 110, 0.1)', accentBorder: 'rgba(15, 118, 110, 0.18)' },
          'independent': { label: '独立实例', icon: '🛰️', accent: '#6b7280', accentBg: 'rgba(107, 114, 128, 0.1)', accentBorder: 'rgba(107, 114, 128, 0.18)' }
        };
        const groupOrder = ['direct-department', 'special-envoy', 'managed-agent', 'runtime-subagent', 'independent'];
        const childGroups = new Map();
        childIds.forEach(subId => {
          const sub = agentMap.get(subId);
          const gk = sub?.organizationType || 'managed-agent';
          if (!childGroups.has(gk)) childGroups.set(gk, []);
          childGroups.get(gk).push(subId);
        });
        const orderedGroups = groupOrder.filter(gk => childGroups.has(gk)).map(gk => ({
          key: gk, meta: groupMetaMap[gk] || groupMetaMap['managed-agent'], items: childGroups.get(gk) || []
        }));
        const childSectionLabel = orderedGroups.map(g => `${g.meta.label} ${g.items.length}`).join(' · ') || `组织成员 ${childIds.length}`;
        const groupedChildHtml = orderedGroups.map((group, index) => {
          const subItems = group.items.map(subId => {
            const sub = agentMap.get(subId);
            if (!sub) return `<div class="agent-subagent-card" style="padding: 12px; text-align: center; background: rgba(100,100,100,0.05); border: 1px dashed var(--border); border-radius: 12px;"><div style="font-size: 2em; margin-bottom: 8px;">🔗</div><div style="font-size: 0.85em; color: var(--text-secondary);">${subId}</div><div style="font-size: 0.7em; color: var(--text-muted);">未配置</div></div>`;
            const sa = sub.status === 'active';
            const sc = sa ? '#10b981' : '#f59e0b';
            const sb = sa ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)';
            const sbd = sa ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)';
            const orgLabel = sub.organizationLabel || group.meta.label;
            return `
              <div class="clickable agent-subagent-card" onclick="event.stopPropagation(); window.showAgentDetail('${sub.id}')" style="padding: 12px; text-align: center; background: ${sb}; border-radius: 12px; cursor: pointer; border: 1px solid ${sbd}; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                <div style="position: relative; display: inline-block;">
                  <div style="font-size: 2em; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: ${sa ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; border-radius: 12px; margin: 0 auto 8px;">${sub.emoji}</div>
                  <span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: ${sc}; border-radius: 50%; border: 2px solid var(--card-bg); ${sa ? 'animation: pulse 2s infinite;' : ''}"></span>
                </div>
                <div style="font-weight: 600; font-size: 0.85em; color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(sub.name)}</div>
                <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin-bottom: 4px;">
                  <div style="font-size: 0.65em; padding: 1px 6px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 8px;">${escapeHtml(sub.role || '助手')}</div>
                  <div style="font-size: 0.65em; padding: 1px 6px; background: ${group.meta.accentBg}; color: ${group.meta.accent}; border-radius: 8px; border: 1px solid ${group.meta.accentBorder};">${escapeHtml(orgLabel)}</div>
                </div>
                <div style="font-size: 0.7em; color: var(--text-muted);">${sub.sessionCount || 0} 会话</div>
              </div>`;
          }).join('');
          return `<div style="margin-top: ${index === 0 ? 0 : 14}px;"><div style="display: flex; align-items: center; gap: 6px; font-size: 0.78em; color: var(--text-secondary); margin-bottom: 10px; font-weight: 600;"><span>${group.meta.icon}</span><span>${group.meta.label} (${group.items.length})</span></div><div class="agent-subagent-list">${subItems}</div></div>`;
        }).join('');
        subagentsHtml = `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);"><div style="font-size: 0.8em; color: var(--text-secondary); margin-bottom: 10px; font-weight: 500;"><span style="margin-right: 4px;">🏷️</span> ${childSectionLabel} (${childIds.length})</div>${groupedChildHtml}</div>`;
      }
      return `
        <div class="agent-org-node" style="margin-bottom: 16px;">
          <div class="agent-card clickable" onclick="window.showAgentDetail('${agent.id}')" style="background: var(--card-bg); border: 2px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}; border-radius: 12px; padding: 16px; transition: all 0.2s; cursor: pointer; ${isActive ? 'box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);' : ''}" onmouseover="this.style.transform='translateX(4px)'; this.style.borderColor='var(--accent)';" onmouseout="this.style.transform='none'; this.style.borderColor='${isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}';">
            <div style="display: grid; grid-template-columns: minmax(220px, 1fr) minmax(360px, auto); gap: 14px; align-items: center;">
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <div style="font-size: 1.8em; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; background: ${statusBg}; border-radius: 10px;">${agent.emoji}</div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.05em; font-weight: 600; color: var(--text-primary);">${escapeHtml(agent.name)}</span>
                    <span style="font-size: 0.7em; padding: 2px 8px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 10px; font-weight: 500;">${escapeHtml(agent.role || '通用助手')}</span>
                  </div>
                  <div style="font-size: 0.75em; color: var(--text-secondary); font-family: monospace;">${agent.id}</div>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: minmax(170px, 1.4fr) repeat(3, minmax(72px, auto)); gap: 12px; align-items: center; justify-content: end;">
                <div style="text-align: center; min-width: 0;"><div style="font-size: 0.7em; color: var(--text-secondary);">模型</div><div title="${agent.model || 'N/A'}" style="font-size: 0.8em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agent.model || 'N/A'}</div></div>
                <div style="text-align: center;"><div style="font-size: 0.7em; color: var(--text-secondary);">会话</div><div style="font-size: 0.8em; font-weight: 500;">${agent.sessionCount || 0}</div></div>
                <div style="text-align: center;"><div style="font-size: 0.7em; color: var(--text-secondary);">活动</div><div style="font-size: 0.8em; font-weight: 500;">${agent.lastActivity ? formatRelativeTime(agent.lastActivity) : 'N/A'}</div></div>
                <span style="padding: 4px 10px; background: ${statusBg}; color: ${statusColor}; border-radius: 16px; font-size: 0.75em; font-weight: 600;">
                  <span style="display: inline-block; width: 5px; height: 5px; background: ${statusColor}; border-radius: 50%; margin-right: 5px; ${isActive ? 'animation: pulse 2s infinite;' : ''}"></span>${statusText}
                </span>
              </div>
            </div>
            ${subagentsHtml}
          </div>
        </div>`;
    }
    return '';
  }
  // --- Current Tasks ---
  updateCurrentTasks() {
    const taskAgentFilter = document.getElementById('taskAgentFilter');
    if (taskAgentFilter && this.data.agents) {
      const currentValue = taskAgentFilter.value;
      taskAgentFilter.innerHTML = '<option value="all">全部Agent</option>';
      this.data.agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        taskAgentFilter.appendChild(option);
      });
      taskAgentFilter.value = currentValue || 'all';
    }
    if (!this.data.tasks || !this.data.tasks.current || this.data.tasks.current.length === 0) {
      const ct = document.getElementById('currentTasks');
      if (ct) ct.innerHTML = '<div class="empty-state">暂无当前任务</div>';
      return;
    }
    if (window._searchManager && window._searchManager.currentFilters?.tasks?.keyword) {
      window._searchManager.filterTasks();
      return;
    }
    const html = this.data.tasks.current.slice(0, 10).map(task => `
      <div class="task-item clickable" onclick="window.showTaskDetail('${task.id}')">
        <div class="task-header">
          <span><strong>${escapeHtml(task.agentName)}</strong></span>
          <span class="badge badge-blue">进行中</span>
        </div>
        <div class="task-title" style="margin: 6px 0 4px; font-size: 0.95em; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📌 ${escapeHtml(task.title || '(无标题)')}</div>
        <div class="task-id" style="font-size: 0.8em; color: var(--text-muted);">ID: ${task.id.substring(0, 12)}...</div>
        <div class="task-time">消息数: ${task.messageCount} | 更新: ${new Date(task.lastUpdate).toLocaleString('zh-CN')}</div>
      </div>
    `).join('');
    const ctPanel = document.getElementById('currentTasks');
    if (ctPanel) ctPanel.innerHTML = html;
  }

  // --- Channels Status ---
  updateChannelsStatus() {
    if (!this.data.channels || this.data.channels.length === 0) {
      const cs = document.getElementById('channelsStatus');
      if (cs) cs.innerHTML = '<div class="empty-state">暂无通道</div>';
      return;
    }
    const icons = { telegram: '📱', discord: '🎮', whatsapp: '💬', feishu: '📋' };
    const html = this.data.channels.map(channel => {
      const statusClass = channel.status === 'normal' ? 'status-ok' : channel.status === 'warning' ? 'status-warn' : 'status-error';
      const statusText = channel.status === 'normal' ? '正常' : channel.status === 'warning' ? '警告' : '异常';
      const statusIcon = channel.status === 'normal' ? '✅' : channel.status === 'warning' ? '⚠️' : '❌';
      return `
        <div class="channel-item">
          <div class="channel-name">${icons[channel.name.toLowerCase()] || '📡'} ${escapeHtml(channel.name)}</div>
          <div class="channel-status ${statusClass}">${statusIcon} ${statusText}</div>
          ${channel.lastMessage ? `<div style="font-size: 0.8em; color: var(--text-muted); margin-top: 4px;">${escapeHtml(channel.lastMessage)}</div>` : ''}
        </div>`;
    }).join('');
    const csPanel = document.getElementById('channelsStatus');
    if (csPanel) csPanel.innerHTML = `<div class="channel-grid">${html}</div>`;
  }

  // --- Task History ---
  updateTaskHistory() {
    if (!this.data.tasks || !this.data.tasks.history || this.data.tasks.history.length === 0) {
      const th = document.getElementById('taskHistory');
      if (th) th.innerHTML = '<div class="empty-state">暂无历史任务</div>';
      return;
    }
    if (window._searchManager && window._searchManager.currentFilters?.tasks?.keyword) {
      window._searchManager.filterTasks();
      return;
    }
    const html = this.data.tasks.history.slice(0, 10).map(task => `
      <div class="task-item clickable" onclick="window.showTaskDetail('${task.id}')">
        <div class="task-header">
          <span><strong>${escapeHtml(task.agentName)}</strong></span>
          <span class="badge badge-green">已完成</span>
        </div>
        <div class="task-title" style="margin: 6px 0 4px; font-size: 0.95em; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📌 ${escapeHtml(task.title || '(无标题)')}</div>
        <div class="task-id" style="font-size: 0.8em; color: var(--text-muted);">ID: ${task.id.substring(0, 12)}...</div>
        <div class="task-time">消息数: ${task.messageCount} | 完成: ${new Date(task.lastUpdate).toLocaleString('zh-CN')}</div>
      </div>
    `).join('');
    const thPanel = document.getElementById('taskHistory');
    if (thPanel) thPanel.innerHTML = html;
  }

  _idleOnce(timeout = 120) {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => resolve(), { timeout });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  async _fetchModelUsageData(rangeKey, daysParam) {
    const now = Date.now();
    const cacheTTL = 20000;
    const cached = this._modelUsageDataCache.get(rangeKey);
    if (cached && now - cached.ts < cacheTTL) return cached.data;

    if (this._modelUsageInFlight.has(rangeKey)) {
      return this._modelUsageInFlight.get(rangeKey);
    }

    const request = fetchJson(`/api/models/usage?${daysParam}`)
      .then((data) => {
        this._modelUsageDataCache.set(rangeKey, { ts: Date.now(), data });
        return data;
      })
      .finally(() => {
        this._modelUsageInFlight.delete(rangeKey);
      });

    this._modelUsageInFlight.set(rangeKey, request);
    return request;
  }

  // --- Model Usage Stats ---
  async updateModelUsageStats() {
    const container = document.getElementById('modelUsageStats');
    if (!container) return;
    const rangeSelect = document.getElementById('modelUsageRange');
    const selectedValue = rangeSelect ? rangeSelect.value : '';
    const daysParam = selectedValue ? `days=${selectedValue}` : '';
    if (rangeSelect && !rangeSelect._bound) {
      rangeSelect._bound = true;
      rangeSelect.addEventListener('change', () => {
        this.panelRefreshState.modelUsage = 0;
        this.updateModelUsageStats();
      });
    }
    if (!this.modelTokenDimension) {
      this.modelTokenDimension = 'total';
    }
    const tokenDimension = this.modelTokenDimension;
    const rangeKey = selectedValue || 'all';
    const requestSeq = ++this._modelUsageRequestSeq;

    try {
      const data = await this._fetchModelUsageData(rangeKey, daysParam);
      if (requestSeq !== this._modelUsageRequestSeq) return;

      if (!data || data.summary.totalCalls === 0) {
        container.innerHTML = '<div class="empty-state">暂无模型使用记录</div>';
        return;
      }

      container.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">每日调用趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelUsageTrendCanvas"></canvas>
          </div>
          <h4 style="margin: 16px 0 12px; font-size: 0.95em; color: var(--text-primary);">每日 Token 趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelTokenTrendCanvas"></canvas>
          </div>
        </div>
        <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(59,130,246,0.15); background: rgba(59,130,246,0.03); color: var(--text-secondary); font-size: 0.85em;">
          正在加载详细统计...
        </div>
      `;

      if (chartsManager && data.byDay && data.byDay.length > 0) {
        chartsManager.renderModelUsageTrend(data);
        chartsManager.renderModelTokenTrend(data);
      }

      await this._idleOnce();
      if (requestSeq !== this._modelUsageRequestSeq) return;

      const s = data.summary;
      const topModel = data.byModel && data.byModel.length > 0 ? data.byModel[0] : null;
      const topAgent = data.byAgent && data.byAgent.length > 0 ? data.byAgent[0] : null;
      const avgDailyCalls = data.byDay && data.byDay.length > 0
        ? Math.round(data.byDay.reduce((sum, d) => sum + (d.total || 0), 0) / data.byDay.length)
        : 0;

      const recentDaysForSpeed = (data.byDay || []).slice(-3);
      const prevDaysForSpeed = (data.byDay || []).slice(-6, -3);
      const recentTotalTokens = recentDaysForSpeed.reduce((sum, d) => sum + (d.totalTokens || 0), 0);
      const prevTotalTokens = prevDaysForSpeed.reduce((sum, d) => sum + (d.totalTokens || 0), 0);
      const recentTokPerHour = recentDaysForSpeed.length > 0
        ? Math.round(recentTotalTokens / (recentDaysForSpeed.length * 24))
        : 0;
      const prevTokPerHour = prevDaysForSpeed.length > 0
        ? Math.round(prevTotalTokens / (prevDaysForSpeed.length * 24))
        : 0;
      let speedTrend = 'stable';
      if (prevTokPerHour > 0) {
        if (recentTokPerHour > prevTokPerHour * 1.15) speedTrend = 'up';
        else if (recentTokPerHour < prevTokPerHour * 0.85) speedTrend = 'down';
      }
      const speedTrendIcon = speedTrend === 'up' ? '📈' : speedTrend === 'down' ? '📉' : '➡️';
      const speedTrendColor = speedTrend === 'up' ? '#ef4444' : speedTrend === 'down' ? '#10b981' : '#64748b';

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
      const totalTokens = (s.totalTokens) || (data.byModel || []).reduce((sum, m) => sum + (m.tokens || 0), 0);
      const tokenDisplay = totalTokens >= 1000000 ? `${(totalTokens / 1000000).toFixed(1)}M` : totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens;

      const dateMatch = (s.dateRange || '').match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
      const rangeStart = dateMatch ? dateMatch[1] : '';
      const rangeEnd = dateMatch ? dateMatch[2] : '';
      const rangeDays = dateMatch
        ? Math.max(1, Math.round((new Date(rangeEnd) - new Date(rangeStart)) / 86400000) + 1)
        : (data.byDay || []).length;

      const metricCardStyle = 'padding:14px; border-radius:10px; text-align:center; min-height:132px; display:flex; flex-direction:column; align-items:center;';
      const metricValueWrap = 'min-height:62px; display:flex; align-items:center; justify-content:center; width:100%;';
      const metricLabelStyle = 'font-size:0.8em; color:var(--text-secondary); margin-top:auto; line-height:1.2;';

      const summaryHtml = `
        <div class="mu-summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="${metricCardStyle} background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2);">
            <div style="${metricValueWrap}"><div style="font-size: 2.25em; font-weight: 700; color: #3b82f6; line-height:1;">${s.totalCalls.toLocaleString()}</div></div>
            <div style="${metricLabelStyle}">总调用次数</div>
          </div>
          <div style="${metricCardStyle} background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="${metricValueWrap}"><div style="font-size: 2.25em; font-weight: 700; color: #10b981; line-height:1;">${tokenDisplay}</div></div>
            <div style="${metricLabelStyle}">总Token使用量</div>
          </div>
          <div style="${metricCardStyle} background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
            <div style="${metricValueWrap}"><div style="font-size: 2.25em; font-weight: 700; color: #8b5cf6; line-height:1;">${s.totalModels}</div></div>
            <div style="${metricLabelStyle}">活跃模型</div>
          </div>
          <div style="${metricCardStyle} background: linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(168, 85, 247, 0.08)); border: 1px solid rgba(168, 85, 247, 0.2);">
            <div style="${metricValueWrap}"><div style="font-size: 2.05em; font-weight: 700; color: #a855f7; line-height:1;">${recentTokPerHour >= 1000 ? `${(recentTokPerHour / 1000).toFixed(1)}K` : recentTokPerHour}</div></div>
            <div style="${metricLabelStyle}">消耗速度(tokens/h)</div>
          </div>
          <div style="${metricCardStyle} background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2);">
            <div style="${metricValueWrap}"><div style="font-size: 1.55em; font-weight: 700; color: #f59e0b; line-height:1.15;">覆盖 ${rangeDays} 天</div></div>
            <div style="${metricLabelStyle}">${rangeStart && rangeEnd ? `${rangeStart} → ${rangeEnd}` : (s.dateRange || '统计窗口')}</div>
          </div>
        </div>
      `;

      const getTokenValue = (m) => {
        if (tokenDimension === 'input') return m.inputTokens || 0;
        if (tokenDimension === 'output') return m.outputTokens || 0;
        return m.tokens || 0;
      };

      const validModels = (data.byModel || []).filter(m => (m.tokens || 0) > 0);
      const modelTokenRank = [...validModels].sort((a, b) => getTokenValue(b) - getTokenValue(a));
      const maxModelTokens = modelTokenRank.length > 0 ? getTokenValue(modelTokenRank[0]) || 1 : 1;
      const totalInputTokens = validModels.reduce((sum, m) => sum + (m.inputTokens || 0), 0);
      const totalOutputTokens = validModels.reduce((sum, m) => sum + (m.outputTokens || 0), 0);
      const ioTotal = totalInputTokens + totalOutputTokens;
      const inputPct = ioTotal > 0 ? ((totalInputTokens / ioTotal) * 100).toFixed(1) : '0.0';
      const outputPct = ioTotal > 0 ? ((totalOutputTokens / ioTotal) * 100).toFixed(1) : '0.0';
      const dimensionTotal = tokenDimension === 'input' ? totalInputTokens : tokenDimension === 'output' ? totalOutputTokens : totalTokens;

      const ioRatioHtml = `
        <div style="margin-bottom: 16px; padding: 12px; border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.15); background: rgba(59, 130, 246, 0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px; flex-wrap:wrap;">
            <div style="font-size:0.9em; color:var(--text-primary); font-weight:600;">🔄 输入/输出 Token 比例</div>
            <span style="font-size:0.75em; color:var(--text-secondary);">总计 ${formatTokens(totalTokens)} tokens</span>
          </div>
          <div style="height: 24px; background: rgba(0,0,0,0.06); border-radius: 12px; overflow: hidden; display:flex; margin-bottom:8px;">
            <div style="width:${inputPct}%; background:linear-gradient(90deg, #3b82f6, #60a5fa); display:flex; align-items:center; justify-content:center; transition:width .4s;">
              ${Number(inputPct) > 15 ? `<span style="font-size:0.72em; color:#fff; font-weight:600;">${inputPct}%</span>` : ''}
            </div>
            <div style="width:${outputPct}%; background:linear-gradient(90deg, #10b981, #34d399); display:flex; align-items:center; justify-content:center; transition:width .4s;">
              ${Number(outputPct) > 15 ? `<span style="font-size:0.72em; color:#fff; font-weight:600;">${outputPct}%</span>` : ''}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; font-size:0.78em;">
            <span style="color:#3b82f6;">📥 输入 ${formatTokens(totalInputTokens)} (${inputPct}%)</span>
            <span style="color:#10b981;">📤 输出 ${formatTokens(totalOutputTokens)} (${outputPct}%)</span>
            <span style="color:#8b5cf6;">💾 缓存读 ${formatTokens(data.summary?.totalCacheReadTokens || 0)}</span>
          </div>
        </div>
      `;

      const modelTokenBarsHtml = modelTokenRank.slice(0, 8).map((m, i) => {
        const tokenValue = getTokenValue(m);
        const tokenPct = maxModelTokens > 0 ? ((tokenValue / maxModelTokens) * 100).toFixed(0) : 0;
        const color = colors[i % colors.length];
        const sharePct = dimensionTotal > 0 ? ((tokenValue / dimensionTotal) * 100).toFixed(1) : '0.0';
        return `
          <div class="mu-token-bar-row" style="display: grid; grid-template-columns: minmax(120px, 1.2fr) 2.4fr auto; gap: 10px; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 0.82em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(`${m.provider}/${m.modelName}`)}">${escapeHtml(m.modelName)}</div>
            <div style="position: relative; background: rgba(0,0,0,0.06); border-radius: 8px; height: 22px; overflow: hidden;">
              <div style="width: ${tokenPct}%; height: 100%; background: linear-gradient(90deg, ${color}, rgba(255,255,255,0.25)); border-radius: 8px; transition: width 0.5s;"></div>
              <div style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 0.72em; color: #fff; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.35);">${sharePct}%</div>
            </div>
            <div style="font-size: 0.82em; color: var(--text-primary); font-weight: 600; min-width: 72px; text-align: right;">${formatTokens(tokenValue)}</div>
          </div>
        `;
      }).join('');

      const modelTokenCardsHtml = modelTokenRank.slice(0, 6).map((m, i) => {
        const tokenValue = getTokenValue(m);
        const color = colors[i % colors.length];
        const sharePct = dimensionTotal > 0 ? ((tokenValue / dimensionTotal) * 100).toFixed(1) : '0.0';
        const ioSum = (m.inputTokens || 0) + (m.outputTokens || 0);
        const mInputPct = ioSum > 0 ? ((m.inputTokens || 0) / ioSum * 100).toFixed(0) : 0;
        const mOutputPct = ioSum > 0 ? ((m.outputTokens || 0) / ioSum * 100).toFixed(0) : 0;
        return `
          <div style="padding: 12px; border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.18); background: linear-gradient(135deg, rgba(59,130,246,0.04), rgba(139,92,246,0.04));">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
              <div style="font-size:0.88em; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(`${m.provider}/${m.modelName}`)}">${escapeHtml(m.modelName)}</div>
              <span style="font-size:0.72em; padding:2px 8px; border-radius:999px; background:${color}22; color:${color}; font-weight:600;">${sharePct}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
              <span style="font-size:1.05em; font-weight:700; color:${color};">${formatTokens(tokenValue)}</span>
              <span style="font-size:0.75em; color:var(--text-secondary);">${m.count || 0} 次调用</span>
            </div>
            <div style="height:8px; background:rgba(0,0,0,0.06); border-radius:999px; overflow:hidden; display:flex;">
              <div style="width:${mInputPct}%; background:rgba(59,130,246,0.75);"></div>
              <div style="width:${mOutputPct}%; background:rgba(16,185,129,0.75);"></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72em; color:var(--text-secondary);">
              <span>📥 ${formatTokens(m.inputTokens || 0)}</span>
              <span>📤 ${formatTokens(m.outputTokens || 0)}</span>
              ${(m.cacheReadTokens || 0) > 0 ? `<span>💾 ${formatTokens(m.cacheReadTokens)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      const modelTokensHtml = `
        <div style="margin-bottom: 20px; padding: 14px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.18); background: rgba(59, 130, 246, 0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
            <h4 style="margin: 0; font-size: 0.95em; color: var(--text-primary);">各模型 Token 使用量</h4>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <div class="token-dimension-toggle" style="display:flex; gap:4px; background:rgba(0,0,0,0.08); border-radius:8px; padding:3px;">
                <button class="dim-btn" data-dimension="total" style="padding:4px 12px; border:none; border-radius:6px; font-size:0.75em; font-weight:600; cursor:pointer; transition:all 0.25s; background:${tokenDimension === 'total' ? 'rgba(59,130,246,0.9)' : 'transparent'}; color:${tokenDimension === 'total' ? '#fff' : 'var(--text-secondary)'}">总量</button>
                <button class="dim-btn" data-dimension="input" style="padding:4px 12px; border:none; border-radius:6px; font-size:0.75em; font-weight:600; cursor:pointer; transition:all 0.25s; background:${tokenDimension === 'input' ? 'rgba(59,130,246,0.9)' : 'transparent'}; color:${tokenDimension === 'input' ? '#fff' : 'var(--text-secondary)'}">输入</button>
                <button class="dim-btn" data-dimension="output" style="padding:4px 12px; border:none; border-radius:6px; font-size:0.75em; font-weight:600; cursor:pointer; transition:all 0.25s; background:${tokenDimension === 'output' ? 'rgba(59,130,246,0.9)' : 'transparent'}; color:${tokenDimension === 'output' ? '#fff' : 'var(--text-secondary)'}">输出</button>
              </div>
              <span style="font-size:0.78em; color:var(--text-secondary); padding:4px 10px; border-radius:999px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.18);">输入 ${formatTokens(totalInputTokens)} (${inputPct}%)</span>
              <span style="font-size:0.78em; color:var(--text-secondary); padding:4px 10px; border-radius:999px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.18);">输出 ${formatTokens(totalOutputTokens)} (${outputPct}%)</span>
            </div>
          </div>
          ${ioRatioHtml}
          <div class="mu-token-main-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
            <div>
              <div style="font-size:0.82em; color:var(--text-secondary); margin-bottom:8px;">Token 占比条形视图</div>
              ${modelTokenBarsHtml || '<div class="empty-state">无模型 token 数据</div>'}
            </div>
            <div>
              <div style="font-size:0.82em; color:var(--text-secondary); margin-bottom:8px;">Top 模型 Token 卡片视图</div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
                ${modelTokenCardsHtml || '<div class="empty-state">无模型 token 数据</div>'}
              </div>
            </div>
          </div>
        </div>
      `;

      const maxModelCount = validModels.length > 0 ? validModels[0].count : 1;
      const modelBarsHtml = validModels.slice(0, 8).map((m, i) => {
        const pct = (m.count / maxModelCount * 100).toFixed(0);
        const color = colors[i % colors.length];
        return `
          <div class="mu-rank-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="mu-rank-label" style="width: 120px; font-size: 0.82em; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(`${m.provider}/${m.modelName}`)}">${escapeHtml(m.modelName)}</div>
            <div style="flex: 1; background: rgba(0,0,0,0.06); border-radius: 4px; height: 22px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 4px; transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                ${pct > 15 ? `<span style="font-size: 0.75em; color: white; font-weight: 600;">${m.count}</span>` : ''}
              </div>
            </div>
            ${pct <= 15 ? `<span style="font-size: 0.8em; font-weight: 600; color: var(--text-primary); min-width: 30px;">${m.count}</span>` : '<span style="min-width: 30px;"></span>'}
          </div>
        `;
      }).join('');

      const byAgent = data.byAgent || [];
      const maxAgentTotal = byAgent.length > 0 ? byAgent[0].total : 1;
      const agentBarsHtml = byAgent.slice(0, 8).map((a, i) => {
        const pct = (a.total / maxAgentTotal * 100).toFixed(0);
        const color = colors[(i + 3) % colors.length];
        return `
          <div class="mu-agent-rank-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="mu-rank-label" style="width: 100px; font-size: 0.82em; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(a.agentName)}">${a.agentEmoji || '🤖'} ${escapeHtml(a.agentName)}</div>
            <div style="flex: 1; background: rgba(0,0,0,0.06); border-radius: 4px; height: 22px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 4px; transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                ${pct > 15 ? `<span style="font-size: 0.75em; color: white; font-weight: 600;">${a.total}</span>` : ''}
              </div>
            </div>
            ${pct <= 15 ? `<span style="font-size: 0.8em; font-weight: 600; color: var(--text-primary); min-width: 30px;">${a.total}</span>` : '<span style="min-width: 30px;"></span>'}
          </div>
        `;
      }).join('');

      const top3TokenShare = totalTokens > 0
        ? (((data.byModel || []).slice(0, 3).reduce((sum, m) => sum + (m.tokens || 0), 0) / totalTokens) * 100).toFixed(1)
        : '0.0';
      const concentrationLevel = Number(top3TokenShare) >= 80 ? '高集中' : Number(top3TokenShare) >= 60 ? '中集中' : '分散';
      const concentrationColor = Number(top3TokenShare) >= 80 ? '#ef4444' : Number(top3TokenShare) >= 60 ? '#f59e0b' : '#10b981';

      const insightsHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="padding: 12px; border-radius: 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">高频模型</div>
            <div style="font-size: 0.95em; color: var(--text-primary); font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topModel ? escapeHtml(`${topModel.provider}/${topModel.modelName}`) : '暂无数据'}">${topModel ? escapeHtml(topModel.modelName) : '暂无数据'}</div>
            <div style="font-size: 0.8em; color: #6366f1; margin-top: 4px;">${topModel ? `${topModel.count} 次调用` : '--'}</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">高频 Agent</div>
            <div style="font-size: 0.95em; color: var(--text-primary); font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topAgent ? escapeHtml(topAgent.agentName) : '暂无数据'}">${topAgent ? `${topAgent.agentEmoji || '🤖'} ${escapeHtml(topAgent.agentName)}` : '暂无数据'}</div>
            <div style="font-size: 0.8em; color: #0ea5e9; margin-top: 4px;">${topAgent ? `${topAgent.total} 次调用` : '--'}</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">日均调用</div>
            <div style="font-size: 1.1em; color: #10b981; font-weight: 700; margin-top: 4px;">${avgDailyCalls.toLocaleString()} 次/天</div>
            <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">按当前筛选范围</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">模型集中度（Top3）</div>
            <div style="font-size: 1.1em; color: ${concentrationColor}; font-weight: 700; margin-top: 4px;">${top3TokenShare}%</div>
            <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">${concentrationLevel}</div>
          </div>
        </div>
      `;

      const tokenEfficiencyRank = [...validModels]
        .map(m => ({
          ...m,
          avgTokenPerCall: m.count > 0 ? Math.round((m.tokens || 0) / m.count) : 0
        }))
        .sort((a, b) => b.avgTokenPerCall - a.avgTokenPerCall)
        .slice(0, 6);

      const topAgentToken = byAgent.slice(0, 5);
      const maxAgentTokens = Math.max(...topAgentToken.map(a => a.totalTokens || 0), 1);
      const agentCombatHtml = topAgentToken.map((a) => {
        const pct = Math.max(5, Math.round(((a.totalTokens || 0) / maxAgentTokens) * 100));
        return `
          <div class="mu-agent-combat-row" style="display:grid; grid-template-columns: minmax(90px, 1.1fr) 2fr auto; gap:8px; align-items:center; margin-bottom:7px;">
            <div style="font-size:0.8em; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a.agentEmoji || '🤖'} ${escapeHtml(a.agentName)}</div>
            <div style="height:8px; border-radius:999px; background:rgba(0,0,0,0.06); overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, rgba(14,165,233,0.85), rgba(99,102,241,0.85)); border-radius:999px;"></div>
            </div>
            <div style="font-size:0.75em; color:var(--text-primary); font-weight:600;">${formatTokens(a.totalTokens || 0)}</div>
          </div>
        `;
      }).join('');

      const commandCenterHtml = `
        <div style="margin-bottom:20px; padding:14px; border-radius:12px; border:1px solid rgba(14,165,233,0.2); background:linear-gradient(135deg, rgba(14,165,233,0.04), rgba(99,102,241,0.04));">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
            <h4 style="margin:0; font-size:0.95em; color:var(--text-primary);">⚡ Agent 作战力</h4>
            <span style="font-size:0.75em; color:var(--text-secondary); padding:3px 8px; background:rgba(14,165,233,0.1); border-radius:999px;">按 token 贡献排名</span>
          </div>
          <div style="padding:10px; border-radius:10px; background:rgba(14,165,233,0.04); border:1px solid rgba(14,165,233,0.15);">
            ${agentCombatHtml || '<div class="empty-state">暂无 Agent 数据</div>'}
          </div>
        </div>
      `;

      const maxAvgToken = tokenEfficiencyRank.length > 0 ? tokenEfficiencyRank[0].avgTokenPerCall || 1 : 1;
      const efficiencyCardsHtml = tokenEfficiencyRank.map((m, i) => {
        const barPct = maxAvgToken > 0 ? ((m.avgTokenPerCall / maxAvgToken) * 100).toFixed(0) : 0;
        const color = colors[i % colors.length];
        return `
          <div style="padding:10px; border-radius:10px; border:1px solid rgba(245,158,11,0.18); background:linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.04));">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px;">
              <div style="font-size:0.82em; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(`${m.provider}/${m.modelName}`)}">${escapeHtml(m.modelName)}</div>
              <span style="font-size:0.7em; padding:2px 6px; border-radius:999px; background:${color}22; color:${color}; font-weight:600;">#${i + 1}</span>
            </div>
            <div style="font-size:1.15em; font-weight:700; color:#f59e0b; margin-bottom:6px;">${formatTokens(m.avgTokenPerCall)} tok<span style="font-size:0.65em; font-weight:500; color:var(--text-secondary);">/次</span></div>
            <div style="height:6px; background:rgba(0,0,0,0.06); border-radius:999px; overflow:hidden;">
              <div style="width:${barPct}%; height:100%; background:linear-gradient(90deg, #f59e0b, #fbbf24); border-radius:999px; transition:width 0.5s;"></div>
            </div>
            <div style="font-size:0.72em; color:var(--text-secondary); margin-top:4px;">共 ${m.count} 次调用</div>
          </div>
        `;
      }).join('');

      const tokenEfficiencyHtml = `
        <div style="margin-bottom:20px; padding:14px; border-radius:12px; border:1px solid rgba(245,158,11,0.18); background:rgba(245,158,11,0.03);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <h4 style="margin:0; font-size:0.95em; color:var(--text-primary);">📈 Token 效率榜</h4>
            <span style="font-size:0.75em; color:var(--text-secondary); padding:3px 8px; background:rgba(245,158,11,0.1); border-radius:999px;">平均每次调用</span>
          </div>
          <div class="mu-efficiency-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
            ${efficiencyCardsHtml || '<div class="empty-state">无数据</div>'}
          </div>
        </div>
      `;

      const topAgents = byAgent.slice(0, 3);
      const modelNameByKey = Object.fromEntries(validModels.map(m => [`${m.provider}/${m.modelId}`, m.modelName || m.modelId]));
      const agentModelInsightsHtml = topAgents.map((agent, idx) => {
        const agentModels = Object.entries(agent.models || {})
          .map(([modelKey, stat]) => ({
            modelKey,
            modelName: modelNameByKey[modelKey] || modelKey.split('/').slice(1).join('/') || modelKey,
            count: stat.count || 0,
            tokens: stat.tokens || 0
          }))
          .sort((a, b) => (b.tokens || 0) - (a.tokens || 0))
          .slice(0, 3);

        const agentTotalTokens = agent.totalTokens || agentModels.reduce((sum, am) => sum + (am.tokens || 0), 0);
        const color = colors[(idx + 5) % colors.length];
        const modelMiniListHtml = agentModels.map((am) => {
          const tokenShare = agentTotalTokens > 0 ? ((am.tokens || 0) / agentTotalTokens * 100).toFixed(0) : 0;
          return `
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <div style="flex:1; font-size:0.75em; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(am.modelName)}">${escapeHtml(am.modelName)}</div>
              <div style="font-size:0.72em; color:var(--text-primary); font-weight:600;">${formatTokens(am.tokens || 0)}</div>
              <div style="font-size:0.7em; color:var(--text-secondary);">(${tokenShare}%)</div>
            </div>
          `;
        }).join('');

        return `
          <div style="padding:12px; border-radius:10px; border:1px solid rgba(139,92,246,0.18); background:linear-gradient(135deg, rgba(139,92,246,0.04), rgba(168,85,247,0.04));">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-size:1.2em;">${agent.agentEmoji || '🤖'}</span>
              <div style="flex:1;">
                <div style="font-size:0.88em; font-weight:600; color:var(--text-primary);">${escapeHtml(agent.agentName)}</div>
                <div style="font-size:0.72em; color:var(--text-secondary);">${agent.total} 次调用 · ${formatTokens(agentTotalTokens)} tokens</div>
              </div>
              <span style="font-size:0.7em; padding:2px 8px; border-radius:999px; background:${color}22; color:${color}; font-weight:600;">Top ${idx + 1}</span>
            </div>
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(139,92,246,0.1);">
              <div style="font-size:0.75em; color:var(--text-secondary); margin-bottom:6px;">主力模型:</div>
              ${modelMiniListHtml || '<div style="font-size:0.75em; color:var(--text-secondary);">无数据</div>'}
            </div>
          </div>
        `;
      }).join('');

      const agentModelInsightsBlockHtml = `
        <div style="margin-bottom:20px; padding:14px; border-radius:12px; border:1px solid rgba(139,92,246,0.18); background:rgba(139,92,246,0.03);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <h4 style="margin:0; font-size:0.95em; color:var(--text-primary);">🎯 Agent-Model 贡献洞察</h4>
            <span style="font-size:0.75em; color:var(--text-secondary); padding:3px 8px; background:rgba(139,92,246,0.1); border-radius:999px;">Top Agent 主力模型</span>
          </div>
          <div class="mu-agent-insights-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
            ${agentModelInsightsHtml || '<div class="empty-state">无数据</div>'}
          </div>
        </div>
      `;

      const middleHtml = `
        <div class="mu-middle-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div>
            <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">按模型排名</h4>
            ${modelBarsHtml || '<div class="empty-state">无数据</div>'}
          </div>
          <div>
            <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">按 Agent 排名</h4>
            ${agentBarsHtml || '<div class="empty-state">无数据</div>'}
          </div>
        </div>
      `;

      const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      const parseLocalDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      };
      const formatDateKey = (dt) => {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const formatWeekLabel = (weekStart) => {
        const start = `${String(weekStart.getMonth() + 1).padStart(2, '0')}/${String(weekStart.getDate()).padStart(2, '0')}`;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const end = `${String(weekEnd.getMonth() + 1).padStart(2, '0')}/${String(weekEnd.getDate()).padStart(2, '0')}`;
        return `${start}-${end}`;
      };

      const weekBuckets = {};
      (data.byDay || []).forEach(d => {
        const dt = parseLocalDate(d.date);
        if (!dt || Number.isNaN(dt.getTime())) return;
        const dayOfWeek = (dt.getDay() + 6) % 7;
        const weekStart = new Date(dt);
        weekStart.setDate(dt.getDate() - dayOfWeek);
        const weekKey = formatDateKey(weekStart);

        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = {
            weekKey,
            weekLabel: formatWeekLabel(weekStart),
            days: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            weekTotal: 0
          };
        }

        const tokens = d.totalTokens || 0;
        weekBuckets[weekKey].days[dayOfWeek] += tokens;
        weekBuckets[weekKey].weekTotal += tokens;
      });

      const allWeekRows = Object.values(weekBuckets).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
      const maxVisibleWeeks = 8;
      const weekRows = allWeekRows.slice(-maxVisibleWeeks);
      const weekGlobalMax = Math.max(
        ...weekRows.flatMap(row => Object.values(row.days)),
        1
      );

      const weekHeatHeader = `
        <div style="font-size:0.74em; color:var(--text-secondary); text-align:center; padding:6px 4px;">自然周</div>
        ${weekLabels.map(label => `<div style="font-size:0.74em; color:var(--text-secondary); text-align:center; padding:6px 2px;">${label}</div>`).join('')}
        <div style="font-size:0.74em; color:var(--text-secondary); text-align:center; padding:6px 4px;">周总量</div>
      `;

      const weekHeatRows = weekRows.length > 0 ? weekRows.map(row => {
        const dayCells = weekLabels.map((_, dayIndex) => {
          const value = row.days[dayIndex] || 0;
          const intensity = value > 0 ? (value / weekGlobalMax) : 0;
          const bg = `rgba(59,130,246, ${0.08 + intensity * 0.74})`;
          const textColor = intensity > 0.5 ? '#ffffff' : 'var(--text-primary)';
          return `
            <div title="${formatTokens(value)}" style="height:44px; border-radius:8px; background:${bg}; border:1px solid rgba(59,130,246,0.16); display:flex; align-items:center; justify-content:center; font-size:0.76em; font-weight:700; color:${textColor};">
              ${formatTokens(value)}
            </div>
          `;
        }).join('');

        return `
          <div style="font-size:0.74em; color:var(--text-primary); font-weight:600; text-align:center; padding:0 4px; align-self:center;">${row.weekLabel}</div>
          ${dayCells}
          <div style="font-size:0.76em; color:#2563eb; font-weight:700; text-align:center; padding:0 4px; align-self:center;">${formatTokens(row.weekTotal)}</div>
        `;
      }).join('') : '<div class="empty-state" style="grid-column:1 / -1;">暂无周内热力数据</div>';

      const weekHeatGridHtml = `
        <div class="mu-week-heat-grid" style="display:grid; grid-template-columns: minmax(84px, 1.2fr) repeat(7, minmax(52px, 1fr)) minmax(76px, 1fr); gap:6px; align-items:stretch;">
          ${weekHeatHeader}
          ${weekHeatRows}
        </div>
      `;

      const trendHtml = `
        <div>
          <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">每日调用趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelUsageTrendCanvas"></canvas>
          </div>
          <h4 style="margin: 16px 0 12px; font-size: 0.95em; color: var(--text-primary);">每日 Token 趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelTokenTrendCanvas"></canvas>
          </div>
          <div style="margin-top: 14px; padding: 12px; border-radius: 10px; border: 1px solid rgba(59,130,246,0.15); background: rgba(59,130,246,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                <h4 style="margin: 0; font-size: 0.9em; color: var(--text-primary);">🔥 时段热力（按自然周内日）</h4>
                <span style="font-size:0.72em; color:var(--text-secondary);">展示最近 ${Math.max(weekRows.length, 1)} 个自然周</span>
              </div>
              ${weekHeatGridHtml}
          </div>
        </div>
      `;

      if (requestSeq !== this._modelUsageRequestSeq) return;
      container.innerHTML = summaryHtml + insightsHtml + commandCenterHtml + modelTokensHtml + tokenEfficiencyHtml + agentModelInsightsBlockHtml + middleHtml + trendHtml;

      const dimBtns = container.querySelectorAll('.dim-btn');
      dimBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const dim = e.target.dataset.dimension;
          if (dim && dim !== this.modelTokenDimension) {
            this.modelTokenDimension = dim;
            this.updateModelUsageStats();
          }
        });
      });

      if (chartsManager && data.byDay && data.byDay.length > 0) {
        chartsManager.renderModelUsageTrend(data);
        chartsManager.renderModelTokenTrend(data);
      }
      if (window._dragDrop && window._dragDrop.layoutMasonry) window._dragDrop.layoutMasonry();
    } catch (error) {
      console.error('更新模型使用量统计失败:', error);
      container.innerHTML = '<div class="empty-state" style="color: var(--error);">加载模型使用量失败</div>';
    }
  }
  // --- Skill Usage Stats ---
  async updateSkillUsageStats() {
    const container = document.getElementById('skillUsageStats');
    if (!container) return;
    const rangeSelect = document.getElementById('skillUsageRange');
    const selectedValue = rangeSelect ? rangeSelect.value : '7';
    const daysParam = selectedValue ? `days=${selectedValue}` : '';
    if (rangeSelect && !rangeSelect._bound) {
      rangeSelect._bound = true;
      rangeSelect.addEventListener('change', () => { this.panelRefreshState.skillUsage = 0; this.updateSkillUsageStats(); });
    }
    try {
      const data = await fetchJson(`/api/skills/usage?${daysParam}`);
      const summary = data.summary || {};
      const reads = data.skillReads || [];
      const execs = data.skillExecs || [];
      const findings = data.findings || [];
      const summaryCards = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom: 14px;">
        <div style="padding:12px; border-radius:10px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#3b82f6;">${(summary.totalToolCalls || 0).toLocaleString()}</div><div style="font-size:0.78em; color:var(--text-secondary);">总工具调用</div></div>
        <div style="padding:12px; border-radius:10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#10b981;">${(summary.skillReads || 0).toLocaleString()}</div><div style="font-size:0.78em; color:var(--text-secondary);">技能说明读取</div></div>
        <div style="padding:12px; border-radius:10px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#8b5cf6;">${(summary.skillExecs || 0).toLocaleString()}</div><div style="font-size:0.78em; color:var(--text-secondary);">技能实际执行</div></div>
        <div style="padding:12px; border-radius:10px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); text-align:center;"><div style="font-size:1.35em; font-weight:700; color:#f59e0b;">${summary.execSkillUsageRate || 0}%</div><div style="font-size:0.78em; color:var(--text-secondary);">exec技能命中率</div></div>
      </div>`;
      const renderList = (arr, emptyText) => {
        if (!arr || arr.length === 0) return `<div class="empty-state">${emptyText}</div>`;
        return arr.slice(0, 8).map(item => `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-secondary); border-radius:8px; margin-bottom:6px;"><span style="font-size:0.86em; color:var(--text-primary);">${escapeHtml(item.name)}</span><span style="font-size:0.82em; color:var(--text-secondary); font-weight:600;">${item.count}</span></div>`).join('');
      };
      const findingsHtml = findings.length > 0
        ? `<div style="margin-top:12px; padding:10px; border-radius:10px; border:1px solid rgba(239,68,68,0.18); background:rgba(239,68,68,0.04);"><div style="font-size:0.84em; font-weight:600; color:#ef4444; margin-bottom:6px;">⚠️ 待改进</div>${findings.map(f => `<div style="font-size:0.8em; color:var(--text-secondary); margin-bottom:4px;">• ${escapeHtml(f)}</div>`).join('')}</div>`
        : `<div style="margin-top:12px; padding:10px; border-radius:10px; border:1px solid rgba(16,185,129,0.18); background:rgba(16,185,129,0.04); font-size:0.82em; color:#10b981;">✅ 统计窗口内未发现技能使用缺口</div>`;
      container.innerHTML = `${summaryCards}<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;"><div style="padding:12px; border-radius:10px; border:1px solid rgba(59,130,246,0.18); background:rgba(59,130,246,0.03);"><div style="font-size:0.9em; font-weight:600; color:var(--text-primary); margin-bottom:8px;">📘 技能说明读取</div>${renderList(reads, '暂无读取记录')}</div><div style="padding:12px; border-radius:10px; border:1px solid rgba(139,92,246,0.18); background:rgba(139,92,246,0.03);"><div style="font-size:0.9em; font-weight:600; color:var(--text-primary); margin-bottom:8px;">⚙️ 技能实际执行</div>${renderList(execs, '暂无执行记录')}</div></div>${findingsHtml}`;
      if (window._dragDrop && window._dragDrop.layoutMasonry) window._dragDrop.layoutMasonry();
    } catch (error) {
      console.error('更新技能使用统计失败:', error);
      container.innerHTML = '<div class="empty-state" style="color: var(--error);">加载技能统计失败</div>';
    }
  }

  // --- Logs ---
  updateLogs() {
    if (this._logUpdatePending) return;
    this._logUpdatePending = true;
    this.addTimeout(async () => {
      try {
        const container = document.getElementById('logContainer');
        if (!container) { this._logUpdatePending = false; return; }
        const logs = await fetchJson('/api/logs/recent?count=50');
        if (window._searchManager) {
          window._searchManager.updateLogsCache(logs);
        } else {
          if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无日志记录</div>';
          } else {
            const html = logs.map(log => {
              const levelClass = log.level === 'error' ? 'log-error' : log.level === 'warn' ? 'log-warn' : 'log-info';
              const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
              return `<div class="log-entry ${levelClass}"><span class="log-time">${time}</span>${escapeHtml(log.message)}</div>`;
            }).join('');
            const wasBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
            container.innerHTML = html;
            if (this.autoScroll && wasBottom) container.scrollTop = container.scrollHeight;
          }
        }
      } catch (error) {
        console.error('更新日志失败:', error);
        const container = document.getElementById('logContainer');
        if (container && !container.querySelector('.log-entry')) {
          container.innerHTML = '<div class="empty-state">暂无日志记录</div>';
        }
      } finally {
        this._logUpdatePending = false;
      }
    }, 500);
  }

  // --- Sidebar Panels ---
  async _updateResourcesPanel() {
    const panel = document.getElementById('resourcesContent');
    if (!panel) return;
    try {
      const resources = await fetchJson('/api/system/resources');
      const sys = resources && resources.system;
      if (!sys || !sys.cpu || !sys.memory || !sys.disk || !sys.network) {
        panel.innerHTML = '<div class="empty-state">资源数据不可用</div>';
        return;
      }
      panel.innerHTML = `<div class="stats-grid"><div class="stat-card"><div class="stat-value">${(sys.cpu.usage ?? 0).toFixed(1)}%</div><div class="stat-label">CPU使用率</div></div><div class="stat-card"><div class="stat-value">${(sys.memory.percent ?? 0).toFixed(1)}%</div><div class="stat-label">内存使用率</div></div><div class="stat-card"><div class="stat-value">${(sys.disk.percent ?? 0).toFixed(1)}%</div><div class="stat-label">磁盘使用率</div></div></div><div style="margin-top: 20px;"><h3 style="margin-bottom: 10px;">详细信息</h3><div class="status-item"><span class="status-label">CPU核心数</span><span class="status-value">${sys.cpu.cores ?? '--'}</span></div><div class="status-item"><span class="status-label">总内存</span><span class="status-value">${(sys.memory.total ?? 0).toFixed(0)} MB</span></div><div class="status-item"><span class="status-label">已用内存</span><span class="status-value">${(sys.memory.used ?? 0).toFixed(0)} MB</span></div><div class="status-item"><span class="status-label">总磁盘</span><span class="status-value">${(sys.disk.total ?? 0).toFixed(1)} GB</span></div><div class="status-item"><span class="status-label">已用磁盘</span><span class="status-value">${(sys.disk.used ?? 0).toFixed(1)} GB</span></div><div class="status-item"><span class="status-label">网络输入</span><span class="status-value">${(sys.network.input ?? 0).toFixed(2)} MB</span></div><div class="status-item"><span class="status-label">网络输出</span><span class="status-value">${(sys.network.output ?? 0).toFixed(2)} MB</span></div></div>`;
    } catch (error) { console.error('更新资源监控失败:', error); }
  }

  async _updateAlertsPanel() {
    const panel = document.getElementById('alertsContent');
    if (!panel) return;
    try {
      const [active, history] = await Promise.all([
        fetch('/api/alerts/active').then(r => r.ok ? r.json() : []),
        fetch('/api/alerts/history?limit=20').then(r => r.ok ? r.json() : [])
      ]);
      let html = '<h3 style="margin-bottom: 15px;">活跃告警</h3>';
      if (active.length === 0) { html += '<div class="empty-state">暂无活跃告警</div>'; }
      else {
        html += '<div class="compact-list">';
        active.forEach(alert => {
          const sc = alert.severity === 'critical' ? 'badge-red' : alert.severity === 'warning' ? 'badge-yellow' : 'badge-blue';
          html += `<div class="compact-list-item"><div><span class="badge ${sc}">${escapeHtml(alert.severity)}</span><strong style="margin-left: 10px;">${escapeHtml(alert.ruleName)}</strong></div><div style="font-size: 0.85em; color: var(--text-secondary);">${new Date(alert.timestamp).toLocaleString('zh-CN')}</div></div>`;
        });
        html += '</div>';
      }
      html += '<h3 style="margin-top: 30px; margin-bottom: 15px;">告警历史</h3>';
      if (history.length === 0) { html += '<div class="empty-state">暂无告警历史</div>'; }
      else {
        html += '<div class="compact-list">';
        history.slice(0, 10).forEach(alert => {
          const sc = alert.severity === 'critical' ? 'badge-red' : alert.severity === 'warning' ? 'badge-yellow' : 'badge-blue';
          const resolved = alert.resolved ? '<span class="badge badge-green">已解决</span>' : '';
          html += `<div class="compact-list-item"><div><span class="badge ${sc}">${escapeHtml(alert.severity)}</span><strong style="margin-left: 10px;">${escapeHtml(alert.ruleName)}</strong>${resolved}</div><div style="font-size: 0.85em; color: var(--text-secondary);">${new Date(alert.timestamp).toLocaleString('zh-CN')}</div></div>`;
        });
        html += '</div>';
      }
      panel.innerHTML = html;
    } catch (error) { console.error('更新告警面板失败:', error); }
  }

  async _updateStatisticsPanel() {
    const panel = document.getElementById('statisticsContent');
    if (!panel) return;
    try {
      const [today, week, month] = await Promise.all([
        fetch('/api/statistics?range=today').then(r => r.ok ? r.json() : null),
        fetch('/api/statistics?range=week').then(r => r.ok ? r.json() : null),
        fetch('/api/statistics?range=month').then(r => r.ok ? r.json() : null)
      ]);
      const renderCard = (label, data) => data ? `<div class="card compact"><h3 style="margin-bottom: 15px;">${label}</h3><div class="stat-card"><div class="stat-value">${data.tasks.total}</div><div class="stat-label">任务总数</div></div><div class="stat-card"><div class="stat-value">${data.messages?.total || 0}</div><div class="stat-label">消息总数</div></div></div>` : '';
      panel.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">${renderCard('今日统计', today)}${renderCard('本周统计', week)}${renderCard('本月统计', month)}</div>`;
    } catch (error) { console.error('更新统计面板失败:', error); }
  }

  async _updateMessagesPanel() {
    const panel = document.getElementById('messagesContent');
    if (!panel) return;
    try {
      const data = await fetchJson('/api/messages/stream?limit=50&compact=1');
      if (data.messages.length === 0) { panel.innerHTML = '<div class="empty-state">暂无消息</div>'; return; }
      const html = data.messages.map(msg => `
        <div class="message-item message-${msg.role || 'user'}">
          <div class="message-header"><span class="message-role">${escapeHtml(msg.agentName || '系统')}</span><span class="message-time">${new Date(msg.timestamp).toLocaleString('zh-CN')}</span></div>
          <div class="message-content">${escapeHtml(msg.content || msg.text || '')}</div>
        </div>`).join('');
      panel.innerHTML = `<div class="messages-container">${html}</div>`;
    } catch (error) { console.error('更新消息流失败:', error); }
  }
}

// ============================================================
// Bootstrap
// ============================================================
const modules = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Notification center
  const nc = new NotificationCenter();
  nc.init();
  window._notificationCenter = nc;
  modules.push(nc);

  // Dashboard
  const dashboard = new Dashboard();
  window.dashboard = dashboard; // backward compat for search.js etc
  modules.push(dashboard);
  await dashboard.init();

  // Lazy-load UI enhancements
  requestIdleCallback(async () => {
    const [{ ThemeManager }, { FullscreenManager }, { KeyboardShortcuts }, { DragDropManager }, { MobileNavManager }] = await Promise.all([
      import('./ui/theme.js'),
      import('./ui/fullscreen.js'),
      import('./ui/keyboard-shortcuts.js'),
      import('./ui/drag-drop.js'),
      import('./ui/mobile-nav.js')
    ]);

    const theme = new ThemeManager();
    theme.loadTheme();
    theme.setupThemeToggle();
    modules.push(theme);

    const fs = new FullscreenManager();
    fs.setup();
    modules.push(fs);

    const kb = new KeyboardShortcuts({ fullscreenManager: fs, themeManager: theme });
    kb.setup();
    modules.push(kb);

    const dd = new DragDropManager();
    dd.setupDragAndDrop();
    window._dragDrop = dd;
    modules.push(dd);

    const mn = new MobileNavManager();
    mn.setup();
    modules.push(mn);
  });

  // Lazy-load search and sidebar
  const [{ SearchManager }, { SidebarManager }] = await Promise.all([
    import('./components/search.js'),
    import('./components/sidebar.js')
  ]);

  const search = new SearchManager();
  search.init();
  search.setDashboardData(dashboard.data);
  window._searchManager = search;
  window.searchManager = search; // backward compat
  modules.push(search);

  const sidebar = new SidebarManager();
  window._sidebarManager = sidebar;
  window.sidebarManager = sidebar;
  modules.push(sidebar);

  // Lazy-load detail components
  const [{ showAgentDetail }, { showTaskDetail }] = await Promise.all([
    import('./components/agent-detail.js'),
    import('./components/task-detail.js')
  ]);
  window.showAgentDetail = showAgentDetail;
  window.showTaskDetail = showTaskDetail;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  modules.forEach(m => { if (m.dispose) m.dispose(); });
});
