/**
 * OpenClaw 作战指挥中心 - 优化版 Dashboard
 * 
 * 优化内容：
 * 1. 使用摘要接口 (/api/dashboard/summary) 加速首屏
 * 2. 支持增量更新 (/api/dashboard/delta)
 * 3. 懒加载 Chart.js 和图表
 * 4. 分页加载 Agent/任务/日志
 * 5. 页面可见性优化
 * 6. 节流/防抖优化
 */

class OptimizedDashboard {
  constructor() {
    this.ws = null;
    this.autoScroll = true;
    this.data = {};
    this.clientId = null;
    this.lastUpdateTime = null;
    this.isPageVisible = true;
    
    // 分页状态
    this.pagination = {
      agents: { page: 1, limit: 10, hasMore: true },
      tasks: { page: 1, limit: 10, hasMore: true },
      logs: { cursor: null, hasMore: true }
    };
    
    // 节流控制
    this.throttleTimers = {};
    this.updateQueue = [];
    this.isProcessingQueue = false;
    
    // 图表懒加载状态
    this.chartsLoaded = {
      metrics: false,
      tasks: false,
      models: false,
      health: false
    };
    
    this.init();
  }

  init() {
    this.setupPageVisibility();
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadInitialData();
    this.startClock();
    this.setupLazyLoading();
  }

  // ========== 页面可见性优化 ==========
  setupPageVisibility() {
    if (!document.hidden !== undefined) {
      document.addEventListener('visibilitychange', () => {
        this.isPageVisible = !document.hidden;
        
        if (this.isPageVisible) {
          // 页面重新可见时，立即刷新一次
          this.loadInitialData();
        }
      });
    }
  }

  // ========== WebSocket 连接 ==========
  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPath = window.location.pathname.startsWith('/toolbox/dashboard') ? '/toolbox/dashboard/ws' : '/ws';
    const wsUrl = `${protocol}//${window.location.host}${wsPath}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        this.updateConnectionStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.updateConnectionStatus('error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        this.updateConnectionStatus('disconnected');
        // 5秒后重连
        setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.setupWebSocket();
          }
        }, 5000);
      };
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this.updateConnectionStatus('error');
    }
  }

  handleWebSocketMessage(message) {
    // 页面不可见时，跳过非关键更新
    if (!this.isPageVisible && window.APP_CONFIG?.pageVisibilityOptimization) {
      if (message.type !== 'alert') {
        return; // 后台时只处理告警
      }
    }

    if (message.type === 'connected') {
      this.clientId = message.clientId;
    } else if (message.type === 'delta' && message.data) {
      // 增量更新
      this.applyDeltaUpdate(message.data);
    } else if (message.type === 'update' && message.data) {
      this.data = { ...this.data, ...message.data };
      this.queueUpdate('all');
    } else if (message.type === 'config-changed') {
      this.loadInitialData();
    } else if (message.type === 'alert' && message.data) {
      this.handleAlert(message.data);
    }
  }

  // 应用增量更新
  applyDeltaUpdate(delta) {
    if (!delta) return;
    
    // 合并增量数据
    if (delta.system) {
      this.data.system = { ...this.data.system, ...delta.system };
    }
    if (delta.agents) {
      this.updateAgentsFromDelta(delta.agents);
    }
    if (delta.health) {
      this.data.health = { ...this.data.health, ...delta.health };
    }
    if (delta.alerts) {
      this.data.alerts = delta.alerts;
    }
    
    this.queueUpdate('delta');
  }

  updateAgentsFromDelta(agentChanges) {
    if (!this.data.agents) return;
    
    // 更新已变化的 Agent
    if (agentChanges.updated) {
      agentChanges.updated.forEach(updatedAgent => {
        const index = this.data.agents.findIndex(a => a.id === updatedAgent.id);
        if (index !== -1) {
          this.data.agents[index] = { ...this.data.agents[index], ...updatedAgent };
        }
      });
    }
  }

  // ========== 加载初始数据（使用摘要接口） ==========
  async loadInitialData() {
    try {
      const useSummary = window.APP_CONFIG?.useSummaryAPI ?? true;
      const endpoint = useSummary ? '/api/dashboard/summary' : '/api/dashboard';
      
      console.log(`[Dashboard] 加载初始数据: ${endpoint}`);
      const startTime = performance.now();
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const data = await response.json();
      const loadTime = Math.round(performance.now() - startTime);
      
      console.log(`[Dashboard] 数据加载完成，耗时: ${loadTime}ms`, data._meta);
      
      // 转换摘要数据为完整格式
      if (data._meta?.isSummary) {
        this.data = this.expandSummaryData(data);
      } else {
        this.data = data;
      }
      
      this.lastUpdateTime = Date.now();
      this.updateAllPanels();
      
      // 加载完成后，异步获取完整数据
      if (useSummary) {
        setTimeout(() => this.loadFullData(), 100);
      }
    } catch (error) {
      console.error('加载初始数据失败:', error);
      this.showError('无法连接到服务器，请确保后端服务正在运行');
    }
  }

  // 扩展摘要数据为完整格式
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

  // 异步加载完整数据
  async loadFullData() {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) return;
      
      const fullData = await response.json();
      
      // 智能合并：保留已有数据，补充新数据
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
      console.error('加载完整数据失败:', error);
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

  // ========== 增量更新 ==========
  async fetchDeltaUpdate() {
    if (!window.APP_CONFIG?.useDeltaUpdates) return;
    if (!this.lastUpdateTime) return;
    
    try {
      const since = new Date(this.lastUpdateTime).toISOString();
      const clientId = this.clientId ? `&clientId=${this.clientId}` : '';
      const response = await fetch(`/api/dashboard/delta?since=${encodeURIComponent(since)}${clientId}`);
      
      if (!response.ok) return;
      
      const delta = await response.json();
      if (delta.changes) {
        this.applyDeltaUpdate(delta.changes);
        this.lastUpdateTime = Date.now();
      }
    } catch (error) {
      console.error('获取增量更新失败:', error);
    }
  }

  // ========== 更新队列（节流） ==========
  queueUpdate(type) {
    if (!this.updateQueue.includes(type)) {
      this.updateQueue.push(type);
    }
    
    if (this.isProcessingQueue) return;
    
    // 使用 requestAnimationFrame 批量更新
    requestAnimationFrame(() => {
      this.processUpdateQueue();
    });
  }

  processUpdateQueue() {
    this.isProcessingQueue = true;
    
    const types = [...this.updateQueue];
    this.updateQueue = [];
    
    if (types.includes('all')) {
      this.updateAllPanels();
    } else if (types.includes('delta')) {
      this.updateHealthPanel();
      this.updateSystemOverview();
      this.updateAgentsList();
    } else {
      // 单独更新
      types.forEach(type => {
        switch(type) {
          case 'health': this.updateHealthPanel(); break;
          case 'system': this.updateSystemOverview(); break;
          case 'agents': this.updateAgentsList(); break;
          case 'tasks': this.updateCurrentTasks(); break;
          case 'logs': this.updateLogs(); break;
        }
      });
    }
    
    this.isProcessingQueue = false;
    
    // 如果队列又有新任务，继续处理
    if (this.updateQueue.length > 0) {
      requestAnimationFrame(() => this.processUpdateQueue());
    }
  }

  // ========== 分页加载 ==========
  async loadAgentsPage(page = 1) {
    try {
      const response = await fetch(`/api/agents/list-paginated?page=${page}&limit=${this.pagination.agents.limit}`);
      if (!response.ok) throw new Error('加载失败');
      
      const result = await response.json();
      
      this.pagination.agents.page = page;
      this.pagination.agents.hasMore = result.pagination?.hasNext ?? false;
      
      // 合并或替换数据
      if (page === 1) {
        this.data.agents = result.data;
      } else {
        this.data.agents = [...this.data.agents, ...result.data];
      }
      
      this.updateAgentsList();
      this.updatePaginationUI('agents', result.pagination);
    } catch (error) {
      console.error('加载Agent分页失败:', error);
    }
  }

  async loadTasksPage(page = 1, type = 'all') {
    try {
      const response = await fetch(`/api/tasks/list-paginated?page=${page}&limit=${this.pagination.tasks.limit}&type=${type}`);
      if (!response.ok) throw new Error('加载失败');
      
      const result = await response.json();
      
      this.pagination.tasks.page = page;
      this.pagination.tasks.hasMore = result.pagination?.hasNext ?? false;
      
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
      console.error('加载任务分页失败:', error);
    }
  }

  async loadLogsPage(cursor = null) {
    try {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(`/api/logs/paginated?limit=${this.pagination.logs.limit || 50}${cursorParam}`);
      if (!response.ok) throw new Error('加载失败');
      
      const result = await response.json();
      
      this.pagination.logs.cursor = result.pagination?.nextCursor || null;
      this.pagination.logs.hasMore = result.pagination?.hasMore ?? false;
      
      // 追加日志
      if (!this.data.logs) this.data.logs = [];
      
      if (cursor) {
        this.data.logs = [...this.data.logs, ...result.data];
      } else {
        this.data.logs = result.data;
      }
      
      this.renderLogs();
    } catch (error) {
      console.error('加载日志分页失败:', error);
    }
  }

  updatePaginationUI(type, pagination) {
    const container = document.getElementById(`${type}Pagination`);
    if (!container) return;
    
    const prevBtn = container.querySelector(`#${type}PrevPage`);
    const nextBtn = container.querySelector(`#${type}NextPage`);
    const pageInfo = container.querySelector(`#${type}PageInfo`);
    
    if (prevBtn) prevBtn.disabled = !pagination.hasPrev;
    if (nextBtn) nextBtn.disabled = !pagination.hasNext;
    if (pageInfo) pageInfo.textContent = `第 ${pagination.page} / ${pagination.totalPages} 页`;
    
    container.style.display = 'block';
  }

  // ========== 懒加载图表 ==========
  setupLazyLoading() {
    if (!window.IntersectionObserver) return;
    
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const chartType = entry.target.dataset.lazyChart;
          if (chartType && !this.chartsLoaded[chartType]) {
            this.loadChart(chartType);
          }
        }
      });
    }, { rootMargin: '100px' });
    
    // 观察所有延迟加载的图表容器
    document.querySelectorAll('[data-lazy-chart]').forEach(el => {
      chartObserver.observe(el);
    });
  }

  async loadChart(chartType) {
    if (this.chartsLoaded[chartType]) return;
    
    try {
      // 确保 Chart.js 已加载
      await window.loadChartJS();
      
      this.chartsLoaded[chartType] = true;
      
      // 显示图表容器
      const container = document.querySelector(`[data-lazy-chart="${chartType}"]`);
      if (container) {
        container.style.display = 'block';
      }
      
      // 初始化对应图表
      if (window.chartsManager) {
        switch(chartType) {
          case 'metrics':
            await window.chartsManager.initMetricsChart();
            break;
          case 'tasks':
            await window.chartsManager.initTasksChart();
            break;
          case 'models':
            await window.chartsManager.initModelsChart();
            break;
          case 'health':
            await window.chartsManager.initHealthChart();
            break;
        }
      }
    } catch (error) {
      console.error(`加载图表 ${chartType} 失败:`, error);
    }
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
    
    // 触发布局更新
    if (window.uiEnhancements?.layoutMasonry) {
      requestAnimationFrame(() => window.uiEnhancements.layoutMasonry());
    }
  }

  updateHealthPanel() {
    if (!this.data?.health) return;
    
    const health = this.data.health;
    const scoreElement = document.getElementById('healthScore')?.querySelector('.score-value');
    if (scoreElement) {
      scoreElement.textContent = health.score;
    }
    
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

  updateAgentsList() {
    if (!this.data?.agents) return;
    
    const agents = this.data.agents;
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
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; 
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
        `).join('')}
      </div>
    `;
    
    const agentsPanel = document.getElementById('agentsList');
    if (agentsPanel) agentsPanel.innerHTML = html;
  }

  updateCurrentTasks() {
    if (!this.data?.tasks?.current) return;
    
    const tasks = this.data.tasks.current;
    
    const html = tasks.slice(0, 10).map(task => `
      <div style="padding: 10px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;
                  border-left: 3px solid #3b82f6; cursor: pointer;"
           onclick="window.showTaskDetail && window.showTaskDetail('${task.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.9em;">${task.agentName}</strong>
          <span style="font-size: 0.7em; padding: 2px 8px; background: rgba(59,130,246,0.2); 
                       color: #3b82f6; border-radius: 12px;">进行中</span>
        </div>
        <div style="font-size: 0.85em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${task.title || '(无标题)'}
        </div>
        <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 4px;">
          ${task.messageCount || 0} 消息 · ${this.formatRelativeTime(task.lastUpdate)}
        </div>
      </div>
    `).join('') || '<div class="empty-state">暂无当前任务</div>';
    
    const tasksPanel = document.getElementById('currentTasks');
    if (tasksPanel) tasksPanel.innerHTML = html;
  }

  updateTaskHistory() {
    if (!this.data?.tasks?.history) return;
    
    const tasks = this.data.tasks.history;
    
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
    
    const historyPanel = document.getElementById('taskHistory');
    if (historyPanel) historyPanel.innerHTML = html;
  }

  updateModelsQuota() {
    if (!this.data?.models) return;
    
    const models = this.data.models;
    const html = models.slice(0, 5).map(model => `
      <div style="display: flex; justify-content: space-between; align-items: center; 
                  padding: 8px 0; border-bottom: 1px solid var(--border);">
        <span style="font-size: 0.9em;">${model.name}</span>
        <span style="font-size: 0.8em; color: var(--text-secondary);">
          ${model.quotaTotal > 0 ? `${model.quotaUsed}/${model.quotaTotal}` : '无配额'}
        </span>
      </div>
    `).join('') || '<div class="empty-state">暂无模型信息</div>';
    
    const quotaPanel = document.getElementById('modelsQuota');
    if (quotaPanel) quotaPanel.innerHTML = html;
  }

  updateChannelsStatus() {
    if (!this.data?.channels) return;
    
    const channels = this.data.channels;
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
    
    const channelsPanel = document.getElementById('channelsStatus');
    if (channelsPanel) channelsPanel.innerHTML = html;
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

  setupEventListeners() {
    // 日志控制
    const clearLogsBtn = document.getElementById('clearLogs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        const lc = document.getElementById('logContainer');
        if (lc) lc.innerHTML = '';
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
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new OptimizedDashboard();
});
