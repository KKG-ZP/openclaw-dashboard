/**
 * Agent 详情组件 — ES module 化
 * 修复：ESC keydown 监听器累积 — 使用单一持久监听器替代每次 showSession() 添加
 */
import { Disposable } from '../core/disposable.js';
import { escapeHtml } from '../utils/html-escape.js';

export class AgentDetail extends Disposable {
  constructor() {
    super();
    this.modal = document.getElementById('agentDetailModal');
    this.content = document.getElementById('agentDetailContent');
    this.title = document.getElementById('agentDetailTitle');
    this.currentAgentId = null;
    this._sessionModalOpen = false;
    this._sessionModalEl = null;
    this._sessionStyleEl = null;
    if (!this.modal || !this.content || !this.title) return;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const closeBtn = document.getElementById('closeAgentDetail');
    if (closeBtn) {
      this.addListener(closeBtn, 'click', () => this.close());
    }

    // 点击模态框外部关闭
    this.addListener(this.modal, 'click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // 单一 ESC 监听器 — 同时处理会话模态框和主模态框
    this.addListener(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this._sessionModalOpen) {
        this.hideSessionDetail();
      } else if (this.modal.style.display === 'block') {
        this.close();
      }
    });

    // 注册清理：移除动态创建的会话模态框 DOM
    this.addCleanup(() => {
      if (this._sessionModalEl && this._sessionModalEl.parentNode) {
        this._sessionModalEl.parentNode.removeChild(this._sessionModalEl);
      }
      if (this._sessionStyleEl && this._sessionStyleEl.parentNode) {
        this._sessionStyleEl.parentNode.removeChild(this._sessionStyleEl);
      }
    });
  }

  async show(agentId) {
    if (!this.modal || !this.content) return;
    this.modal.style.display = 'block';
    this.content.innerHTML = '<div class="loading">加载中...</div>';

    try {
      const response = await fetch(`/api/agents/${agentId}/details`);
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      const agent = await response.json();
      this.render(agent);
    } catch (error) {
      console.error('加载Agent详情失败:', error);
      this.content.innerHTML = `
        <div class="error-state">
          <div style="font-size: 1.2em; margin-bottom: 8px;">加载失败</div>
          <div style="font-size: 0.9em; color: var(--text-secondary);">${escapeHtml(error.message)}</div>
        </div>
      `;
    }
  }

  getOrganizationMeta(type, label) {
    const metaMap = {
      'command-center': {
        label: '作战指挥中心',
        color: '#7c3aed',
        background: 'rgba(124, 58, 237, 0.12)',
        border: 'rgba(124, 58, 237, 0.22)',
        icon: '🧭'
      },
      'direct-department': {
        label: '直属部门',
        color: '#2563eb',
        background: 'rgba(37, 99, 235, 0.12)',
        border: 'rgba(37, 99, 235, 0.22)',
        icon: '🏛️'
      },
      'special-envoy': {
        label: '特使机构',
        color: '#d97706',
        background: 'rgba(217, 119, 6, 0.12)',
        border: 'rgba(217, 119, 6, 0.22)',
        icon: '📜'
      },
      'managed-agent': {
        label: '下级 Agent',
        color: '#0f766e',
        background: 'rgba(15, 118, 110, 0.12)',
        border: 'rgba(15, 118, 110, 0.22)',
        icon: '🧩'
      },
      'runtime-subagent': {
        label: '下级 Agent',
        color: '#0f766e',
        background: 'rgba(15, 118, 110, 0.12)',
        border: 'rgba(15, 118, 110, 0.22)',
        icon: '🧩'
      },
      'independent': {
        label: '独立实例',
        color: '#6b7280',
        background: 'rgba(107, 114, 128, 0.12)',
        border: 'rgba(107, 114, 128, 0.22)',
        icon: '🛰️'
      }
    };
    const resolved = metaMap[type] || metaMap['managed-agent'];
    return { ...resolved, label: label || resolved.label };
  }

  renderOrganizationBadge(type, label) {
    const meta = this.getOrganizationMeta(type, label);
    return `
      <span class="badge" style="background: ${meta.background}; color: ${meta.color}; border: 1px solid ${meta.border};">
        ${meta.icon} ${meta.label}
      </span>
    `;
  }

  renderOrganizationChildren(children) {
    if (!children || children.length === 0) return '';

    const groups = new Map();
    const groupOrder = ['direct-department', 'special-envoy', 'managed-agent', 'runtime-subagent', 'independent'];

    children.forEach(child => {
      const groupKey = child.organizationType || 'managed-agent';
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(child);
    });

    const sections = groupOrder
      .filter(groupKey => groups.has(groupKey))
      .map(groupKey => {
        const meta = this.getOrganizationMeta(groupKey);
        const items = groups.get(groupKey) || [];
        const cards = items.map(child => `
          <div class="clickable" onclick="showAgentDetail('${child.id}')" style="
            padding: 10px 12px;
            border-radius: 12px;
            background: ${meta.background};
            border: 1px solid ${meta.border};
            cursor: pointer;
            min-width: 220px;
            transition: all 0.2s;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 18px rgba(0,0,0,0.08)';"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.1em;">${child.emoji || '🤖'}</span>
              <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(child.name || child.id)}</span>
            </div>
            <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 4px;">${escapeHtml(child.id)}</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <span class="badge badge-blue">${escapeHtml(child.role || '助手')}</span>
              <span class="badge ${child.status === 'active' ? 'badge-green' : 'badge-yellow'}">${child.status === 'active' ? '活跃' : '空闲'}</span>
              <span class="badge" style="background: rgba(15, 23, 42, 0.06); color: var(--text-secondary);">${child.sessionCount || 0} 会话</span>
            </div>
          </div>
        `).join('');

        return `
          <div style="margin-top: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.9em; font-weight: 600; color: ${meta.color};">
              <span>${meta.icon}</span>
              <span>${meta.label} (${items.length})</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
              ${cards}
            </div>
          </div>
        `;
      }).join('');

    return `
      <div class="detail-section">
        <h3>组织成员</h3>
        ${sections}
      </div>
    `;
  }

  render(agent) {
    if (this.title) this.title.textContent = `${agent.emoji || ''} ${agent.name} - 详情`;
    const organizationBadge = this.renderOrganizationBadge(agent.organizationType, agent.organizationLabel);
    const organizationChildrenHtml = this.renderOrganizationChildren(agent.organizationChildren || []);

    const html = `
      <div class="detail-section">
        <h3>基本信息</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Agent ID</span>
            <span class="detail-value">${agent.id}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">名称</span>
            <span class="detail-value">${agent.name}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">组织类型</span>
            <span class="detail-value">${organizationBadge}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态</span>
            <span class="badge ${agent.status === 'active' ? 'badge-green' : 'badge-yellow'}">
              ${agent.status === 'active' ? '活跃' : '空闲'}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">模型</span>
            <span class="detail-value">${agent.model}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">工作空间</span>
            <span class="detail-value">${agent.workspace}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">上级机构</span>
            <span class="detail-value">${agent.parentId || '无'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">会话数</span>
            <span class="detail-value">${agent.sessionCount}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">总消息数</span>
            <span class="detail-value">${agent.totalMessages}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">最后活动</span>
            <span class="detail-value">${agent.lastActivity ? new Date(agent.lastActivity).toLocaleString('zh-CN') : 'N/A'}</span>
          </div>
        </div>
      </div>

      ${organizationChildrenHtml}

      <div class="detail-section">
        <h3>配置信息</h3>
        <div class="config-info">
          <div class="config-item">
            <span class="config-label">系统提示词</span>
            <div class="config-value">${escapeHtml((agent.config && agent.config.systemPrompt) || '未配置')}</div>
          </div>
          <div class="config-item">
            <span class="config-label">温度</span>
            <span class="config-value">${(agent.config && agent.config.temperature) ?? 'N/A'}</span>
          </div>
          <div class="config-item">
            <span class="config-label">最大Token数</span>
            <span class="config-value">${(agent.config && agent.config.maxTokens) ?? 'N/A'}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>会话列表 (最近${(agent.sessions || []).length}个)</h3>
        <div class="sessions-list">
          ${(agent.sessions || []).length > 0 ? (agent.sessions || []).map(session => `
            <div class="session-item clickable" onclick="showAgentDetail._instance.showSession('${agent.id}', '${session.id}')" style="cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.05)'; this.style.transform='translateX(4px)';" onmouseout="this.style.background=''; this.style.transform='';">
              <div class="session-header">
                <span class="session-id">🗂️ ${session.id.substring(0, 16)}...</span>
                <span class="badge badge-info">${session.messageCount} 条消息</span>
                <span style="margin-left: auto; font-size: 0.8em; color: var(--accent);">点击查看 →</span>
              </div>
              <div class="session-info">
                <div>创建: ${new Date(session.createdAt).toLocaleString('zh-CN')}</div>
                <div>更新: ${new Date(session.updatedAt).toLocaleString('zh-CN')}</div>
              </div>
              <div class="session-preview">
                <div class="preview-label">首条:</div>
                <div class="preview-content">${escapeHtml(String(session.firstMessage || '')).substring(0, 80)}${(session.firstMessage || '').length > 80 ? '...' : ''}</div>
              </div>
            </div>
          `).join('') : '<div class="empty-state">暂无会话</div>'}
        </div>
      </div>
    `;

    this.content.innerHTML = html;
    this.currentAgentId = agent.id;
  }

  async showSession(agentId, sessionId) {
    // 创建会话详情模态框（仅首次）
    if (!this._sessionModalEl) {
      this._sessionModalEl = document.createElement('div');
      this._sessionModalEl.id = 'sessionDetailModal';
      this._sessionModalEl.innerHTML = `
        <div class="session-modal-overlay"></div>
        <div class="session-modal-content">
          <div class="session-modal-header">
            <h2 id="sessionModalTitle">会话详情</h2>
            <button class="session-modal-close" id="sessionModalCloseBtn">&times;</button>
          </div>
          <div class="session-modal-body" id="sessionModalBody">
            <div class="loading">加载中...</div>
          </div>
        </div>
      `;
      document.body.appendChild(this._sessionModalEl);

      // 绑定会话模态框事件（仅一次）
      const overlay = this._sessionModalEl.querySelector('.session-modal-overlay');
      const closeBtn = this._sessionModalEl.querySelector('#sessionModalCloseBtn');
      if (overlay) this.addListener(overlay, 'click', () => this.hideSessionDetail());
      if (closeBtn) this.addListener(closeBtn, 'click', () => this.hideSessionDetail());

      // 添加样式
      this._sessionStyleEl = document.createElement('style');
      this._sessionStyleEl.textContent = `
        #sessionDetailModal {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10000;
        }
        #sessionDetailModal .session-modal-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        #sessionDetailModal .session-modal-content {
          position: absolute;
          top: 3%; left: 5%; right: 5%; bottom: 3%;
          background: var(--card-bg, #fff);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }
        #sessionDetailModal .session-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border, #e5e7eb);
          background: var(--bg-secondary, #f8fafc);
        }
        #sessionDetailModal .session-modal-header h2 {
          margin: 0;
          font-size: 1.1em;
          color: var(--text-primary, #1e293b);
        }
        #sessionDetailModal .session-modal-close {
          width: 36px; height: 36px;
          border: none;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-size: 1.5em;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        #sessionDetailModal .session-modal-close:hover {
          background: #ef4444;
          color: white;
        }
        #sessionDetailModal .session-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .message-item {
          margin-bottom: 16px; padding: 16px;
          border-radius: 12px; border-left: 4px solid;
        }
        .message-item.user {
          background: rgba(59, 130, 246, 0.08);
          border-left-color: #3b82f6;
        }
        .message-item.assistant {
          background: rgba(16, 185, 129, 0.08);
          border-left-color: #10b981;
        }
        .message-item.system {
          background: rgba(245, 158, 11, 0.08);
          border-left-color: #f59e0b;
        }
        .message-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px; padding-bottom: 8px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .message-icon { font-size: 1.3em; }
        .message-role { font-weight: 600; font-size: 0.9em; }
        .message-meta {
          margin-left: auto; font-size: 0.75em;
          color: var(--text-secondary, #64748b);
        }
        .message-content {
          font-size: 0.95em; line-height: 1.7;
          white-space: pre-wrap; word-break: break-word;
        }
      `;
      document.head.appendChild(this._sessionStyleEl);
    }

    this._sessionModalEl.style.display = 'block';
    this._sessionModalOpen = true;
    const modalTitle = document.getElementById('sessionModalTitle');
    const modalBody = document.getElementById('sessionModalBody');
    if (modalTitle) modalTitle.textContent = `📝 会话: ${sessionId.substring(0, 24)}...`;
    if (modalBody) modalBody.innerHTML = '<div class="loading">加载消息中...</div>';

    try {
      const response = await fetch(`/api/agents/${agentId}/sessions/${sessionId}`);
      if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);

      const data = await response.json();
      this.renderSessionMessages(data.messages, {
        agentName: data.agentName,
        agentEmoji: data.agentEmoji,
        agentRole: data.agentRole
      });
    } catch (error) {
      console.error('加载会话详情失败:', error);
      const errBody = document.getElementById('sessionModalBody');
      if (errBody) errBody.innerHTML = `<div class="error-state">加载失败: ${escapeHtml(error.message)}</div>`;
    }
  }

  renderSessionMessages(messages, sessionInfo = {}) {
    const container = document.getElementById('sessionModalBody');
    if (!container) return;

    if (!messages || messages.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无消息</div>';
      return;
    }

    // 按时间从近到远（新→旧）排序
    const sorted = [...messages].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    const html = sorted.map((msg, index) => {
      const isUser = msg.role === 'user';
      const isAssistant = msg.role === 'assistant';

      let roleClass = 'system';
      if (isUser) roleClass = 'user';
      else if (isAssistant) roleClass = 'assistant';

      const icon = msg.senderEmoji || (isUser ? '👤' : isAssistant ? '🤖' : '⚙️');
      const roleText = msg.senderName || (isUser ? '用户' : isAssistant ? '助手' : '系统');
      const content = msg.content || msg.text || msg.message?.content || JSON.stringify(msg).substring(0, 500);
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN') : '';

      return `
        <div class="message-item ${roleClass}">
          <div class="message-header">
            <span class="message-icon">${icon}</span>
            <span class="message-role">${roleText}</span>
            <span class="message-meta">#${index + 1} · ${timestamp}</span>
          </div>
          <div class="message-content">${escapeHtml(String(content))}</div>
        </div>
      `;
    }).join('');

    const agentInfo = sessionInfo.agentName
      ? `<span style="margin-left: 16px; color: var(--text-secondary);">${sessionInfo.agentEmoji || '🤖'} ${sessionInfo.agentName}</span>`
      : '';

    container.innerHTML = `
      <div style="margin-bottom: 16px; padding: 12px 16px; background: var(--bg-secondary, #f1f5f9); border-radius: 10px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 1.2em;">📊</span>
        <span style="font-weight: 500;">共 ${messages.length} 条消息</span>
        ${agentInfo}
      </div>
      ${html}
    `;
  }

  hideSessionDetail() {
    if (this._sessionModalEl) {
      this._sessionModalEl.style.display = 'none';
    }
    this._sessionModalOpen = false;
  }

  close() {
    if (this.modal) this.modal.style.display = 'none';
  }
}

/** Singleton accessor — creates or reuses a single AgentDetail instance */
let _instance = null;
export function showAgentDetail(agentId) {
  if (!_instance) {
    _instance = new AgentDetail();
  }
  _instance.show(agentId);
}
// Expose for inline onclick handlers in rendered HTML
showAgentDetail._instance = null;
Object.defineProperty(showAgentDetail, '_instance', {
  get() { return _instance; }
});
