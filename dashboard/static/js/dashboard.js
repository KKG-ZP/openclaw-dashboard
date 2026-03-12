class Dashboard {
  constructor() {
    this.ws = null;
    this.autoScroll = true;
    this.data = {};
    this.panelRefreshState = {
      modelUsage: 0,
      skillUsage: 0,
      resources: 0,
      alerts: 0,
      statistics: 0,
      messages: 0
    };
    this.init();
  }

  init() {
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadInitialData();
    this.startClock();
    this.startPolling(); // 启动轮询作为备选方案
  }

  // 设置WebSocket连接
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
        // WebSocket连接失败不影响主要功能，只显示警告
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
      // WebSocket失败不影响主要功能，继续使用轮询
    }
  }

  // 处理WebSocket消息
  handleWebSocketMessage(message) {
    if (message.type === 'update' && message.data) {
      this.data = { ...this.data, ...message.data };
      this.updateAllPanels();
    } else if (message.type === 'config-changed') {
      this.loadInitialData();
    } else if (message.type === 'alert' && message.data) {
      // 处理告警通知
      if (window.notificationCenter && message.data.alerts) {
        message.data.alerts.forEach(alert => {
          window.notificationCenter.addNotification({
            title: `告警: ${alert.ruleName}`,
            message: alert.message,
            type: alert.severity === 'critical' ? 'error' : 
                  alert.severity === 'warning' ? 'warning' : 'info'
          });
        });
      }
    }
  }

  // 更新连接状态
  updateConnectionStatus(status) {
    const indicator = document.getElementById('connectionStatus');
    if (!indicator) return;
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('span:last-child');
    if (!dot || !text) return;

    dot.className = 'status-dot';
    if (status === 'connected') {
      dot.classList.add('connected');
      text.textContent = '已连接';
    } else if (status === 'disconnected') {
      dot.classList.add('disconnected');
      text.textContent = '已断开';
    } else if (status === 'error') {
      dot.classList.add('disconnected');
      text.textContent = '连接错误';
    } else {
      text.textContent = '连接中...';
    }
  }

  // 设置事件监听器
  setupEventListeners() {
    // 日志清空按钮（日志面板中的，通过父元素查找）
    const logPanel = document.querySelector('.card.full-width .card-actions');
    if (logPanel) {
      const clearLogsBtn = logPanel.querySelector('#clearLogs');
      if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
          const lc = document.getElementById('logContainer');
          if (lc) lc.innerHTML = '';
        });
      }
    }

    const toggleAutoScrollBtn = document.getElementById('toggleAutoScroll');
    if (toggleAutoScrollBtn) {
      toggleAutoScrollBtn.addEventListener('click', (e) => {
        this.autoScroll = !this.autoScroll;
        e.target.textContent = `自动滚动: ${this.autoScroll ? 'ON' : 'OFF'}`;
      });
    }

    // 快捷操作按钮
    this.setupQuickActions();
  }

  // 设置快捷操作
  setupQuickActions() {
    // 重启Gateway
    const restartBtn = document.getElementById('restartGateway');
    if (restartBtn) {
      restartBtn.addEventListener('click', async () => {
        if (!confirm('确定要重启Gateway吗？这可能会中断正在进行的任务。')) {
          return;
        }
        await this.executeAction('restart-gateway', '重启Gateway');
      });
    }

    // 清理日志（快捷操作面板中的）
    const clearLogsActionBtn = document.getElementById('clearLogsAction');
    if (clearLogsActionBtn) {
      clearLogsActionBtn.addEventListener('click', async () => {
        if (!confirm('确定要清理所有日志文件吗？此操作将清空所有日志内容。')) {
          return;
        }
        await this.executeAction('clear-logs', '清理日志');
      });
    }

    // 重新加载配置
    const reloadConfigBtn = document.getElementById('reloadConfig');
    if (reloadConfigBtn) {
      reloadConfigBtn.addEventListener('click', async () => {
        await this.executeAction('reload-config', '重新加载配置');
      });
    }

    // 导出报告
    const exportReportBtn = document.getElementById('exportReport');
    if (exportReportBtn) {
      exportReportBtn.addEventListener('click', async () => {
        const format = prompt('选择导出格式：\n1. JSON\n2. CSV', '1');
        const formatType = format === '2' ? 'csv' : 'json';
        window.location.href = `/api/actions/export-report?format=${formatType}`;
      });
    }
  }

  // 执行快捷操作
  async executeAction(action, actionName) {
    try {
      const response = await fetch(`/api/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      const result = await response.json();
      alert(`${actionName}成功：${result.message || '操作完成'}`);
      
      // 如果是重新加载配置，刷新数据
      if (action === 'reload-config') {
        this.loadInitialData();
      }
    } catch (error) {
      console.error(`${actionName}失败:`, error);
      alert(`${actionName}失败：${error.message}`);
    }
  }

  // 加载初始数据
  async loadInitialData() {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      const data = await response.json();
      console.log('[前端] 加载的完整数据:', data);
      console.log('[前端] 模型数据:', data.models);
      
      // 详细打印每个模型的配额信息
      if (data.models && data.models.length > 0) {
        console.log('[前端] 模型配额详情:');
        data.models.forEach(m => {
          console.log(`  ${m.provider} - ${m.modelName || m.modelId || m.name || '未知模型'}: quotaUsed=${m.quotaUsed} (${typeof m.quotaUsed}), quotaTotal=${m.quotaTotal} (${typeof m.quotaTotal})`);
        });
      }
      
      this.data = data;
      this.updateAllPanels();
    } catch (error) {
      console.error('加载初始数据失败:', error);
      this.showError('无法连接到服务器，请确保后端服务正在运行');
      // 显示错误信息到各个面板
      this.showLoadingError();
    }
  }

  // 显示错误信息
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 400px;
    `;
    errorDiv.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">⚠️ 连接错误</div>
      <div style="font-size: 0.9em;">${message}</div>
      <div style="margin-top: 12px; font-size: 0.85em; opacity: 0.9;">
        请检查：<br>
        1. 后端服务是否运行（npm start）<br>
        2. 端口是否正确（默认3000）<br>
        3. 浏览器控制台是否有错误
      </div>
    `;
    document.body.appendChild(errorDiv);
    
    // 5秒后自动移除
    setTimeout(() => {
      errorDiv.remove();
    }, 10000);
  }

  // 显示加载错误到各个面板
  showLoadingError() {
    const panels = [
      'systemOverview',
      'agentsList',
      'currentTasks',
      'channelsStatus',
      'modelsQuota',
      'taskHistory',
      'skillUsageStats',
      'logContainer'
    ];
    
    panels.forEach(panelId => {
      const panel = document.getElementById(panelId);
      if (panel) {
        panel.innerHTML = `
          <div class="empty-state" style="color: var(--error);">
            <div style="font-size: 1.2em; margin-bottom: 8px;">❌ 无法加载数据</div>
            <div style="font-size: 0.9em;">请检查后端服务是否运行</div>
          </div>
        `;
      }
    });
  }

  // 更新所有面板
  updateAllPanels() {
    this.updateHealthPanel();
    this.updateSystemOverview();
    this.updateAgentsList();
    this.updateCurrentTasks();
    this.updateChannelsStatus();
    this.updateModelsQuota();
    this.updateTaskHistory();
    this.maybeRefreshAsyncPanel('modelUsage', 60000, () => this.updateModelUsageStats());
    this.maybeRefreshAsyncPanel('skillUsage', 60000, () => this.updateSkillUsageStats());
    this.updateLogs();
    
    // 更新侧边栏布局的特定面板
    if (window.sidebarManager) {
      this.maybeRefreshAsyncPanel('resources', 15000, () => this.updateResourcesPanel());
      this.maybeRefreshAsyncPanel('alerts', 15000, () => this.updateAlertsPanel());
      this.maybeRefreshAsyncPanel('statistics', 20000, () => this.updateStatisticsPanel());
      this.maybeRefreshAsyncPanel('messages', 30000, () => this.updateMessagesPanel());
    }
    
    // 更新侧边栏徽章
    if (window.updateSidebarBadges) {
      window.updateSidebarBadges(this.data);
    }
    
    // 更新图表
    if (window.chartsManager) {
      window.chartsManager.updateAllCharts();
    }

    // 面板内容更新后，多次触发布局确保能测到正确高度（避免 reflow 未完成或时序问题）
    // 清理旧的延迟任务，避免重排风暴
    if (this._layoutTimeouts) {
      this._layoutTimeouts.forEach(id => clearTimeout(id));
    }
    this._layoutTimeouts = [];

    const runLayout = () => {
      if (window.uiEnhancements && window.uiEnhancements.layoutMasonry) {
        window.uiEnhancements.layoutMasonry();
      }
    };
    // 1. 强制 reflow：让浏览器先对刚写入的 DOM 做布局，再读高度
    const grid = document.querySelector('.grid');
    if (grid) {
      void grid.offsetHeight;
    }
    runLayout();
    // 2. 下一帧再排一次（布局/绘制可能延迟一帧）
    requestAnimationFrame(runLayout);
    // 3. 延迟兜底（图表动画/字体/图片延迟会影响卡片高度）
    [100, 400, 900, 1600, 3000].forEach(ms => {
      const id = setTimeout(runLayout, ms);
      this._layoutTimeouts.push(id);
    });
    
    // 4. 确保拖动功能正常（重新绑定事件）
    if (window.uiEnhancements && window.uiEnhancements._bindDragEvents) {
      setTimeout(() => window.uiEnhancements._bindDragEvents(grid), 100);
    }
  }

  // 更新资源监控面板（侧边栏布局）
  async updateResourcesPanel() {
    const panel = document.getElementById('resourcesContent');
    if (!panel) return;

    try {
      const resources = await this.fetchJsonWithTimeout('/api/system/resources', 6000);
      const sys = resources && resources.system;
      if (!sys || !sys.cpu || !sys.memory || !sys.disk || !sys.network) {
        panel.innerHTML = '<div class="empty-state">资源数据不可用</div>';
        return;
      }
      const html = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${(sys.cpu.usage ?? 0).toFixed(1)}%</div>
            <div class="stat-label">CPU使用率</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(sys.memory.percent ?? 0).toFixed(1)}%</div>
            <div class="stat-label">内存使用率</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(sys.disk.percent ?? 0).toFixed(1)}%</div>
            <div class="stat-label">磁盘使用率</div>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <h3 style="margin-bottom: 10px;">详细信息</h3>
          <div class="status-item">
            <span class="status-label">CPU核心数</span>
            <span class="status-value">${sys.cpu.cores ?? '--'}</span>
          </div>
          <div class="status-item">
            <span class="status-label">总内存</span>
            <span class="status-value">${(sys.memory.total ?? 0).toFixed(0)} MB</span>
          </div>
          <div class="status-item">
            <span class="status-label">已用内存</span>
            <span class="status-value">${(sys.memory.used ?? 0).toFixed(0)} MB</span>
          </div>
          <div class="status-item">
            <span class="status-label">总磁盘</span>
            <span class="status-value">${(sys.disk.total ?? 0).toFixed(1)} GB</span>
          </div>
          <div class="status-item">
            <span class="status-label">已用磁盘</span>
            <span class="status-value">${(sys.disk.used ?? 0).toFixed(1)} GB</span>
          </div>
          <div class="status-item">
            <span class="status-label">网络输入</span>
            <span class="status-value">${(sys.network.input ?? 0).toFixed(2)} MB</span>
          </div>
          <div class="status-item">
            <span class="status-label">网络输出</span>
            <span class="status-value">${(sys.network.output ?? 0).toFixed(2)} MB</span>
          </div>
        </div>
      `;
      panel.innerHTML = html;
    } catch (error) {
      console.error('更新资源监控失败:', error);
    }
  }

  // 更新告警面板（侧边栏布局）
  async updateAlertsPanel() {
    const panel = document.getElementById('alertsContent');
    if (!panel) return;

    try {
      const [active, history] = await Promise.all([
        fetch('/api/alerts/active').then(r => r.ok ? r.json() : []),
        fetch('/api/alerts/history?limit=20').then(r => r.ok ? r.json() : [])
      ]);

      let html = '<h3 style="margin-bottom: 15px;">活跃告警</h3>';
      if (active.length === 0) {
        html += '<div class="empty-state">暂无活跃告警</div>';
      } else {
        html += '<div class="compact-list">';
        active.forEach(alert => {
          const severityClass = alert.severity === 'critical' ? 'badge-red' : 
                               alert.severity === 'warning' ? 'badge-yellow' : 'badge-blue';
          html += `
            <div class="compact-list-item">
              <div>
                <span class="badge ${severityClass}">${alert.severity}</span>
                <strong style="margin-left: 10px;">${alert.ruleName}</strong>
              </div>
              <div style="font-size: 0.85em; color: var(--text-secondary);">
                ${new Date(alert.timestamp).toLocaleString('zh-CN')}
              </div>
            </div>
          `;
        });
        html += '</div>';
      }

      html += '<h3 style="margin-top: 30px; margin-bottom: 15px;">告警历史</h3>';
      if (history.length === 0) {
        html += '<div class="empty-state">暂无告警历史</div>';
      } else {
        html += '<div class="compact-list">';
        history.slice(0, 10).forEach(alert => {
          const severityClass = alert.severity === 'critical' ? 'badge-red' : 
                               alert.severity === 'warning' ? 'badge-yellow' : 'badge-blue';
          const resolvedBadge = alert.resolved ? '<span class="badge badge-green">已解决</span>' : '';
          html += `
            <div class="compact-list-item">
              <div>
                <span class="badge ${severityClass}">${alert.severity}</span>
                <strong style="margin-left: 10px;">${alert.ruleName}</strong>
                ${resolvedBadge}
              </div>
              <div style="font-size: 0.85em; color: var(--text-secondary);">
                ${new Date(alert.timestamp).toLocaleString('zh-CN')}
              </div>
            </div>
          `;
        });
        html += '</div>';
      }

      panel.innerHTML = html;
    } catch (error) {
      console.error('更新告警面板失败:', error);
    }
  }

  // 更新统计面板（侧边栏布局）
  async updateStatisticsPanel() {
    const panel = document.getElementById('statisticsContent');
    if (!panel) return;

    try {
      const [today, week, month] = await Promise.all([
        fetch('/api/statistics?range=today').then(r => r.ok ? r.json() : null),
        fetch('/api/statistics?range=week').then(r => r.ok ? r.json() : null),
        fetch('/api/statistics?range=month').then(r => r.ok ? r.json() : null)
      ]);

      const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          ${today ? `
            <div class="card compact">
              <h3 style="margin-bottom: 15px;">今日统计</h3>
              <div class="stat-card">
                <div class="stat-value">${today.agents.total}</div>
                <div class="stat-label">Agent总数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${today.tasks.total}</div>
                <div class="stat-label">任务总数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${today.logs.errors}</div>
                <div class="stat-label">错误日志</div>
              </div>
            </div>
          ` : ''}
          ${week ? `
            <div class="card compact">
              <h3 style="margin-bottom: 15px;">本周统计</h3>
              <div class="stat-card">
                <div class="stat-value">${week.tasks.total}</div>
                <div class="stat-label">任务总数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${week.messages.total}</div>
                <div class="stat-label">消息总数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${week.logs.total}</div>
                <div class="stat-label">日志总数</div>
              </div>
            </div>
          ` : ''}
          ${month ? `
            <div class="card compact">
              <h3 style="margin-bottom: 15px;">本月统计</h3>
              <div class="stat-card">
                <div class="stat-value">${month.tasks.total}</div>
                <div class="stat-label">任务总数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${month.messages.total}</div>
                <div class="stat-label">消息总数</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${month.health.current}</div>
                <div class="stat-label">健康度</div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
      panel.innerHTML = html;
    } catch (error) {
      console.error('更新统计面板失败:', error);
    }
  }

  // 更新健康度面板
  updateHealthPanel() {
    if (!this.data || !this.data.health) {
      const panel = document.getElementById('healthScore');
      const scoreVal = panel && panel.querySelector('.score-value');
      if (scoreVal) scoreVal.textContent = '--';
      const statusPanel = document.getElementById('healthStatus');
      if (statusPanel) {
        statusPanel.innerHTML = '<div class="status-badge">检测中...</div>';
      }
      return;
    }

    const health = this.data.health;
    const scoreElement = document.getElementById('healthScore')?.querySelector('.score-value');
    if (!scoreElement) return;
    scoreElement.textContent = health.score;
    
    // 根据健康度设置不同的动画效果
    scoreElement.style.animation = health.score >= 80 ? 'scoreGlow 2s ease-in-out infinite' :
                                   health.score >= 50 ? 'scoreGlow 1.5s ease-in-out infinite' :
                                   'scoreGlow 1s ease-in-out infinite';
    
    const statusBadge = document.getElementById('healthStatus')?.querySelector('.status-badge');
    if (!statusBadge) return;
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

    const issuesContainer = document.getElementById('healthIssues');
    if (!issuesContainer) return;
    if (health.issues && health.issues.length > 0) {
      issuesContainer.innerHTML = health.issues.map(issue => 
        `<div class="issue-item">${issue.message}</div>`
      ).join('');
    } else {
      issuesContainer.innerHTML = '';
    }
  }

  // 更新系统概览
  updateSystemOverview() {
    if (!this.data.system) return;

    const system = this.data.system;
    
    
    // 主卡片内容 - 使用更清晰的图标和布局
    const isRunning = system.gateway.status === 'running';
    
    // 解析 CPU 和内存数值
    const cpuValue = parseFloat(system.gateway.cpu) || 0;
    const memoryStr = system.gateway.memory || '0 KB';
    const memoryKB = parseFloat(memoryStr.replace(/[^\d.]/g, '')) || 0;
    const memoryMB = memoryStr.includes('KB') ? memoryKB / 1024 : memoryKB;
    
    // 获取系统总内存（从 system 对象中获取，如果有的话）
    // 如果没有，尝试从 API 返回数据中获取，或使用默认值
    const rawTotalMemory = Number(system.totalMemory);
    const totalMemoryMB = (rawTotalMemory > 0 && !isNaN(rawTotalMemory)) ? rawTotalMemory : 2048; // 默认2GB
    const memoryPercent = Math.min(100, Math.max(0, (memoryMB / totalMemoryMB) * 100));
    
    // 根据使用率确定颜色
    const getCpuColor = (val) => val > 80 ? '#ef4444' : val > 50 ? '#f59e0b' : '#3b82f6';
    const getMemColor = (val) => val > 80 ? '#ef4444' : val > 50 ? '#f59e0b' : '#8b5cf6';
    const cpuColor = getCpuColor(cpuValue);
    const memColor = getMemColor(memoryPercent);
    
    const html = `
      <div class="so-metric-grid" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div class="so-metric-card" style="padding: 14px; border-radius: 10px; text-align: center; background: ${isRunning ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${isRunning ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};">
          <div style="font-size: 1.8em; margin-bottom: 6px;">${isRunning ? '✅' : '❌'}</div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">Gateway</div>
          <div style="font-size: 0.9em; font-weight: 600; color: ${isRunning ? '#10b981' : '#ef4444'};">${isRunning ? '运行中' : '已停止'}</div>
        </div>
        <div class="so-metric-card" style="padding: 14px; border-radius: 10px; text-align: center; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2);">
          <div style="position: relative; width: 60px; height: 60px; margin: 0 auto 8px;">
            <svg width="60" height="60" style="transform: rotate(-90deg);">
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(59, 130, 246, 0.2)" stroke-width="6"/>
              <circle cx="30" cy="30" r="26" fill="none" stroke="${cpuColor}" stroke-width="6" 
                stroke-dasharray="${2 * Math.PI * 26}" 
                stroke-dashoffset="${2 * Math.PI * 26 * (1 - cpuValue / 100)}"
                stroke-linecap="round"
                style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.85em; font-weight: 700; color: ${cpuColor};">
              ${cpuValue.toFixed(0)}%
            </div>
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);">CPU 占用</div>
        </div>
        <div class="so-metric-card" style="padding: 14px; border-radius: 10px; text-align: center; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
          <div style="position: relative; width: 60px; height: 60px; margin: 0 auto 8px;">
            <svg width="60" height="60" style="transform: rotate(-90deg);">
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(139, 92, 246, 0.2)" stroke-width="6"/>
              <circle cx="30" cy="30" r="26" fill="none" stroke="${memColor}" stroke-width="6" 
                stroke-dasharray="${2 * Math.PI * 26}" 
                stroke-dashoffset="${2 * Math.PI * 26 * (1 - memoryPercent / 100)}"
                stroke-linecap="round"
                style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"/>
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7em; font-weight: 700; color: ${memColor};" title="${memoryPercent.toFixed(1)}% (${memoryMB.toFixed(0)}MB / ${totalMemoryMB}MB)">
              ${memoryMB.toFixed(0)}MB
            </div>
          </div>
          <div style="font-size: 0.75em; color: var(--text-secondary);" title="${memoryPercent.toFixed(1)}% 占用">内存占用</div>
        </div>
      </div>
      <div class="so-details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; font-size: 0.85em;">
        <div class="so-detail-item" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px; min-width: 0;">
          <span style="font-size: 1.1em;">🏠</span>
          <span style="color: var(--text-secondary);">主机</span>
          <span title="${system.hostname}" style="margin-left: auto; font-weight: 500; min-width: 0; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${system.hostname}</span>
        </div>
        <div class="so-detail-item" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">🔢</span>
          <span style="color: var(--text-secondary);">PID</span>
          <span style="margin-left: auto; font-weight: 500;">${system.gateway.pid || 'N/A'}</span>
        </div>
        <div class="so-detail-item" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">⏱️</span>
          <span style="color: var(--text-secondary);">运行时间</span>
          <span style="margin-left: auto; font-weight: 500;">${system.gateway.uptime || 'N/A'}</span>
        </div>
        <div class="so-detail-item" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">🌐</span>
          <span style="color: var(--text-secondary);">端口</span>
          <span style="margin-left: auto; font-weight: 500;">${system.gateway.port || 'N/A'}</span>
        </div>
        <div class="so-detail-item" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px;">
          <span style="font-size: 1.1em;">📦</span>
          <span style="color: var(--text-secondary);">Node.js</span>
          <span style="margin-left: auto; font-weight: 500;">${system.nodeVersion}</span>
        </div>
        <div class="so-detail-item" style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: var(--bg-secondary); border-radius: 8px; min-width: 0;">
          <span style="font-size: 1.1em;">🖥️</span>
          <span style="color: var(--text-secondary);">架构</span>
          <span title="${system.platform} ${system.arch}" style="margin-left: auto; font-weight: 500; min-width: 0; max-width: 62%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${system.platform} ${system.arch}</span>
        </div>
      </div>
    `;
    const sysPanel = document.getElementById('systemOverview');
    if (sysPanel) sysPanel.innerHTML = html;
  }

  // 更新右侧边栏系统摘要
  _updateSystemSummary(system) {
    const summaryGateway = document.getElementById('summaryGateway');
    const summaryCpu = document.getElementById('summaryCpu');
    const summaryMemory = document.getElementById('summaryMemory');
    const summaryUptime = document.getElementById('summaryUptime');
    
    if (summaryGateway) {
      const isRunning = system.gateway.status === 'running';
      summaryGateway.textContent = isRunning ? '运行中' : '已停止';
      summaryGateway.style.color = isRunning ? '#10b981' : '#ef4444';
    }
    if (summaryCpu) {
      summaryCpu.textContent = system.gateway.cpu || 'N/A';
    }
    if (summaryMemory) {
      summaryMemory.textContent = system.gateway.memory || 'N/A';
    }
    if (summaryUptime) {
      summaryUptime.textContent = system.gateway.uptime || 'N/A';
    }
  }

  maybeRefreshAsyncPanel(key, minIntervalMs, refreshFn) {
    const now = Date.now();
    const lastAt = this.panelRefreshState[key] || 0;
    if ((now - lastAt) < minIntervalMs) return;
    this.panelRefreshState[key] = now;
    Promise.resolve()
      .then(refreshFn)
      .catch(error => {
        console.error(`刷新面板失败: ${key}`, error);
      });
  }

  async fetchJsonWithTimeout(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // 更新Agent列表 - 组织架构视图
  updateAgentsList() {
    if (!this.data.agents || this.data.agents.length === 0) {
      const al = document.getElementById('agentsList');
      if (al) al.innerHTML = '<div class="empty-state">暂无Agent</div>';
      return;
    }

    // 更新Agent过滤器选项
    // agentFilter 已由 search.js 管理
    

    // 如果搜索管理器存在且有搜索关键词，让搜索管理器处理
    if (window.searchManager && window.searchManager.currentFilters.agents.keyword) {
      window.searchManager.filterAgents();
      return;
    }

    // 构建组织架构
    const agents = this.data.agents;
    const agentMap = new Map(agents.map(a => [a.id, a]));
    const childrenMap = new Map();

    const ensureChildrenBucket = (parentId) => {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      return childrenMap.get(parentId);
    };

    agents.forEach(agent => {
      if (agent.parentId && agentMap.has(agent.parentId)) {
        ensureChildrenBucket(agent.parentId).push(agent.id);
      }
      if (agent.subagents && agent.subagents.length > 0) {
        agent.subagents.forEach(subId => {
          if (agentMap.has(subId)) {
            const bucket = ensureChildrenBucket(agent.id);
            if (!bucket.includes(subId)) bucket.push(subId);
          }
        });
      }
    });

    // 主 Agent（不是任何人的下级）
    const childAgentIds = new Set(Array.from(childrenMap.values()).flat());
    const mainAgents = agents.filter(a => !childAgentIds.has(a.id));
    
    // 统计信息
    const activeCount = agents.filter(a => a.status === 'active').length;
    const idleCount = agents.filter(a => a.status === 'idle').length;
    const totalSessions = agents.reduce((sum, a) => sum + (a.sessionCount || 0), 0);

    // 生成组织架构 HTML
    const html = `
      <!-- 统计概览 -->
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

      <!-- 组织架构树 -->
      <div class="org-tree">
        ${mainAgents.map(agent => this._renderAgentNode(agent, agentMap, childrenMap, 0)).join('')}
      </div>
    `;
    
    document.getElementById('agentsList').innerHTML = html;
  }

  // 渲染单个 Agent 节点（支持递归渲染子 Agent）
  _renderAgentNode(agent, agentMap, childrenMap, level) {
    const childIds = childrenMap.get(agent.id) || [];
    const hasSubagents = childIds.length > 0;
    const isActive = agent.status === 'active';
    
    // 状态颜色
    const statusColor = isActive ? '#10b981' : '#f59e0b';
    const statusBg = isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
    const statusText = isActive ? '活跃' : '空闲';

    // 主 Agent（level 0）使用完整卡片，子 Agent 使用紧凑显示
    if (level === 0) {
      // 收集子 Agent 信息用于内联显示 - 方块状横向排列
      let subagentsHtml = '';
      if (hasSubagents) {
        const groupMetaMap = {
          'direct-department': {
            label: '直属部门',
            icon: '🏛️',
            accent: '#2563eb',
            accentBg: 'rgba(37, 99, 235, 0.1)',
            accentBorder: 'rgba(37, 99, 235, 0.18)'
          },
          'special-envoy': {
            label: '特使机构',
            icon: '📜',
            accent: '#d97706',
            accentBg: 'rgba(217, 119, 6, 0.1)',
            accentBorder: 'rgba(217, 119, 6, 0.18)'
          },
          'managed-agent': {
            label: '下级 Agent',
            icon: '🧩',
            accent: '#0f766e',
            accentBg: 'rgba(15, 118, 110, 0.1)',
            accentBorder: 'rgba(15, 118, 110, 0.18)'
          },
          'runtime-subagent': {
            label: '下级 Agent',
            icon: '🧩',
            accent: '#0f766e',
            accentBg: 'rgba(15, 118, 110, 0.1)',
            accentBorder: 'rgba(15, 118, 110, 0.18)'
          },
          'independent': {
            label: '独立实例',
            icon: '🛰️',
            accent: '#6b7280',
            accentBg: 'rgba(107, 114, 128, 0.1)',
            accentBorder: 'rgba(107, 114, 128, 0.18)'
          }
        };
        const groupOrder = ['direct-department', 'special-envoy', 'managed-agent', 'runtime-subagent', 'independent'];
        const childGroups = new Map();

        childIds.forEach(subId => {
          const subAgent = agentMap.get(subId);
          const groupKey = subAgent?.organizationType || 'managed-agent';
          if (!childGroups.has(groupKey)) childGroups.set(groupKey, []);
          childGroups.get(groupKey).push(subId);
        });

        const orderedGroups = groupOrder
          .filter(groupKey => childGroups.has(groupKey))
          .map(groupKey => ({
            key: groupKey,
            meta: groupMetaMap[groupKey] || groupMetaMap['managed-agent'],
            items: childGroups.get(groupKey) || []
          }));

        const childSectionLabel = orderedGroups
          .map(group => `${group.meta.label} ${group.items.length}`)
          .join(' · ') || `组织成员 ${childIds.length}`;

        const groupedChildHtml = orderedGroups.map((group, index) => {
          const subagentItems = group.items.map(subId => {
            const subAgent = agentMap.get(subId);
            if (subAgent) {
              const subActive = subAgent.status === 'active';
              const subColor = subActive ? '#10b981' : '#f59e0b';
              const subBg = subActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)';
              const subBorder = subActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)';
              const organizationLabel = subAgent.organizationLabel || group.meta.label;
              return `
                <div class="clickable agent-subagent-card" onclick="event.stopPropagation(); window.showAgentDetail('${subAgent.id}')" style="
                  padding: 12px; text-align: center;
                  background: ${subBg}; border-radius: 12px; cursor: pointer;
                  border: 1px solid ${subBorder}; transition: all 0.2s;
                " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)';" 
                   onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                  <div style="position: relative; display: inline-block;">
                    <div style="font-size: 2em; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: ${subActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; border-radius: 12px; margin: 0 auto 8px;">
                      ${subAgent.emoji}
                    </div>
                    <span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: ${subColor}; border-radius: 50%; border: 2px solid var(--card-bg); ${subActive ? 'animation: pulse 2s infinite;' : ''}"></span>
                  </div>
                  <div style="font-weight: 600; font-size: 0.85em; color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subAgent.name}</div>
                  <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin-bottom: 4px;">
                    <div style="font-size: 0.65em; padding: 1px 6px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 8px;">${subAgent.role || '助手'}</div>
                    <div style="font-size: 0.65em; padding: 1px 6px; background: ${group.meta.accentBg}; color: ${group.meta.accent}; border-radius: 8px; border: 1px solid ${group.meta.accentBorder};">${organizationLabel}</div>
                  </div>
                  <div style="font-size: 0.7em; color: var(--text-muted);">${subAgent.sessionCount || 0} 会话</div>
                </div>
              `;
            }
            return `
              <div class="agent-subagent-card" style="padding: 12px; text-align: center; background: rgba(100,100,100,0.05); border: 1px dashed var(--border); border-radius: 12px;">
                <div style="font-size: 2em; margin-bottom: 8px;">🔗</div>
                <div style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 2px;">${subId}</div>
                <div style="font-size: 0.7em; color: var(--text-muted);">未配置</div>
              </div>
            `;
          }).join('');

          return `
            <div style="margin-top: ${index === 0 ? 0 : 14}px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.78em; color: var(--text-secondary); margin-bottom: 10px; font-weight: 600;">
                <span>${group.meta.icon}</span>
                <span>${group.meta.label} (${group.items.length})</span>
              </div>
              <div class="agent-subagent-list">
                ${subagentItems}
              </div>
            </div>
          `;
        }).join('');

        subagentsHtml = `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
            <div style="font-size: 0.8em; color: var(--text-secondary); margin-bottom: 10px; font-weight: 500;">
              <span style="margin-right: 4px;">🏷️</span> ${childSectionLabel} (${childIds.length})
            </div>
            ${groupedChildHtml}
          </div>
        `;
      }

      return `
        <div class="agent-org-node" style="margin-bottom: 16px;">
          <div class="agent-card clickable" onclick="window.showAgentDetail('${agent.id}')" style="
            background: var(--card-bg);
            border: 2px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'};
            border-radius: 12px;
            padding: 16px;
            transition: all 0.2s;
            cursor: pointer;
            ${isActive ? 'box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);' : ''}
          " onmouseover="this.style.transform='translateX(4px)'; this.style.borderColor='var(--accent)';" 
             onmouseout="this.style.transform='none'; this.style.borderColor='${isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}';">
            
            <div class="agent-main-head" style="display: grid; grid-template-columns: minmax(220px, 1fr) minmax(360px, auto); gap: 14px; align-items: center;">
              <div class="agent-main-left" style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <div style="font-size: 1.8em; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; background: ${statusBg}; border-radius: 10px;">
                  ${agent.emoji}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.05em; font-weight: 600; color: var(--text-primary);">${agent.name}</span>
                    <span style="font-size: 0.7em; padding: 2px 8px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 10px; font-weight: 500;">${agent.role || '通用助手'}</span>
                  </div>
                  <div style="font-size: 0.75em; color: var(--text-secondary); font-family: monospace;">${agent.id}</div>
                </div>
              </div>
              <div class="agent-main-metas" style="display: grid; grid-template-columns: minmax(170px, 1.4fr) repeat(3, minmax(72px, auto)); gap: 12px; align-items: center; justify-content: end;">
                <div class="agent-meta-item agent-meta-model" style="text-align: center; min-width: 0;">
                  <div style="font-size: 0.7em; color: var(--text-secondary);">模型</div>
                  <div title="${agent.model || 'N/A'}" style="font-size: 0.8em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${agent.model || 'N/A'}</div>
                </div>
                <div class="agent-meta-item" style="text-align: center;">
                  <div style="font-size: 0.7em; color: var(--text-secondary);">会话</div>
                  <div style="font-size: 0.8em; font-weight: 500;">${agent.sessionCount || 0}</div>
                </div>
                <div class="agent-meta-item" style="text-align: center;">
                  <div style="font-size: 0.7em; color: var(--text-secondary);">活动</div>
                  <div style="font-size: 0.8em; font-weight: 500;">${agent.lastActivity ? this._formatRelativeTime(agent.lastActivity) : 'N/A'}</div>
                </div>
                <span class="agent-status-chip" style="padding: 4px 10px; background: ${statusBg}; color: ${statusColor}; border-radius: 16px; font-size: 0.75em; font-weight: 600;">
                  <span style="display: inline-block; width: 5px; height: 5px; background: ${statusColor}; border-radius: 50%; margin-right: 5px; ${isActive ? 'animation: pulse 2s infinite;' : ''}"></span>
                  ${statusText}
                </span>
              </div>
            </div>
            ${subagentsHtml}
          </div>
        </div>
      `;
    }
    
    // 子 Agent 不单独渲染（已内联在主 Agent 中）
    return '';
  }

  // 格式化相对时间
  _formatRelativeTime(dateString) {
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

  // 更新当前任务
  updateCurrentTasks() {
    // 更新任务Agent过滤器选项
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

    // 如果搜索管理器存在且没有搜索关键词，使用原始渲染
    if (!window.searchManager || !window.searchManager.currentFilters.tasks.keyword) {
      const html = this.data.tasks.current.slice(0, 10).map(task => `
        <div class="task-item clickable" onclick="window.showTaskDetail('${task.id}')">
          <div class="task-header">
            <span><strong>${task.agentName}</strong></span>
            <span class="badge badge-blue">进行中</span>
          </div>
          <div class="task-title" style="margin: 6px 0 4px; font-size: 0.95em; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📌 ${task.title || '(无标题)'}</div>
          <div class="task-id" style="font-size: 0.8em; color: var(--text-muted);">ID: ${task.id.substring(0, 12)}...</div>
          <div class="task-time">消息数: ${task.messageCount} | 更新: ${new Date(task.lastUpdate).toLocaleString('zh-CN')}</div>
        </div>
      `).join('');
      const ctPanel = document.getElementById('currentTasks');
      if (ctPanel) ctPanel.innerHTML = html;
    } else {
      // 有搜索关键词，让搜索管理器处理
      window.searchManager.filterTasks();
    }
  }

  // 更新通道状态
  updateChannelsStatus() {
    if (!this.data.channels || this.data.channels.length === 0) {
      const cs = document.getElementById('channelsStatus');
      if (cs) cs.innerHTML = '<div class="empty-state">暂无通道</div>';
      return;
    }

    const html = this.data.channels.map(channel => {
      const statusClass = channel.status === 'normal' ? 'status-ok' : 
                         channel.status === 'warning' ? 'status-warn' : 'status-error';
      const statusText = channel.status === 'normal' ? '正常' : 
                        channel.status === 'warning' ? '警告' : '异常';
      const statusIcon = channel.status === 'normal' ? '✅' : 
                        channel.status === 'warning' ? '⚠️' : '❌';
      
      return `
        <div class="channel-item">
          <div class="channel-name">${this.getChannelIcon(channel.name)} ${channel.name}</div>
          <div class="channel-status ${statusClass}">${statusIcon} ${statusText}</div>
          ${channel.lastMessage ? `<div style="font-size: 0.8em; color: var(--text-muted); margin-top: 4px;">${channel.lastMessage}</div>` : ''}
        </div>
      `;
    }).join('');
    const csPanel = document.getElementById('channelsStatus');
    if (csPanel) csPanel.innerHTML = `<div class="channel-grid">${html}</div>`;
  }

  // 获取通道图标
  getChannelIcon(name) {
    const icons = {
      telegram: '📱',
      discord: '🎮',
      whatsapp: '💬',
      feishu: '📋'
    };
    return icons[name.toLowerCase()] || '📡';
  }

  // 更新模型配额
  updateModelsQuota() {
    if (!this.data.models || this.data.models.length === 0) {
      const mq = document.getElementById('modelsQuota');
      if (mq) mq.innerHTML = '<div class="empty-state">暂无模型信息</div>';
      return;
    }

    // 调试：打印模型数据
    console.log('[前端] 模型数据:', this.data.models);
    console.log('[前端] 模型数量:', this.data.models.length);

    // 按提供商分组模型
    const providerGroups = {};
    this.data.models.forEach(model => {
      const provider = model.provider || 'unknown';
      const quotaUsed = Number(model.quotaUsed) || 0;
      const quotaTotal = Number(model.quotaTotal) || 0;
      
      console.log(`[前端] 处理模型: ${model.name}, 提供商: ${provider}, quotaUsed=${quotaUsed} (${typeof model.quotaUsed}), quotaTotal=${quotaTotal} (${typeof model.quotaTotal})`);
      
      if (!providerGroups[provider]) {
        // 初始化时使用第一个模型的配额信息
        providerGroups[provider] = {
          provider: provider,
          models: [],
          quotaUsed: quotaUsed,
          quotaTotal: quotaTotal,
          quotaExtra: model.quotaExtra
        };
        console.log(`[前端] 初始化提供商 ${provider}: quotaUsed=${quotaUsed}, quotaTotal=${quotaTotal}`);
      } else {
        // 同一提供商的模型共享配额，使用最大的配额值（通常所有模型的值相同）
        // 优先使用非零值
        if (quotaTotal > 0 && providerGroups[provider].quotaTotal === 0) {
          providerGroups[provider].quotaTotal = quotaTotal;
          providerGroups[provider].quotaUsed = quotaUsed;
          console.log(`[前端] 更新提供商 ${provider} 配额: quotaUsed=${quotaUsed}, quotaTotal=${quotaTotal}`);
        } else if (quotaTotal > 0 && quotaTotal !== providerGroups[provider].quotaTotal) {
          // 如果配额值不同，使用较大的值
          if (quotaTotal > providerGroups[provider].quotaTotal) {
            providerGroups[provider].quotaTotal = quotaTotal;
            providerGroups[provider].quotaUsed = quotaUsed;
            console.log(`[前端] 更新提供商 ${provider} 配额（使用较大值）: quotaUsed=${quotaUsed}, quotaTotal=${quotaTotal}`);
          }
        }
      }
      providerGroups[provider].models.push(model);
    });
    
    console.log('[前端] 分组后的提供商:', Object.keys(providerGroups));
    console.log('[前端] 分组数据:', providerGroups);

    // 生成 HTML
    const html = Object.values(providerGroups).map(group => {
      // 确保转换为数字类型
      const quotaUsed = Number(group.quotaUsed) || 0;
      const quotaTotal = Number(group.quotaTotal) || 0;
      const quotaRemaining = quotaTotal > 0 ? quotaTotal - quotaUsed : 0;
      const quotaPercentage = quotaTotal > 0 ? ((quotaUsed / quotaTotal) * 100).toFixed(1) : 0;
      
      console.log(`[前端] 生成HTML - 提供商 ${group.provider}: quotaUsed=${quotaUsed}, quotaTotal=${quotaTotal}, quotaRemaining=${quotaRemaining}, quotaPercentage=${quotaPercentage}`);
      
      // 根据配额使用率设置颜色和样式
      const totalNum = Number(quotaTotal);
      const usedNum = Number(quotaUsed);
      const remaining = totalNum > 0 ? totalNum - usedNum : 0;
      const percentage = totalNum > 0 ? ((usedNum / totalNum) * 100).toFixed(1) : 0;
      
      // 判断提供商类型
      const isMiniMaxCoding = group.provider === 'minimax-coding';
      const isMoonshot = group.provider.includes('moonshot') || group.provider.includes('kimi');
      
      // 判断是余额（USD）还是调用次数
      const isBalance = isMoonshot || (totalNum < 10000 && (totalNum % 1 !== 0 || usedNum % 1 !== 0));
      const unit = isMiniMaxCoding ? ' prompts' : (isBalance ? ' USD' : ' 次');
      
      let quotaColor = '#10b981'; // 绿色 - 正常
      let quotaBgColor = 'rgba(16, 185, 129, 0.1)';
      let quotaStatus = '充足';
      let progressColor = '#10b981';
      
      if (totalNum > 0) {
        if (percentage >= 90) {
          quotaColor = '#ef4444'; // 红色 - 危险
          quotaBgColor = 'rgba(239, 68, 68, 0.1)';
          quotaStatus = '不足';
          progressColor = '#ef4444';
        } else if (percentage >= 70) {
          quotaColor = '#f59e0b'; // 黄色 - 警告
          quotaBgColor = 'rgba(245, 158, 11, 0.1)';
          quotaStatus = '较低';
          progressColor = '#f59e0b';
        }
      }
      
      console.log(`[前端] 提供商 ${group.provider} 配额检查: totalNum=${totalNum}, usedNum=${usedNum}, remaining=${remaining}`);

      // 列出该提供商下的所有模型
      const modelsList = group.models.map(m => m.name || m.modelName || m.modelId || m.model || '未知模型').join('、');
      const maxContextWindow = Math.max(...group.models.map(m => m.contextWindow || 0));
      
      // 生成余额显示 HTML
      let quotaHtml = '';
      
      if (isMiniMaxCoding && totalNum > 0) {
        // Minimax Coding Plan 特殊显示
        const remainsTimeMs = Number(group.quotaExtra) || 0;
        const remainsHours = Math.floor(remainsTimeMs / (1000 * 60 * 60));
        const remainsMins = Math.floor((remainsTimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const timeDisplay = remainsTimeMs > 0 ? `${remainsHours}小时 ${remainsMins}分钟` : '计算中...';
        
        // 时间进度（5小时窗口 = 18000000ms）
        const timePercentage = remainsTimeMs > 0 ? Math.min(100, (remainsTimeMs / 18000000) * 100).toFixed(1) : 0;
        
        quotaHtml = `
          <div style="margin-top: 10px; padding: 14px; background: linear-gradient(135deg, ${quotaBgColor}, rgba(99, 102, 241, 0.1)); border-radius: 10px; border-left: 4px solid ${quotaColor};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${quotaColor}" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Coding Plan
              </span>
              <span style="padding: 2px 10px; background: ${quotaColor}; color: white; border-radius: 12px; font-size: 0.75em; font-weight: 600;">${quotaStatus}</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 4px;">剩余 Prompts</div>
                <div style="font-size: 1.4em; font-weight: 700; color: ${quotaColor};">${remaining}</div>
                <div style="font-size: 0.7em; color: var(--text-secondary);">/ ${totalNum} 总量</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 4px;">窗口剩余时间</div>
                <div style="font-size: 1.1em; font-weight: 600; color: #6366f1;">${timeDisplay}</div>
                <div style="font-size: 0.7em; color: var(--text-secondary);">5小时滚动窗口</div>
              </div>
            </div>
            
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75em; color: var(--text-secondary); margin-bottom: 3px;">
                <span>Prompt 使用率</span>
                <span>${percentage}%</span>
              </div>
              <div style="background: rgba(0,0,0,0.15); border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: ${progressColor}; border-radius: 4px; transition: width 0.3s;"></div>
              </div>
            </div>
            
            <div style="font-size: 0.7em; color: var(--text-secondary); padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
              <span style="opacity: 0.8;">💡 提示：1 prompt ≈ 15 次 API 调用，额度每 5 小时动态重置</span>
            </div>
          </div>
        `;
      } else if (totalNum > 0) {
        // 通用余额显示（Moonshot 等）
        let extraInfo = '';
        if (isBalance) {
          extraInfo = `<div style="font-size: 0.7em; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">按 token 使用量计费</div>`;
        }
        
        quotaHtml = `
          <div style="margin-top: 10px; padding: 12px; background: ${quotaBgColor}; border-radius: 8px; border-left: 4px solid ${quotaColor};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 600; color: var(--text-primary);">余额状态</span>
              <span style="padding: 2px 8px; background: ${quotaColor}; color: white; border-radius: 4px; font-size: 0.75em; font-weight: 600;">${quotaStatus}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <span style="font-size: 1.5em; font-weight: 700; color: ${quotaColor};">${remaining.toLocaleString('zh-CN', { maximumFractionDigits: isBalance ? 2 : 0 })}${unit}</span>
              <span style="color: var(--text-secondary); font-size: 0.9em;">/ ${totalNum.toLocaleString('zh-CN', { maximumFractionDigits: isBalance ? 2 : 0 })}${unit}</span>
            </div>
            <div style="background: rgba(0,0,0,0.1); border-radius: 4px; height: 6px; overflow: hidden;">
              <div style="width: ${percentage}%; height: 100%; background: ${progressColor}; border-radius: 4px; transition: width 0.3s;"></div>
            </div>
            <div style="text-align: right; font-size: 0.8em; color: var(--text-secondary); margin-top: 4px;">已使用 ${percentage}%</div>
            ${extraInfo}
          </div>
        `;
      } else {
        // 余额未配置时仍显示提供商和模型列表（不显示配额部分）
        return `
      <div class="status-item">
        <span class="status-label">${group.provider}</span>
        <span class="badge badge-green">正常</span>
      </div>
      <div style="font-size: 0.85em; color: var(--text-secondary); margin-left: 10px; margin-bottom: 15px; line-height: 1.5; min-width: 0;">
        <div style="margin-bottom: 5px; word-break: break-word; overflow-wrap: anywhere;">
          <strong>模型:</strong> ${modelsList}
        </div>
        <div style="margin-bottom: 5px;">
          最大上下文窗口: ${maxContextWindow.toLocaleString()}
        </div>
        <div style="font-size: 0.75em; color: var(--text-muted); padding: 8px; background: rgba(0,0,0,0.03); border-radius: 6px; margin-top: 8px;">
          💡 配额信息暂不可用
        </div>
      </div>
    `;
      }
      
      return `
      <div class="status-item">
        <span class="status-label">${group.provider}</span>
        <span class="badge badge-green">正常</span>
      </div>
      <div style="font-size: 0.85em; color: var(--text-secondary); margin-left: 10px; margin-bottom: 15px; line-height: 1.5; min-width: 0;">
        <div style="margin-bottom: 5px; word-break: break-word; overflow-wrap: anywhere;">
          <strong>模型:</strong> ${modelsList}
        </div>
        <div style="margin-bottom: 5px;">
          最大上下文窗口: ${maxContextWindow.toLocaleString()}
        </div>
        ${quotaHtml}
      </div>
    `;
    }).join('');
    
    const mqPanel = document.getElementById('modelsQuota');
    if (mqPanel) mqPanel.innerHTML = html;
  }

  // 更新任务历史
  updateTaskHistory() {
    if (!this.data.tasks || !this.data.tasks.history || this.data.tasks.history.length === 0) {
      const th = document.getElementById('taskHistory');
      if (th) th.innerHTML = '<div class="empty-state">暂无历史任务</div>';
      return;
    }

    // 如果搜索管理器存在且没有搜索关键词，使用原始渲染
    if (!window.searchManager || !window.searchManager.currentFilters.tasks.keyword) {
      const html = this.data.tasks.history.slice(0, 10).map(task => `
        <div class="task-item clickable" onclick="window.showTaskDetail('${task.id}')">
          <div class="task-header">
            <span><strong>${task.agentName}</strong></span>
            <span class="badge badge-green">已完成</span>
          </div>
          <div class="task-title" style="margin: 6px 0 4px; font-size: 0.95em; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📌 ${task.title || '(无标题)'}</div>
          <div class="task-id" style="font-size: 0.8em; color: var(--text-muted);">ID: ${task.id.substring(0, 12)}...</div>
          <div class="task-time">消息数: ${task.messageCount} | 完成: ${new Date(task.lastUpdate).toLocaleString('zh-CN')}</div>
        </div>
      `).join('');
      const thPanel = document.getElementById('taskHistory');
      if (thPanel) thPanel.innerHTML = html;
    } else {
      // 有搜索关键词，让搜索管理器处理
      window.searchManager.filterTasks();
    }
  }

  // 更新模型使用量统计面板
  async updateModelUsageStats() {
    const container = document.getElementById('modelUsageStats');
    if (!container) return;

    // 获取时间范围选择器
    const rangeSelect = document.getElementById('modelUsageRange');
    const selectedValue = rangeSelect ? rangeSelect.value : '';
    // 空字符串表示全历史，传递给后端时不带 days 参数（或 days=null）
    const daysParam = selectedValue ? `days=${selectedValue}` : '';

    // 绑定时间范围切换事件（只绑定一次）
    if (rangeSelect && !rangeSelect._bound) {
      rangeSelect._bound = true;
      rangeSelect.addEventListener('change', () => {
        this.panelRefreshState.modelUsage = 0;
        this.updateModelUsageStats();
      });
    }

    // 获取当前选中的 Token 维度（默认总量）
    if (!this.modelTokenDimension) {
      this.modelTokenDimension = 'total';
    }
    const tokenDimension = this.modelTokenDimension;

    try {
      const data = await this.fetchJsonWithTimeout(`/api/models/usage?${daysParam}`, 10000);

      if (!data || data.summary.totalCalls === 0) {
        container.innerHTML = '<div class="empty-state">暂无模型使用记录</div>';
        return;
      }

      const s = data.summary;
      const topModel = data.byModel && data.byModel.length > 0 ? data.byModel[0] : null;
      const topAgent = data.byAgent && data.byAgent.length > 0 ? data.byAgent[0] : null;
      const avgDailyCalls = data.byDay && data.byDay.length > 0
        ? Math.round(data.byDay.reduce((sum, d) => sum + (d.total || 0), 0) / data.byDay.length)
        : 0;

      // Token 消耗速度（tok/h）与趋势
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

      // 颜色调色板
      const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
      ];

      // === 顶部概览条 ===
      const totalTokens = (data.summary?.totalTokens) || (data.byModel || []).reduce((sum,m)=>sum+(m.tokens||0),0);
      const tokenDisplay = totalTokens >= 1000000 ? 
        `${(totalTokens / 1000000).toFixed(1)}M` : 
        totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens;
      
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

      const formatTokens = (v) => {
        const n = Number(v) || 0;
        if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return `${n}`;
      };

      // 根据选中的维度获取 token 值
      const getTokenValue = (m) => {
        if (tokenDimension === 'input') return m.inputTokens || 0;
        if (tokenDimension === 'output') return m.outputTokens || 0;
        return m.tokens || 0; // total
      };

      // 过滤掉0 token的模型（delivery-mirror, gateway-injected等）
      const validModels = (data.byModel || []).filter(m => (m.tokens || 0) > 0);

      const modelTokenRank = [...validModels].sort((a, b) => getTokenValue(b) - getTokenValue(a));
      const maxModelTokens = modelTokenRank.length > 0 ? getTokenValue(modelTokenRank[0]) || 1 : 1;
      const totalInputTokens = validModels.reduce((sum, m) => sum + (m.inputTokens || 0), 0);
      const totalOutputTokens = validModels.reduce((sum, m) => sum + (m.outputTokens || 0), 0);
      const ioTotal = totalInputTokens + totalOutputTokens;
      const inputPct = ioTotal > 0 ? ((totalInputTokens / ioTotal) * 100).toFixed(1) : '0.0';
      const outputPct = ioTotal > 0 ? ((totalOutputTokens / ioTotal) * 100).toFixed(1) : '0.0';

      // 计算当前维度的总 token
      const getDimensionTotal = () => {
        if (tokenDimension === 'input') return totalInputTokens;
        if (tokenDimension === 'output') return totalOutputTokens;
        return totalTokens;
      };
      const dimensionTotal = getDimensionTotal();

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

      // === 各模型 Token 使用量（多元展示，保持主风格） ===
      const modelTokenBarsHtml = modelTokenRank.slice(0, 8).map((m, i) => {
        const tokenValue = getTokenValue(m);
        const tokenPct = maxModelTokens > 0 ? ((tokenValue / maxModelTokens) * 100).toFixed(0) : 0;
        const color = colors[i % colors.length];
        const sharePct = dimensionTotal > 0 ? ((tokenValue / dimensionTotal) * 100).toFixed(1) : '0.0';
        return `
          <div class="mu-token-bar-row" style="display: grid; grid-template-columns: minmax(120px, 1.2fr) 2.4fr auto; gap: 10px; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 0.82em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.provider}/${m.modelName}">${m.modelName}</div>
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
              <div style="font-size:0.88em; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.provider}/${m.modelName}">${m.modelName}</div>
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
              <!-- Token 维度切换按钮 -->
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

      // === 中间区域：按模型 + 按Agent 并排 ===
      const maxModelCount = validModels.length > 0 ? validModels[0].count : 1;
      const modelBarsHtml = validModels.slice(0, 8).map((m, i) => {
        const pct = (m.count / maxModelCount * 100).toFixed(0);
        const color = colors[i % colors.length];
        return `
          <div class="mu-rank-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="mu-rank-label" style="width: 120px; font-size: 0.82em; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.provider}/${m.modelName}">${m.modelName}</div>
            <div style="flex: 1; background: rgba(0,0,0,0.06); border-radius: 4px; height: 22px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 4px; transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                ${pct > 15 ? `<span style="font-size: 0.75em; color: white; font-weight: 600;">${m.count}</span>` : ''}
              </div>
            </div>
            ${pct <= 15 ? `<span style="font-size: 0.8em; font-weight: 600; color: var(--text-primary); min-width: 30px;">${m.count}</span>` : '<span style="min-width: 30px;"></span>'}
          </div>
        `;
      }).join('');

      const maxAgentTotal = data.byAgent.length > 0 ? data.byAgent[0].total : 1;
      const agentBarsHtml = data.byAgent.slice(0, 8).map((a, i) => {
        const pct = (a.total / maxAgentTotal * 100).toFixed(0);
        const color = colors[(i + 3) % colors.length];
        return `
          <div class="mu-agent-rank-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="mu-rank-label" style="width: 100px; font-size: 0.82em; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.agentName}">${a.agentEmoji || '🤖'} ${a.agentName}</div>
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
            <div style="font-size: 0.95em; color: var(--text-primary); font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topModel ? `${topModel.provider}/${topModel.modelName}` : '暂无数据'}">${topModel ? topModel.modelName : '暂无数据'}</div>
            <div style="font-size: 0.8em; color: #6366f1; margin-top: 4px;">${topModel ? `${topModel.count} 次调用` : '--'}</div>
          </div>
          <div style="padding: 12px; border-radius: 10px; background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.2);">
            <div style="font-size: 0.8em; color: var(--text-secondary);">高频 Agent</div>
            <div style="font-size: 0.95em; color: var(--text-primary); font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topAgent ? topAgent.agentName : '暂无数据'}">${topAgent ? `${topAgent.agentEmoji || '🤖'} ${topAgent.agentName}` : '暂无数据'}</div>
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

      // === Token 效率榜（每次调用平均 token）===
      const tokenEfficiencyRank = [...validModels]
        .map(m => ({
          ...m,
          avgTokenPerCall: m.count > 0 ? Math.round((m.tokens || 0) / m.count) : 0
        }))
        .sort((a, b) => b.avgTokenPerCall - a.avgTokenPerCall)
        .slice(0, 6);

      // === 指挥中心态势增强（监控向）===
      const topAgentToken = (data.byAgent || []).slice(0, 5);
      const maxAgentTokens = Math.max(...topAgentToken.map(a => a.totalTokens || 0), 1);
      const agentCombatHtml = topAgentToken.map((a, idx) => {
        const pct = Math.max(5, Math.round(((a.totalTokens || 0) / maxAgentTokens) * 100));
        return `
          <div class="mu-agent-combat-row" style="display:grid; grid-template-columns: minmax(90px, 1.1fr) 2fr auto; gap:8px; align-items:center; margin-bottom:7px;">
            <div style="font-size:0.8em; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a.agentEmoji || '🤖'} ${a.agentName}</div>
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
              <div style="font-size:0.82em; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.provider}/${m.modelName}">${m.modelName}</div>
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

      // === Agent-Model 贡献洞察 ===
      // 找出 Top 3 Agent，展示每个 Agent 的主力模型和 token 贡献
      const topAgents = (data.byAgent || []).slice(0, 3);
      const modelNameByKey = Object.fromEntries(validModels.map(m => [`${m.provider}/${m.modelId}`, m.modelName || m.modelId]));
      const agentModelInsightsHtml = topAgents.map((agent, idx) => {
        // 直接使用 byAgent.models（后端稳定字段）构建该 Agent 的模型贡献
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
        
        const modelMiniListHtml = agentModels.map((am, i) => {
          const tokenShare = agentTotalTokens > 0 ? ((am.tokens || 0) / agentTotalTokens * 100).toFixed(0) : 0;
          return `
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <div style="flex:1; font-size:0.75em; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${am.modelName}">${am.modelName}</div>
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
                <div style="font-size:0.88em; font-weight:600; color:var(--text-primary);">${agent.agentName}</div>
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

      const recentByDay = [...(data.byDay || [])].slice(-7);
      const maxRecentDayTokens = Math.max(...recentByDay.map(d => d.totalTokens || 0), 1);
      const timelineHtml = recentByDay.length > 0 ? recentByDay.map(d => {
        const dt = new Date(d.date);
        const dayLabel = Number.isNaN(dt.getTime()) ? d.date : dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        const pct = Math.max(4, Math.round(((d.totalTokens || 0) / maxRecentDayTokens) * 100));
        return `
          <div class="mu-timeline-row" style="display:grid; grid-template-columns: 64px 1fr auto; gap:8px; align-items:center; margin-bottom:7px;">
            <div style="font-size:0.75em; color:var(--text-secondary);">${dayLabel}</div>
            <div style="height:10px; border-radius:999px; background:rgba(0,0,0,0.06); overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, rgba(59,130,246,0.8), rgba(168,85,247,0.8)); border-radius:999px;"></div>
            </div>
            <div style="font-size:0.75em; color:var(--text-primary); font-weight:600; min-width:64px; text-align:right;">${formatTokens(d.totalTokens || 0)}</div>
          </div>
        `;
      }).join('') : '<div class="empty-state">暂无时间线数据</div>';

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

      // 关键修复：按“自然周”分桶，避免跨周累计到同一周内日。
      const weekBuckets = {};
      (data.byDay || []).forEach(d => {
        const dt = parseLocalDate(d.date);
        if (!dt || Number.isNaN(dt.getTime())) return;
        // ISO 周：周一=0 ... 周日=6
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

      // === 底部趋势图区域 ===
      const trendHtml = `
        <div>
          <h4 style="margin: 0 0 12px; font-size: 0.95em; color: var(--text-primary);">每日调用趋势</h4>
          <div style="height: 200px; position: relative;">
            <canvas id="modelUsageTrendCanvas"></canvas>
          </div>
          <div class="mu-trend-grid" style="margin-top: 14px; display:flex; flex-wrap:wrap; gap:12px; align-items:flex-start;">
            <div style="flex:1 1 320px; min-width:300px; padding: 12px; border-radius: 10px; border: 1px solid rgba(59,130,246,0.15); background: rgba(59,130,246,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                <h4 style="margin: 0; font-size: 0.9em; color: var(--text-primary);">🎯 作战态势时间线（近7天）</h4>
                <span style="font-size:0.72em; color:var(--text-secondary);">按每日 token</span>
              </div>
              ${timelineHtml}
            </div>
            <div style="flex:1.3 1 520px; min-width:360px; padding: 12px; border-radius: 10px; border: 1px solid rgba(59,130,246,0.15); background: rgba(59,130,246,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                <h4 style="margin: 0; font-size: 0.9em; color: var(--text-primary);">🔥 时段热力（按自然周内日）</h4>
                <span style="font-size:0.72em; color:var(--text-secondary);">展示最近 ${Math.max(weekRows.length, 1)} 个自然周</span>
              </div>
              ${weekHeatGridHtml}
            </div>
          </div>
        </div>
      `;

      container.innerHTML = summaryHtml + insightsHtml + commandCenterHtml + modelTokensHtml + tokenEfficiencyHtml + agentModelInsightsBlockHtml + middleHtml + trendHtml;

      // 绑定 Token 维度切换按钮事件
      const dimBtns = container.querySelectorAll('.dim-btn');
      dimBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const selectedDim = e.target.dataset.dimension;
          if (selectedDim && selectedDim !== this.modelTokenDimension) {
            this.modelTokenDimension = selectedDim;
            this.updateModelUsageStats();
          }
        });
      });

      // 渲染趋势图表
      if (window.chartsManager && data.byDay.length > 0) {
        window.chartsManager.renderModelUsageTrend(data);
      }

      // 异步内容加载完毕，直接重排瀑布流
      if (window.uiEnhancements && window.uiEnhancements.layoutMasonry) {
        window.uiEnhancements.layoutMasonry();
      }

    } catch (error) {
      console.error('更新模型使用量统计失败:', error);
      container.innerHTML = '<div class="empty-state" style="color: var(--error);">加载模型使用量失败</div>';
    }
  }

  // 更新技能使用统计面板
  async updateSkillUsageStats() {
    const container = document.getElementById('skillUsageStats');
    if (!container) return;

    const rangeSelect = document.getElementById('skillUsageRange');
    const selectedValue = rangeSelect ? rangeSelect.value : '7';
    const daysParam = selectedValue ? `days=${selectedValue}` : '';

    if (rangeSelect && !rangeSelect._bound) {
      rangeSelect._bound = true;
      rangeSelect.addEventListener('change', () => {
        this.panelRefreshState.skillUsage = 0;
        this.updateSkillUsageStats();
      });
    }

    try {
      const response = await fetch(`/api/skills/usage?${daysParam}`);
      if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);

      const data = await response.json();
      const summary = data.summary || {};
      const reads = data.skillReads || [];
      const execs = data.skillExecs || [];
      const findings = data.findings || [];

      const summaryCards = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom: 14px;">
          <div style="padding:12px; border-radius:10px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); text-align:center;">
            <div style="font-size:1.35em; font-weight:700; color:#3b82f6;">${(summary.totalToolCalls || 0).toLocaleString()}</div>
            <div style="font-size:0.78em; color:var(--text-secondary);">总工具调用</div>
          </div>
          <div style="padding:12px; border-radius:10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); text-align:center;">
            <div style="font-size:1.35em; font-weight:700; color:#10b981;">${(summary.skillReads || 0).toLocaleString()}</div>
            <div style="font-size:0.78em; color:var(--text-secondary);">技能说明读取</div>
          </div>
          <div style="padding:12px; border-radius:10px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2); text-align:center;">
            <div style="font-size:1.35em; font-weight:700; color:#8b5cf6;">${(summary.skillExecs || 0).toLocaleString()}</div>
            <div style="font-size:0.78em; color:var(--text-secondary);">技能实际执行</div>
          </div>
          <div style="padding:12px; border-radius:10px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); text-align:center;">
            <div style="font-size:1.35em; font-weight:700; color:#f59e0b;">${summary.execSkillUsageRate || 0}%</div>
            <div style="font-size:0.78em; color:var(--text-secondary);">exec技能命中率</div>
          </div>
        </div>
      `;

      const renderList = (arr, emptyText) => {
        if (!arr || arr.length === 0) {
          return `<div class="empty-state">${emptyText}</div>`;
        }
        return arr.slice(0, 8).map(item => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--bg-secondary); border-radius:8px; margin-bottom:6px;">
            <span style="font-size:0.86em; color:var(--text-primary);">${item.name}</span>
            <span style="font-size:0.82em; color:var(--text-secondary); font-weight:600;">${item.count}</span>
          </div>
        `).join('');
      };

      const findingsHtml = findings.length > 0
        ? `<div style="margin-top:12px; padding:10px; border-radius:10px; border:1px solid rgba(239,68,68,0.18); background:rgba(239,68,68,0.04);">
            <div style="font-size:0.84em; font-weight:600; color:#ef4444; margin-bottom:6px;">⚠️ 待改进</div>
            ${findings.map(f => `<div style="font-size:0.8em; color:var(--text-secondary); margin-bottom:4px;">• ${f}</div>`).join('')}
          </div>`
        : `<div style="margin-top:12px; padding:10px; border-radius:10px; border:1px solid rgba(16,185,129,0.18); background:rgba(16,185,129,0.04); font-size:0.82em; color:#10b981;">✅ 统计窗口内未发现技能使用缺口</div>`;

      container.innerHTML = `
        ${summaryCards}
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div style="padding:12px; border-radius:10px; border:1px solid rgba(59,130,246,0.18); background:rgba(59,130,246,0.03);">
            <div style="font-size:0.9em; font-weight:600; color:var(--text-primary); margin-bottom:8px;">📘 技能说明读取</div>
            ${renderList(reads, '暂无读取记录')}
          </div>
          <div style="padding:12px; border-radius:10px; border:1px solid rgba(139,92,246,0.18); background:rgba(139,92,246,0.03);">
            <div style="font-size:0.9em; font-weight:600; color:var(--text-primary); margin-bottom:8px;">⚙️ 技能实际执行</div>
            ${renderList(execs, '暂无执行记录')}
          </div>
        </div>
        ${findingsHtml}
      `;

      if (window.uiEnhancements && window.uiEnhancements.layoutMasonry) {
        window.uiEnhancements.layoutMasonry();
      }
    } catch (error) {
      console.error('更新技能使用统计失败:', error);
      container.innerHTML = '<div class="empty-state" style="color: var(--error);">加载技能统计失败</div>';
    }
  }

  // 更新消息流面板（侧边栏布局）
  async updateMessagesPanel() {
    const panel = document.getElementById('messagesContent');
    if (!panel) return;

    try {
      const data = await this.fetchJsonWithTimeout('/api/messages/stream?limit=50&compact=1', 8000);
      if (data.messages.length === 0) {
        panel.innerHTML = '<div class="empty-state">暂无消息</div>';
        return;
      }

      const html = data.messages.map(msg => `
        <div class="message-item message-${msg.role || 'user'}">
          <div class="message-header">
            <span class="message-role">${msg.agentName || '系统'}</span>
            <span class="message-time">${new Date(msg.timestamp).toLocaleString('zh-CN')}</span>
          </div>
          <div class="message-content">${this.escapeHtml(msg.content || msg.text || '')}</div>
        </div>
      `).join('');
      
      panel.innerHTML = `<div class="messages-container">${html}</div>`;
    } catch (error) {
      console.error('更新消息流失败:', error);
    }
  }

  // 更新日志（节流，避免频繁更新）
  updateLogs() {
    if (this.logUpdateTimer) return;
    
    this.logUpdateTimer = setTimeout(async () => {
      try {
        const container = document.getElementById('logContainer');
        if (!container) {
          this.logUpdateTimer = null;
          return;
        }

        const response = await fetch('/api/logs/recent?count=50');
        if (!response.ok) {
          throw new Error(`HTTP错误: ${response.status}`);
        }
        const logs = await response.json();
        
        // 更新搜索管理器的日志缓存
        if (window.searchManager) {
          window.searchManager.updateLogsCache(logs);
        } else {
          // 如果没有搜索管理器，使用原始渲染方式
          if (!Array.isArray(logs) || logs.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无日志</div>';
          } else {
            const html = logs.map(log => {
              const levelClass = log.level === 'error' ? 'log-error' : 
                                log.level === 'warn' ? 'log-warn' : 'log-info';
              const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
              // 转义HTML防止XSS
              const message = this.escapeHtml(log.message);
              return `<div class="log-entry ${levelClass}">
                <span class="log-time">${time}</span>
                ${message}
              </div>`;
            }).join('');
            
            const wasScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10;
            container.innerHTML = html;
            
            if (this.autoScroll && wasScrolledToBottom) {
              container.scrollTop = container.scrollHeight;
            }
          }
        }
      } catch (error) {
        console.error('更新日志失败:', error);
        // 显示错误状态
        const container = document.getElementById('logContainer');
        if (container) {
          container.innerHTML = '<div class="empty-state" style="color: var(--error);">日志加载失败</div>';
        }
      } finally {
        this.logUpdateTimer = null;
      }
    }, 1000); // 最多每秒更新一次日志
  }

  // 定期刷新数据（作为WebSocket的备选方案）
  startPolling() {
    if (this._pollingTimer) clearInterval(this._pollingTimer);
    this._pollingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // WebSocket未连接时，使用轮询更新数据
        this.loadInitialData();
      }
    }, 10000); // 每10秒轮询一次
  }

  // 定期更新图表（独立于数据更新）
  startChartUpdates() {
    if (this._chartTimer) clearInterval(this._chartTimer);
    this._chartTimer = setInterval(() => {
      if (window.chartsManager) {
        window.chartsManager.updateAllCharts();
      }
    }, 30000); // 每30秒更新一次图表
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 启动时钟
  startClock() {
    const updateClock = () => {
      const el = document.getElementById('updateTime');
      if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('zh-CN');
      }
    };
    updateClock();
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._clockTimer = setInterval(updateClock, 1000);
  }
}

// 页面加载完成后初始化（挂到 window 供 search.js 等模块使用）
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});
