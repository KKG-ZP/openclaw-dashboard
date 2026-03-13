/**
 * Agent 拓扑视图 — Phase 5 作战指挥中心可视化升级
 * 纯 CSS flexbox + ::before/::after 连接线
 */
import { Disposable } from '../core/disposable.js';
import { escapeHtml } from '../utils/html-escape.js';
import { formatRelativeTime } from '../utils/time-format.js';

export class AgentTopology extends Disposable {
  constructor() {
    super();
    this._viewMode = 'list'; // 'list' | 'topology'
    this._styleInjected = false;
  }

  /** 获取当前视图模式 */
  get viewMode() { return this._viewMode; }

  /** 切换视图模式 */
  setViewMode(mode) {
    this._viewMode = mode;
  }

  /** 渲染拓扑视图 HTML */
  renderTopology(agents) {
    if (!agents || agents.length === 0) return '<div class="empty-state">暂无Agent</div>';

    this._injectStyles();

    const agentMap = new Map(agents.map(a => [a.id, a]));
    const childrenMap = new Map();

    agents.forEach(agent => {
      if (agent.parentId && agentMap.has(agent.parentId)) {
        if (!childrenMap.has(agent.parentId)) childrenMap.set(agent.parentId, []);
        const bucket = childrenMap.get(agent.parentId);
        if (!bucket.includes(agent.id)) bucket.push(agent.id);
      }
      if (agent.subagents) {
        agent.subagents.forEach(subId => {
          if (agentMap.has(subId)) {
            if (!childrenMap.has(agent.id)) childrenMap.set(agent.id, []);
            const bucket = childrenMap.get(agent.id);
            if (!bucket.includes(subId)) bucket.push(subId);
          }
        });
      }
    });

    const childAgentIds = new Set(Array.from(childrenMap.values()).flat());
    const mainAgents = agents.filter(a => !childAgentIds.has(a.id));

    // Stats bar
    const activeCount = agents.filter(a => a.status === 'active').length;
    const idleCount = agents.filter(a => a.status === 'idle').length;
    const totalSessions = agents.reduce((sum, a) => sum + (a.sessionCount || 0), 0);

    const statsHtml = `
      <div class="topo-stats">
        <div class="topo-stat" style="--accent: #3b82f6;">${agents.length}<span>Agent 总数</span></div>
        <div class="topo-stat" style="--accent: #10b981;">${activeCount}<span>活跃中</span></div>
        <div class="topo-stat" style="--accent: #f59e0b;">${idleCount}<span>空闲中</span></div>
        <div class="topo-stat" style="--accent: #8b5cf6;">${totalSessions}<span>总会话数</span></div>
      </div>
    `;

    // Topology tree
    const treeHtml = mainAgents.map(agent => {
      const children = (childrenMap.get(agent.id) || []).map(id => agentMap.get(id)).filter(Boolean);
      return this._renderNode(agent, children, agentMap, childrenMap);
    }).join('');

    return `${statsHtml}<div class="topo-tree">${treeHtml}</div>`;
  }

  /** 渲染泳道图 — 当前各 Agent 任务执行情况 */
  renderSwimlane(tasks, agents) {
    if (!tasks || tasks.length === 0) return '';

    const agentMap = new Map((agents || []).map(a => [a.id, a]));

    const lanes = tasks.map(task => {
      const agent = agentMap.get(task.agentId);
      const emoji = agent ? agent.emoji : '🤖';
      const name = task.agentName || (agent ? agent.name : task.agentId);
      const timeAgo = formatRelativeTime(task.lastUpdate);

      return `
        <div class="swimlane-row">
          <div class="swimlane-agent">${emoji} ${escapeHtml(name)}</div>
          <div class="swimlane-bar">
            <div class="swimlane-task-bar">
              <span class="swimlane-task-title">${escapeHtml(task.title || '(无标题)')}</span>
            </div>
          </div>
          <div class="swimlane-meta">${task.messageCount} msgs, ${timeAgo}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="swimlane-container">
        <div class="swimlane-header">⚔️ 作战态势</div>
        ${lanes}
      </div>
    `;
  }

  _renderNode(agent, children, agentMap, childrenMap) {
    const isActive = agent.status === 'active';
    const statusClass = isActive ? 'topo-status--active' : 'topo-status--idle';
    const modelBadge = agent.model ? `<span class="topo-model">${escapeHtml(agent.model)}</span>` : '';
    const activeTasks = agent.activeTasks || 0;

    let childrenHtml = '';
    if (children.length > 0) {
      const childNodes = children.map(child => {
        const grandchildren = (childrenMap.get(child.id) || []).map(id => agentMap.get(id)).filter(Boolean);
        return this._renderNode(child, grandchildren, agentMap, childrenMap);
      }).join('');
      childrenHtml = `<div class="topo-children">${childNodes}</div>`;
    }

    return `
      <div class="topo-node-wrapper">
        <div class="topo-node clickable" onclick="window.showAgentDetail('${agent.id}')">
          <div class="topo-node__emoji">${agent.emoji || '🤖'}</div>
          <div class="topo-node__name">${escapeHtml(agent.name)}</div>
          <span class="topo-node__pulse ${statusClass}"></span>
          ${modelBadge}
          ${activeTasks > 0 ? `<span class="topo-node__tasks">${activeTasks}</span>` : ''}
        </div>
        ${childrenHtml}
      </div>
    `;
  }

  _injectStyles() {
    if (this._styleInjected) return;
    this._styleInjected = true;

    const style = document.createElement('style');
    style.id = 'topo-styles';
    style.textContent = `
      /* === Topology Stats === */
      .topo-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }
      .topo-stat {
        background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 5%, transparent));
        padding: 16px;
        border-radius: 12px;
        text-align: center;
        font-size: 2em;
        font-weight: 700;
        color: var(--accent);
      }
      .topo-stat span {
        display: block;
        font-size: 0.425em;
        font-weight: 400;
        color: var(--text-secondary);
        margin-top: 4px;
      }

      /* === Topology Tree === */
      .topo-tree {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        padding: 20px 0;
      }
      .topo-node-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
      }
      .topo-children {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
        padding-top: 24px;
        position: relative;
      }
      /* Vertical connector from parent to children row */
      .topo-children::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 2px;
        height: 24px;
        background: var(--border-color);
        transform: translateX(-50%);
        top: -24px;
      }
      /* Horizontal connector across children */
      .topo-children::after {
        content: '';
        position: absolute;
        top: 0;
        left: 10%;
        right: 10%;
        height: 2px;
        background: var(--border-color);
      }
      /* Vertical connector from horizontal line to each child */
      .topo-children > .topo-node-wrapper::before {
        content: '';
        position: absolute;
        top: -24px;
        left: 50%;
        width: 2px;
        height: 24px;
        background: var(--border-color);
        transform: translateX(-50%);
      }

      /* === Node === */
      .topo-node {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 14px 18px;
        border-radius: 14px;
        background: var(--bg-card);
        border: 2px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        min-width: 110px;
      }
      .topo-node:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        border-color: var(--accent);
      }
      .topo-node__emoji {
        font-size: 1.8em;
      }
      .topo-node__name {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--text-primary);
        text-align: center;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .topo-node__pulse {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--bg-card);
      }
      .topo-status--active {
        background: #10b981;
        animation: topoPulse 2s infinite;
      }
      .topo-status--idle {
        background: #f59e0b;
      }
      .topo-status--error {
        background: #ef4444;
        animation: topoFlash 1s infinite;
      }
      @keyframes topoPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      }
      @keyframes topoFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .topo-model {
        font-size: 0.65em;
        padding: 2px 8px;
        background: rgba(99, 102, 241, 0.1);
        color: #6366f1;
        border-radius: 8px;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .topo-node__tasks {
        position: absolute;
        top: -6px;
        left: -6px;
        background: #3b82f6;
        color: white;
        font-size: 0.65em;
        font-weight: 700;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--bg-card);
      }

      /* === Swimlane === */
      .swimlane-container {
        margin-top: 16px;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        background: var(--bg-card);
      }
      .swimlane-header {
        font-size: 0.95em;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 12px;
      }
      .swimlane-row {
        display: grid;
        grid-template-columns: 120px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(0,0,0,0.04);
      }
      .swimlane-row:last-child { border-bottom: none; }
      .swimlane-agent {
        font-size: 0.82em;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .swimlane-bar {
        height: 28px;
        background: rgba(59, 130, 246, 0.08);
        border-radius: 6px;
        overflow: hidden;
      }
      .swimlane-task-bar {
        height: 100%;
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.2));
        border-radius: 6px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        animation: swimlaneGrow 0.5s ease-out;
      }
      @keyframes swimlaneGrow {
        from { width: 0; }
        to { width: 100%; }
      }
      .swimlane-task-title {
        font-size: 0.75em;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .swimlane-meta {
        font-size: 0.72em;
        color: var(--text-secondary);
        white-space: nowrap;
      }

      /* === Mobile: degrade topology to vertical list === */
      @media (max-width: 768px) {
        .topo-tree {
          align-items: stretch;
        }
        .topo-children {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          padding-left: 24px;
        }
        .topo-children::before,
        .topo-children::after,
        .topo-children > .topo-node-wrapper::before {
          display: none;
        }
        .topo-node {
          flex-direction: row;
          min-width: unset;
        }
        .topo-node__emoji { font-size: 1.2em; }
        .swimlane-row {
          grid-template-columns: 80px 1fr;
        }
        .swimlane-meta { display: none; }
      }

      /* === View toggle button === */
      .topo-view-toggle {
        display: inline-flex;
        gap: 4px;
        background: rgba(0,0,0,0.06);
        border-radius: 8px;
        padding: 3px;
        margin-left: 12px;
      }
      .topo-view-btn {
        padding: 4px 12px;
        border: none;
        border-radius: 6px;
        font-size: 0.75em;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: transparent;
        color: var(--text-secondary);
      }
      .topo-view-btn.active {
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
    this.addCleanup(() => { const el = document.getElementById('topo-styles'); if (el) el.remove(); });
  }
}
