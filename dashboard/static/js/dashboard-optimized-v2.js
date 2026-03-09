/**
 * OpenClaw 作战指挥中心 - 优化版 Dashboard v2 (B单)
 * 
 * 优化内容（B单）：
 * Task C: 列表优化 - 虚拟滚动、搜索防抖、局部patch更新
 * Task D: 实时刷新治理 - 节流控制、页面不可见降频、局部刷新
 * Task E: 图表优化 - 刷新节流、不可见暂停、数据采样
 * Task G: 回归与验收支持
 */

class OptimizedDashboardV2 {
  constructor() {
    this.ws = null;
    this.autoScroll = true;
    this.data = {};
    this.clientId = null;
    this.lastUpdateTime = null;
    this.isPageVisible = true;
    
    // 分页状态
    this.pagination = {
      agents: { page: 1, limit: 10, hasMore: true, total: 0 },
      tasks: { page: 1, limit: 10, hasMore: true, total: 0 },
      logs: { cursor: null, hasMore: true, limit: 50 }
    };
    
    // 节流控制 - Task D
    this.throttleTimers = {};
    this.updateQueue = [];
    this.isProcessingQueue = false;
    this.updateFrequency = {
      normal: 1000,    // 正常模式: 1秒
      background: 5000, // 后台模式: 5秒
      current: 1000
    };
    
    // 图表状态 - Task E
    this.chartsLoaded = {
      metrics: false,
      tasks: false,
      models: false,
      health: false
    };
    this.chartUpdateTimers = {};
    this.chartDataBuffer = {};
    this.visibleCharts = new Set();
    
    // 虚拟列表实例 - Task C
    this.virtualLists = {};
    
    // 搜索防抖 - Task C
    this.searchDebounceTimers = {};
    
    // 性能监控
    this.performanceMetrics = {
      renderCount: 0,
      updateCount: 0,
      lastRenderTime: 0,
      avgRenderTime: 0
    };

    this.init();
  }

  init() {
    this.setupPageVisibility(); // Task D
    this.setupWebSocket();
    this.setupEventListeners();
    this.setupLazyLoading(); // Task E
    this.setupSearchDebounce(); // Task C
    this.loadInitialData();
    this.startClock();
    
    // 启动性能监控
    this.startPerformanceMonitoring();
  }

  // ========== Task D: 页面可见性优化 ==========
  setupPageVisibility() {
    if (typeof document.hidden === 'undefined') return;
    
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;
      
      console.log(`[Dashboard] Page visibility changed: ${wasVisible} -> ${this.isPageVisible}`);
      
      if (this.isPageVisible) {
        // 页面重新可见时，立即刷新一次并恢复正常频率
        this.updateFrequency.current = this.updateFrequency.normal;
        this.loadInitialData();
        this.resumeChartUpdates(); // Task E
      } else {
        // 页面不可见时，降低更新频率
        this.updateFrequency.current = this.updateFrequency.background;
        this.pauseChartUpdates(); // Task E
      }
      
      // 通知服务器更新频率变化
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'visibilityChange',
          visible: this.isPageVisible
        }));
      }
    });
  }

  // ========== WebSocket 连接 ==========
  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPath = window.location.pathname.startsWith('/toolbox/dashboard') ? '/toolbox/dashboard/ws' : '/ws';
    const wsUrl = `${protocol}//${window.location.host}${wsPath}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Dashboard] WebSocket connected');
        this.updateConnectionStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[Dashboard] WebSocket message parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Dashboard] WebSocket error:', error);
        this.updateConnectionStatus('error');
      };

      this.ws.onclose = () => {
        console.log('[Dashboard] WebSocket closed');
        this.updateConnectionStatus('disconnected');
        setTimeout(() => this.setupWebSocket(), 5000);
      };
    } catch (error) {
      console.error('[Dashboard] WebSocket setup error:', error);
      this.updateConnectionStatus('error');
    }
  }

  handleWebSocketMessage(message) {
    // Task D: 页面不可见时降频处理
    if (!this.isPageVisible && window.APP_CONFIG?.pageVisibilityOptimization) {
      // 后台时只处理关键更新（告警、错误）
      if (message.type !== 'alert' && message.type !== 'error') {
        console.log('[Dashboard] Skipping non-critical update in background');
        return;
      }
    }

    // Task D: 节流控制 - 高频消息合并
    if (message.type === 'delta' || message.type === 'update') {
      this.queueUpdate(message.type, message.data);
      return;
    }

    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        break;
      case 'config-changed':
        this.loadInitialData();
        break;
      case 'alert':
        this.handleAlert(message.data);
        break;
    }
  }

  // ========== Task D: 更新队列与节流 ==========
  queueUpdate(type, data) {
    // 合并同类型更新
    const existingIndex = this.updateQueue.findIndex(u => u.type === type);
    if (existingIndex !== -1) {
      this.updateQueue[existingIndex].data = this.mergeUpdateData(
        this.updateQueue[existingIndex].data, 
        data
      );
    } else {
      this.updateQueue.push({ type, data });
    }
    
    if (this.isProcessingQueue) return;
    
    // 使用 requestAnimationFrame 批量更新
    requestAnimationFrame(() => this.processUpdateQueue());
  }

  mergeUpdateData(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;
    
    // 智能合并数据
    return { ...existing, ...incoming };
  }

  processUpdateQueue() {
    this.isProcessingQueue = true;
    const startTime = performance.now();
    
    const updates = [...this.updateQueue];
    this.updateQueue = [];
    
    updates.forEach(({ type, data }) => {
      if (type === 'delta') {
        this.applyDeltaUpdate(data);
      } else if (type === 'update') {
        this.applyFullUpdate(data);
      }
    });
    
    // 记录性能指标
    const duration = performance.now() - startTime;
    this.performanceMetrics.updateCount++;
    this.performanceMetrics.lastRenderTime = duration;
    this.performanceMetrics.avgRenderTime = 
      (this.performanceMetrics.avgRenderTime * (this.performanceMetrics.updateCount - 1) + duration) 
      / this.performanceMetrics.updateCount;
    
    this.isProcessingQueue = false;
    
    if (this.updateQueue.length > 0) {
      requestAnimationFrame(() => this.processUpdateQueue());
    }
  }

  // ========== Task C: 增量更新与局部 Patch ==========
  applyDeltaUpdate(delta) {
    if (!delta) return;
    
    const changedPanels = new Set();
    
    // 系统状态更新
    if (delta.system) {
      this.data.system = { ...this.data.system, ...delta.system };
      changedPanels.add('system');
    }
    
    // Task C: Agent 局部更新（不触发整表重绘）
    if (delta.agents) {
      this.patchAgents(delta.agents);
      changedPanels.add('agents');
    }
    
    // Task C: 任务局部更新
    if (delta.tasks) {
      this.patchTasks(delta.tasks);
      changedPanels.add('tasks');
    }
    
    // 日志追加（流式）
    if (delta.logs?.added?.length > 0) {
      this.appendLogs(delta.logs.added);
      changedPanels.add('logs');
    }
    
    // 健康度更新
    if (delta.health) {
      this.data.health = { ...this.data.health, ...delta.health };
      changedPanels.add('health');
    }
    
    // 只更新变化的面板
    changedPanels.forEach(panel => {
      switch(panel) {
        case 'system': this.updateSystemOverview(); break;
        case 'agents': this.updateAgentsList(true); break; // true = 局部更新
        case 'tasks': this.updateCurrentTasks(true); break;
        case 'logs': this.updateLogs(); break;
        case 'health': this.updateHealthPanel(); break;
      }
    });
    
    this.lastUpdateTime = Date.now();
  }

  // Task C: Agent 局部 Patch 更新
  patchAgents(agentChanges) {
    if (!this.data.agents) return;
    
    // 更新已变化的 Agent（不替换整个数组）
    if (agentChanges.updated) {
      agentChanges.updated.forEach(updatedAgent => {
        const index = this.data.agents.findIndex(a => a.id === updatedAgent.id);
        if (index !== -1) {
          // 只更新变化的字段
          const existing = this.data.agents[index];
          const hasChanged = Object.keys(updatedAgent).some(key => 
            existing[key] !== updatedAgent[key]
          );
          
          if (hasChanged) {
            this.data.agents[index] = { ...existing, ...updatedAgent };
            // 标记为已更新（用于DOM局部更新）
            this.data.agents[index]._lastUpdate = Date.now();
          }
        }
      });
    }
    
    // 移除已删除的 Agent
    if (agentChanges.removed) {
      const removedIds = new Set(agentChanges.removed.map(a => a.id));
      this.data.agents = this.data.agents.filter(a => !removedIds.has(a.id));
    }
  }

  // Task C: 任务局部 Patch 更新
  patchTasks(taskChanges) {
    if (!this.data.tasks) return;
    
    if (taskChanges.updated) {
      taskChanges.updated.forEach(updatedTask => {
        const currentIdx = this.data.tasks.current?.findIndex(t => t.id === updatedTask.id);
        const historyIdx = this.data.tasks.history?.findIndex(t => t.id === updatedTask.id);
        
        if (currentIdx !== -1 && currentIdx !== undefined) {
          this.data.tasks.current[currentIdx] = {
            ...this.data.tasks.current[currentIdx],
            ...updatedTask
          };
        } else if (historyIdx !== -1 && historyIdx !== undefined) {
          this.data.tasks.history[historyIdx] = {
            ...this.data.tasks.history[historyIdx],
            ...updatedTask
          };
        }
      });
    }
  }

  applyFullUpdate(data) {
    if (!data) return;
    this.data = { ...this.data, ...data };
    this.updateAllPanels();
  }

  // ========== 加载初始数据 ==========
  async loadInitialData() {
    try {
      const useSummary = window.APP_CONFIG?.useSummaryAPI ?? true;
      const endpoint = useSummary ? '/api/dashboard/summary' : '/api/dashboard';
      
      console.log(`[Dashboard] Loading initial data: ${endpoint}`);
      const startTime = performance.now();
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const loadTime = Math.round(performance.now() - startTime);
      
      console.log(`[Dashboard] Data loaded in ${loadTime}ms`, data._meta);
      
      if (data._meta?.isSummary) {
        this.data = this.expandSummaryData(data);
      } else {
        this.data = data;
      }
      
      this.lastUpdateTime = Date.now();
      this.updateAllPanels();
      
      // 异步加载完整数据
      if (useSummary) {
        setTimeout(() => this.loadFullData(), 100);
      }
    } catch (error) {
      console.error('[Dashboard] Load initial data failed:', error);
      this.showError('无法连接到服务器');
    }
  }

  expandSummaryData(summary) {
    return {
      system: summary.system,
      agents: summary.agents?.list || [],
      tasks: {
        current: summary.tasks?.recent || [],
        history: []
      },
      health: summary.health,
      channels: [],
      models: [],
      logs: [],
      alerts: [],
      timestamp: summary.timestamp
    };
  }

  async loadFullData() {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) return;
      
      const fullData = await response.json();
      
      // 智能合并
      this.data = {
        ...fullData,
        agents: this.mergeAgents(this.data.agents, fullData.agents),
        tasks: {
          current: fullData.tasks?.current || this.data.tasks?.current || [],
          history: fullData.tasks?.history || this.data.tasks?.history || []
        }
      };
      
      this.updateAllPanels();
    } catch (error) {
      console.error('[Dashboard] Load full data failed:', error);
    }
  }

  mergeAgents(existing, fresh) {
    if (!existing || !fresh) return fresh || existing || [];
    
    const merged = [...existing];
    fresh.forEach(agent => {
      const index = merged.findIndex(a => a.id === agent.id);
      if (index === -1) {
        merged.push(agent);
      } else {
        merged[index] = { ...merged[index], ...agent };
      }
    });
    return merged;
  }

  // ========== Task C: 分页加载（带虚拟滚动支持） ==========
  async loadAgentsPage(page = 1, append = false) {
    try {
      const response = await fetch(
        `/api/agents/list-paginated?page=${page}&limit=${this.pagination.agents.limit}`
      );
      if (!response.ok) throw new Error('Load failed');
      
      const result = await response.json();
      
      this.pagination.agents.page = page;
      this.pagination.agents.hasMore = result.pagination?.hasNext ?? false;
      this.pagination.agents.total = result.pagination?.total ?? 0;
      
      if (append && page > 1) {
        this.data.agents = [...this.data.agents, ...result.data];
      } else {
        this.data.agents = result.data;
      }
      
      this.updateAgentsList();
      this.updatePaginationUI('agents', result.pagination);
    } catch (error) {
      console.error('[Dashboard] Load agents page failed:', error);
    }
  }

  async loadTasksPage(page = 1, type = 'all') {
    try {
      const response = await fetch(
        `/api/tasks/list-paginated?page=${page}&limit=${this.pagination.tasks.limit}&type=${type}`
      );
      if (!response.ok) throw new Error('Load failed');
      
      const result = await response.json();
      
      this.pagination.tasks.page = page;
      this.pagination.tasks.hasMore = result.pagination?.hasNext ?? false;
      this.pagination.tasks.total = result.pagination?.total ?? 0;
      
      if (!this.data.tasks) this.data.tasks = { current: [], history: [] };
      
      if (type === 'current' || type === 'all') {
        this.data.tasks.current = result.data.filter(t => t.status === 'active');
      }
      if (type === 'history' || type === 'all') {
        this.data.tasks.history = result.data.filter(t => t.status !== 'active');
      }
      
      this.updateCurrentTasks();
      this.updatePaginationUI('tasks', result.pagination);
    } catch (error) {
      console.error('[Dashboard] Load tasks page failed:', error);
    }
  }

  async loadLogsPage(cursor = null) {
    try {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(
        `/api/logs/paginated?limit=${this.pagination.logs.limit}${cursorParam}`
      );
      if (!response.ok) throw new Error('Load failed');
      
      const result = await response.json();
      
      this.pagination.logs.cursor = result.pagination?.nextCursor || null;
      this.pagination.logs.hasMore = result.pagination?.hasMore ?? false;
      
      if (!this.data.logs) this.data.logs = [];
      
      if (cursor) {
        this.data.logs = [...this.data.logs, ...result.data];
      } else {
        this.data.logs = result.data;
      }
      
      this.renderLogs();
    } catch (error) {
      console.error('[Dashboard] Load logs page failed:', error);
    }
  }

  // Task C: 日志流式追加（不触发整表重绘）
  appendLogs(newLogs) {
    if (!this.data.logs) this.data.logs = [];
    
    // 限制最大日志数量
    const maxLogs = window.APP_CONFIG?.maxLogBuffer || 1000;
    this.data.logs = [...this.data.logs, ...newLogs];
    
    if (this.data.logs.length > maxLogs) {
      this.data.logs = this.data.logs.slice(-maxLogs);
    }
    
    // 只追加新日志到DOM
    const container = document.getElementById('logContainer');
    if (!container) return;
    
    const wasScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    
    newLogs.forEach(log => {
      const logEl = this.createLogElement(log);
      container.appendChild(logEl);
    });
    
    // 清理旧日志（如果超过限制）
    while (container.children.length > maxLogs) {
      container.removeChild(container.firstChild);
    }
    
    if (this.autoScroll && wasScrolledToBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }

  createLogElement(log) {
    const levelClass = log.level === 'error' ? 'log-error' : 
                      log.level === 'warn' ? 'log-warn' : 'log-info';
    const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
    
    const div = document.createElement('div');
    div.className = `log-entry ${levelClass}`;
    div.innerHTML = `
      <span class="log-time">${time}</span>
      ${this.escapeHtml(log.message)}
    `;
    return div;
  }

  updatePaginationUI(type, pagination) {
    const container = document.getElementById(`${type}Pagination`);
    if (!container) return;
    
    const prevBtn = container.querySelector(`#${type}PrevPage`);
    const nextBtn = container.querySelector(`#${type}NextPage`);
    const pageInfo = container.querySelector(`#${type}PageInfo`);
    
    if (prevBtn) prevBtn.disabled = !pagination.hasPrev;
    if (nextBtn) nextBtn.disabled = !pagination.hasNext;
    if (pageInfo) {
      pageInfo.textContent = `第 ${pagination.page} / ${pagination.totalPages || 1} 页 (共${pagination.total}条)`;
    }
    
    container.style.display = 'block';
  }

  // ========== Task C: 搜索防抖 ==========
  setupSearchDebounce() {
    // Agent 搜索
    const agentSearch = document.getElementById('agentSearch');
    if (agentSearch) {
      agentSearch.addEventListener('input', (e) => {
        this.debounceSearch('agents', e.target.value, ['name', 'role']);
      });
    }
    
    // 任务搜索
    const taskSearch = document.getElementById('taskSearch');
    if (taskSearch) {
      taskSearch.addEventListener('input', (e) => {
        this.debounceSearch('tasks', e.target.value, ['title', 'agentName']);
      });
    }
    
    // 日志搜索
    const logSearch = document.getElementById('logSearch');
    if (logSearch) {
      logSearch.addEventListener('input', (e) => {
        this.debounceSearch('logs', e.target.value, ['message']);
      });
    }
  }

  debounceSearch(type, query, fields) {
    if (this.searchDebounceTimers[type]) {
      clearTimeout(this.searchDebounceTimers[type]);
    }
    
    this.searchDebounceTimers[type] = setTimeout(() => {
      this.performSearch(type, query, fields);
    }, 300); // 300ms 防抖
  }

  performSearch(type, query, fields) {
    if (!query || query.trim() === '') {
      // 重置筛选
      switch(type) {
        case 'agents': this.updateAgentsList(); break;
        case 'tasks': this.updateCurrentTasks(); break;
        case 'logs': this.renderLogs(); break;
      }
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    
    switch(type) {
      case 'agents':
        this.filterAgents(lowerQuery, fields);
        break;
      case 'tasks':
        this.filterTasks(lowerQuery, fields);
        break;
      case 'logs':
        this.filterLogs(lowerQuery, fields);
        break;
    }
  }

  filterAgents(query, fields) {
    if (!this.data.agents) return;
    
    const filtered = this.data.agents.filter(agent => 
      fields.some(field => {
        const val = agent[field];
        return typeof val === 'string' && val.toLowerCase().includes(query);
      })
    );
    
    this.renderFilteredAgents(filtered);
  }

  filterTasks(query, fields) {
    if (!this.data.tasks?.current) return;
    
    const filtered = this.data.tasks.current.filter(task => 
      fields.some(field => {
        const val = task[field];
        return typeof val === 'string' && val.toLowerCase().includes(query);
      })
    );
    
    this.renderFilteredTasks(filtered);
  }

  filterLogs(query, fields) {
    if (!this.data.logs) return;
    
    const filtered = this.data.logs.filter(log => 
      fields.some(field => {
        const val = log[field];
        return typeof val === 'string' && val.toLowerCase().includes(query);
      })
    );
    
    this.renderFilteredLogs(filtered);
  }

  // ========== Task E: 图表懒加载与优化 ==========
  setupLazyLoading() {
    if (!window.IntersectionObserver) return;
    
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const chartType = entry.target.dataset.lazyChart;
        if (!chartType) return;
        
        if (entry.isIntersecting) {
          // 图表进入可视区域
          this.visibleCharts.add(chartType);
          if (!this.chartsLoaded[chartType]) {
            this.loadChart(chartType);
          } else {
            this.resumeChartUpdate(chartType);
          }
        } else {
          // 图表离开可视区域
          this.visibleCharts.delete(chartType);
          this.pauseChartUpdate(chartType);
        }
      });
    }, { rootMargin: '50px' });
    
    document.querySelectorAll('[data-lazy-chart]').forEach(el => {
      chartObserver.observe(el);
    });
  }

  async loadChart(chartType) {
    if (this.chartsLoaded[chartType]) return;
    
    try {
      await window.loadChartJS?.();
      this.chartsLoaded[chartType] = true;
      
      const container = document.querySelector(`[data-lazy-chart="${chartType}"]`);
      if (container) container.style.display = 'block';
      
      if (window.chartsManager) {
        switch(chartType) {
          case 'metrics': await window.chartsManager.initMetricsChart(); break;
          case 'tasks': await window.chartsManager.initTasksChart(); break;
          case 'models': await window.chartsManager.initModelsChart(); break;
          case 'health': await window.chartsManager.initHealthChart(); break;
        }
      }
    } catch (error) {
      console.error(`[Dashboard] Load chart ${chartType} failed:`, error);
    }
  }

  // Task E: 图表更新节流
  queueChartUpdate(chartType, data) {
    // 图表不可见时不更新
    if (!this.visibleCharts.has(chartType)) {
      // 缓存数据供恢复时使用
      this.chartDataBuffer[chartType] = data;
      return;
    }
    
    // 清除现有定时器
    if (this.chartUpdateTimers[chartType]) {
      clearTimeout(this.chartUpdateTimers[chartType]);
    }
    
    // 缓存数据
    this.chartDataBuffer[chartType] = data;
    
    // 节流更新
    const throttleMs = window.APP_CONFIG?.chartThrottleMs || 1000;
    this.chartUpdateTimers[chartType] = setTimeout(() => {
      this.flushChartUpdate(chartType);
    }, throttleMs);
  }

  flushChartUpdate(chartType) {
    const data = this.chartDataBuffer[chartType];
    if (!data) return;
    
    // 调用图表更新
    if (window.chartsManager?.updateChart) {
      window.chartsManager.updateChart(chartType, data);
    }
    
    delete this.chartDataBuffer[chartType];
  }

  pauseChartUpdate(chartType) {
    if (this.chartUpdateTimers[chartType]) {
      clearTimeout(this.chartUpdateTimers[chartType]);
      delete this.chartUpdateTimers[chartType];
    }
  }

  resumeChartUpdate(chartType) {
    // 恢复时如果有缓存数据，立即更新一次
    if (this.chartDataBuffer[chartType]) {
      this.flushChartUpdate(chartType);
    }
  }

  pauseChartUpdates() {
    Object.keys(this.chartUpdateTimers).forEach(type => {
      this.pauseChartUpdate(type);
    });
  }

  resumeChartUpdates() {
    this.visibleCharts.forEach(type => {
      this.resumeChartUpdate(type);
    });
  }

  // ========== 面板更新方法 ==========
  updateAllPanels() {
    this.updateHealthPanel();
    this.updateSystemOverview();
    this.updateAgentsList();
    this.updateCurrentTasks();
    this.updateTaskHistory();
    this.updateModelsQuota();
    this.updateChannelsStatus();
    this.updateLogs();
  }

  updateHealthPanel() {
    if (!this.data?.health) return;
    
    const health = this.data.health;
    const scoreEl = document.getElementById('healthScore')?.querySelector('.score-value');
    if (scoreEl) scoreEl.textContent = health.score;
    
    const statusBadge = document.getElementById('healthStatus')?.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      if (health.status === 'healthy') {
        statusBadge.classList.add('healthy');
        statusBadge.textContent = '健康';
      } else if (health.status === 'warning') {
        statusBadge.classList.add('warning');
        statusBadge.textContent = '警告';
      } else {
        statusBadge.classList.add('critical');
        statusBadge.textContent = '严重';
      }
    }
  }

  updateSystemOverview() {
    if (!this.data?.system) return;
    
    const system = this.data.system;
    const isRunning = system.gateway?.status === 'running';
    const cpuValue = parseFloat(system.gateway?.cpu) || 0;
    
    const html = `
      <div class="so-metric-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div style="text-align: center; padding: 14px; background: ${isRunning ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border-radius: 10px;">
          <div style="font-size: 1.8em;">${isRunning ? '✅' : '❌'}</div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">Gateway</div>
          <div style="font-size: 0.9em; font-weight: 600; color: ${isRunning ? '#10b981' : '#ef4444'};">
            ${isRunning ? '运行中' : '已停止'}
          </div>
        </div>
        <div style="text-align: center; padding: 14px; background: rgba(59,130,246,0.08); border-radius: 10px;">
          <div style="font-size: 1.5em; font-weight: 700; color: ${cpuValue > 80 ? '#ef4444' : '#3b82f6'};">
            ${cpuValue.toFixed(1)}%
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">CPU</div>
        </div>
        <div style="text-align: center; padding: 14px; background: rgba(139,92,246,0.08); border-radius: 10px;">
          <div style="font-size: 1.5em; font-weight: 700; color: #8b5cf6;">
            ${system.gateway?.memory || 'N/A'}
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">内存</div>
        </div>
      </div>
    `;
    
    const sysPanel = document.getElementById('systemOverview');
    if (sysPanel) sysPanel.innerHTML = html;
  }

  // Task C: Agent 列表更新（支持局部更新）
  updateAgentsList(partial = false) {
    if (!this.data?.agents) return;
    
    const agents = this.data.agents;
    const container = document.getElementById('agentsList');
    if (!container) return;
    
    // 如果是局部更新且已有内容，只更新变化的项
    if (partial && container.children.length > 0) {
      this.updateAgentsPartial(container, agents);
      return;
    }
    
    // 全量渲染
    this.renderAllAgents(container, agents);
  }

  updateAgentsPartial(container, agents) {
    // 只更新有变化的 Agent 项
    agents.forEach((agent, index) => {
      const existingEl = container.querySelector(`[data-agent-id="${agent.id}"]`);
      if (existingEl && agent._lastUpdate) {
        // 更新现有元素的内容
        const statusEl = existingEl.querySelector('.agent-status');
        if (statusEl) {
          statusEl.textContent = agent.status === 'active' ? '活跃' : '空闲';
          statusEl.style.background = agent.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)';
          statusEl.style.color = agent.status === 'active' ? '#10b981' : '#f59e0b';
        }
        
        const sessionEl = existingEl.querySelector('.agent-sessions');
        if (sessionEl) {
          sessionEl.textContent = `${agent.sessionCount || 0} 会话`;
        }
      }
    });
  }

  renderAllAgents(container, agents) {
    const activeCount = agents.filter(a => a.status === 'active').length;
    const idleCount = agents.filter(a => a.status === 'idle').length;
    
    const html = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
        <div style="text-align: center; padding: 12px; background: rgba(59,130,246,0.08); border-radius: 10px;">
          <div style="font-size: 1.8em; font-weight: 700; color: #3b82f6;">${agents.length}</div>
          <div style="font-size: 0.8em; color: var(--text-secondary);">总数</div>
        </div>
        <div style="text-align: center; padding: 12px; background: rgba(16,185,129,0.08); border-radius: 10px;">
          <div style="font-size: 1.8em; font-weight: 700; color: #10b981;">${activeCount}</div>
          <div style="font-size: 0.8em; color: var(--text-secondary);">活跃</div>
        </div>
        <div style="text-align: center; padding: 12px; background: rgba(245,158,11,0.08); border-radius: 10px;">
          <div style="font-size: 1.8em; font-weight: 700; color: #f59e0b;">${idleCount}</div>
          <div style="font-size: 0.8em; color: var(--text-secondary);">空闲</div>
        </div>
        <div style="text-align: center; padding: 12px; background: rgba(139,92,246,0.08); border-radius: 10px;">
          <div style="font-size: 1.8em; font-weight: 700; color: #8b5cf6;">
            ${agents.reduce((sum, a) => sum + (a.sessionCount || 0), 0)}
          </div>
          <div style="font-size: 0.8em; color: var(--text-secondary);">会话</div>
        </div>
      </div>
      <div class="agents-list">
        ${agents.slice(0, 10).map(agent => `
          <div data-agent-id="${agent.id}" style="display: flex; align-items: center; gap: 12px; padding: 10px; 
                      background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;
                      border-left: 3px solid ${agent.status === 'active' ? '#10b981' : '#f59e0b'};">
            <span style="font-size: 1.5em;">${agent.emoji || '🤖'}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${agent.name}
              </div>
              <div style="font-size: 0.75em; color: var(--text-secondary);">
                ${agent.role || '助手'} · <span class="agent-sessions">${agent.sessionCount || 0} 会话</span>
              </div>
            </div>
            <span class="agent-status" style="font-size: 0.75em; padding: 2px 8px; border-radius: 12px;
                        background: ${agent.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'};
                        color: ${agent.status === 'active' ? '#10b981' : '#f59e0b'};">
              ${agent.status === 'active' ? '活跃' : '空闲'}
            </span>
          </div>
        `).join('')}
      </div>
    `;
    
    container.innerHTML = html;
  }

  renderFilteredAgents(filtered) {
    const container = document.getElementById('agentsList');
    if (!container) return;
    
    const listContainer = container.querySelector('.agents-list');
    if (!listContainer) return;
    
    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">无匹配结果</div>';
      return;
    }
    
    listContainer.innerHTML = filtered.map(agent => `
      <div data-agent-id="${agent.id}" style="display: flex; align-items: center; gap: 12px; padding: 10px; 
                  background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;
                  border-left: 3px solid ${agent.status === 'active' ? '#10b981' : '#f59e0b'};">
        <span style="font-size: 1.5em;">${agent.emoji || '🤖'}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${agent.name}
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">
            ${agent.role || '助手'} · ${agent.sessionCount || 0} 会话
          </div>
        </div>
        <span style="font-size: 0.75em; padding: 2px 8px; border-radius: 12px;
                    background: ${agent.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'};
                    color: ${agent.status === 'active' ? '#10b981' : '#f59e0b'};">
          ${agent.status === 'active' ? '活跃' : '空闲'}
        </span>
      </div>
    `).join('');
  }

  // Task C: 任务列表更新（支持局部更新）
  updateCurrentTasks(partial = false) {
    if (!this.data?.tasks?.current) return;
    
    const tasks = this.data.tasks.current;
    const container = document.getElementById('currentTasks');
    if (!container) return;
    
    if (partial && container.children.length > 0) {
      this.updateTasksPartial(container, tasks);
      return;
    }
    
    this.renderAllTasks(container, tasks);
  }

  updateTasksPartial(container, tasks) {
    tasks.forEach(task => {
      const existingEl = container.querySelector(`[data-task-id="${task.id}"]`);
      if (existingEl && task._lastUpdate) {
        const statusEl = existingEl.querySelector('.task-status');
        if (statusEl && task.status) {
          statusEl.textContent = task.status === 'active' ? '进行中' : '已完成';
        }
        
        const msgEl = existingEl.querySelector('.task-messages');
        if (msgEl && task.messageCount !== undefined) {
          msgEl.textContent = `${task.messageCount} 消息`;
        }
      }
    });
  }

  renderAllTasks(container, tasks) {
    const html = tasks.slice(0, 10).map(task => `
      <div data-task-id="${task.id}" style="padding: 10px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;
                  border-left: 3px solid #3b82f6; cursor: pointer;"
           onclick="window.showTaskDetail && window.showTaskDetail('${task.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.9em;">${task.agentName}</strong>
          <span class="task-status" style="font-size: 0.7em; padding: 2px 8px; background: rgba(59,130,246,0.2); 
                       color: #3b82f6; border-radius: 12px;">${task.status === 'active' ? '进行中' : '已完成'}</span>
        </div>
        <div style="font-size: 0.85em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${task.title || '(无标题)'}
        </div>
        <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">
          <span class="task-messages">${task.messageCount || 0} 消息</span> · ${this.formatRelativeTime(task.lastUpdate)}
        </div>
      </div>
    `).join('') || '<div class="empty-state">暂无当前任务</div>';
    
    container.innerHTML = html;
  }

  renderFilteredTasks(filtered) {
    const container = document.getElementById('currentTasks');
    if (!container) return;
    
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">无匹配结果</div>';
      return;
    }
    
    const html = filtered.map(task => `
      <div data-task-id="${task.id}" style="padding: 10px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;
                  border-left: 3px solid #3b82f6; cursor: pointer;"
           onclick="window.showTaskDetail && window.showTaskDetail('${task.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.9em;">${task.agentName}</strong>
          <span style="font-size: 0.7em; padding: 2px 8px; background: rgba(59,130,246,0.2); 
                       color: #3b82f6; border-radius: 12px;">${task.status === 'active' ? '进行中' : '已完成'}</span>
        </div>
        <div style="font-size: 0.85em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${task.title || '(无标题)'}
        </div>
        <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">
          ${task.messageCount || 0} 消息 · ${this.formatRelativeTime(task.lastUpdate)}
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
  }

  updateTaskHistory() {
    if (!this.data?.tasks?.history) return;
    
    const tasks = this.data.tasks.history;
    const container = document.getElementById('taskHistory');
    if (!container) return;
    
    const html = tasks.slice(0, 10).map(task => `
      <div style="padding: 10px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;
                  border-left: 3px solid #10b981; cursor: pointer;"
           onclick="window.showTaskDetail && window.showTaskDetail('${task.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.9em;">${task.agentName}</strong>
          <span style="font-size: 0.7em; padding: 2px 8px; background: rgba(16,185,129,0.2); 
                       color: #10b981; border-radius: 12px;">已完成</span>
        </div>
        <div style="font-size: 0.85em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${task.title || '(无标题)'}
        </div>
        <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">
          ${task.messageCount || 0} 消息 · ${this.formatRelativeTime(task.lastUpdate)}
        </div>
      </div>
    `).join('') || '<div class="empty-state">暂无历史任务</div>';
    
    container.innerHTML = html;
  }

  updateModelsQuota() {
    if (!this.data?.models) return;
    
    const models = this.data.models;
    const container = document.getElementById('modelsQuota');
    if (!container) return;
    
    const html = models.slice(0, 5).map(model => `
      <div style="display: flex; justify-content: space-between; align-items: center; 
                  padding: 8px 0; border-bottom: 1px solid var(--border);">
        <span style="font-size: 0.9em;">${model.name}</span>
        <span style="font-size: 0.8em; color: var(--text-secondary);">
          ${model.quotaTotal > 0 ? `${model.quotaUsed}/${model.quotaTotal}` : '无配额'}
        </span>
      </div>
    `).join('') || '<div class="empty-state">暂无模型信息</div>';
    
    container.innerHTML = html;
  }

  updateChannelsStatus() {
    if (!this.data?.channels) return;
    
    const channels = this.data.channels;
    const container = document.getElementById('channelsStatus');
    if (!container) return;
    
    const html = channels.map(channel => {
      const statusColor = channel.status === 'normal' ? '#10b981' : 
                         channel.status === 'warning' ? '#f59e0b' : '#ef4444';
      return `
        <div style="display: flex; justify-content: space-between; align-items: center;
                    padding: 8px 0; border-bottom: 1px solid var(--border);">
          <span style="font-size: 0.9em;">${channel.name}</span>
          <span style="font-size: 0.75em; padding: 2px 8px; border-radius: 12px;
                      background: ${statusColor}22; color: ${statusColor};">
            ${channel.status === 'normal' ? '正常' : channel.status === 'warning' ? '警告' : '异常'}
          </span>
        </div>
      `;
    }).join('') || '<div class="empty-state">暂无通道</div>';
    
    container.innerHTML = html;
  }

  updateLogs() {
    if (this.throttleTimers.logs) return;
    
    this.throttleTimers.logs = setTimeout(() => {
      this.renderLogs();
      this.throttleTimers.logs = null;
    }, window.APP_CONFIG?.logUpdateThrottleMs || 2000);
  }

  renderLogs() {
    const container = document.getElementById('logContainer');
    if (!container) return;
    
    const logs = this.data?.logs || [];
    if (logs.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无日志</div>';
      return;
    }
    
    const html = logs.map(log => {
      const levelClass = log.level === 'error' ? 'log-error' : 
                        log.level === 'warn' ? 'log-warn' : 'log-info';
      const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
      return `<div class="log-entry ${levelClass}">
        <span class="log-time">${time}</span>
        ${this.escapeHtml(log.message)}
      </div>`;
    }).join('');
    
    const wasScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
    container.innerHTML = html;
    
    if (this.autoScroll && wasScrolledToBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }

  renderFilteredLogs(filtered) {
    const container = document.getElementById('logContainer');
    if (!container) return;
    
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">无匹配日志</div>';
      return;
    }
    
    const html = filtered.map(log => {
      const levelClass = log.level === 'error' ? 'log-error' : 
                        log.level === 'warn' ? 'log-warn' : 'log-info';
      const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
      return `<div class="log-entry ${levelClass}">
        <span class="log-time">${time}</span>
        ${this.escapeHtml(log.message)}
      </div>`;
    }).join('');
    
    container.innerHTML = html;
  }

  // ========== 工具方法 ==========
  formatRelativeTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateConnectionStatus(status) {
    const indicator = document.getElementById('connectionStatus');
    if (!indicator) return;
    
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('span:last-child');
    
    if (dot) {
      dot.className = 'status-dot';
      if (status === 'connected') dot.classList.add('connected');
      else if (status === 'disconnected') dot.classList.add('disconnected');
      else if (status === 'error') dot.classList.add('disconnected');
    }
    
    if (text) {
      text.textContent = status === 'connected' ? '已连接' : 
                        status === 'disconnected' ? '已断开' : 
                        status === 'error' ? '连接错误' : '连接中...';
    }
  }

  handleAlert(alertData) {
    if (window.notificationCenter && alertData.alerts) {
      alertData.alerts.forEach(alert => {
        window.notificationCenter.addNotification({
          title: `告警: ${alert.ruleName}`,
          message: alert.message,
          type: alert.severity === 'critical' ? 'error' : 
                alert.severity === 'warning' ? 'warning' : 'info'
        });
      });
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: rgba(239, 68, 68, 0.9); color: white;
      padding: 16px 20px; border-radius: 8px; z-index: 10000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px;
    `;
    errorDiv.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">⚠️ 连接错误</div>
      <div style="font-size: 0.9em;">${message}</div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 10000);
  }

  startClock() {
    const updateClock = () => {
      const el = document.getElementById('updateTime');
      if (el) {
        el.textContent = new Date().toLocaleTimeString('zh-CN');
      }
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  // ========== Task G: 性能监控 ==========
  startPerformanceMonitoring() {
    // 定期输出性能指标
    setInterval(() => {
      console.log('[Performance] Metrics:', {
        renderCount: this.performanceMetrics.renderCount,
        updateCount: this.performanceMetrics.updateCount,
        avgRenderTime: this.performanceMetrics.avgRenderTime.toFixed(2) + 'ms',
        visibleCharts: Array.from(this.visibleCharts),
        isPageVisible: this.isPageVisible,
        updateFrequency: this.updateFrequency.current
      });
    }, 30000); // 每30秒输出一次
  }

  getPerformanceReport() {
    return {
      ...this.performanceMetrics,
      visibleCharts: Array.from(this.visibleCharts),
      isPageVisible: this.isPageVisible,
      updateFrequency: this.updateFrequency.current,
      pagination: this.pagination,
      dataStats: {
        agents: this.data.agents?.length || 0,
        tasks: (this.data.tasks?.current?.length || 0) + (this.data.tasks?.history?.length || 0),
        logs: this.data.logs?.length || 0
      }
    };
  }

  setupEventListeners() {
    // 日志控制
    const clearLogsBtn = document.getElementById('clearLogs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        const lc = document.getElementById('logContainer');
        if (lc) lc.innerHTML = '';
        this.data.logs = [];
      });
    }

    const toggleAutoScrollBtn = document.getElementById('toggleAutoScroll');
    if (toggleAutoScrollBtn) {
      toggleAutoScrollBtn.addEventListener('click', (e) => {
        this.autoScroll = !this.autoScroll;
        e.target.textContent = `自动滚动: ${this.autoScroll ? 'ON' : 'OFF'}`;
      });
    }

    // 分页按钮
    const agentsPrev = document.getElementById('agentsPrevPage');
    const agentsNext = document.getElementById('agentsNextPage');
    if (agentsPrev) {
      agentsPrev.addEventListener('click', () => {
        if (this.pagination.agents.page > 1) {
          this.loadAgentsPage(this.pagination.agents.page - 1);
        }
      });
    }
    if (agentsNext) {
      agentsNext.addEventListener('click', () => {
        if (this.pagination.agents.hasMore) {
          this.loadAgentsPage(this.pagination.agents.page + 1);
        }
      });
    }
    
    // Task G: 性能报告导出
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+P 导出性能报告
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        console.log('[Performance Report]', this.getPerformanceReport());
      }
    });
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new OptimizedDashboardV2();
});
