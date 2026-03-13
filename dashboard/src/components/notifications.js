/**
 * 通知中心 — ES module 化
 * 修复：DOM 节点未移除（dispose 时 remove）
 */
import { Disposable } from '../core/disposable.js';
import { escapeHtml } from '../utils/html-escape.js';

export class NotificationCenter extends Disposable {
  constructor() {
    super();
    this.notifications = [];
    this.unreadCount = 0;
    this.currentFilter = 'all';
    this._panelEl = null;
    this._btnEl = null;
  }

  init() {
    this.setupUI();
    this.loadNotifications();
    this.setupEventListeners();
    this.requestPermission();
    this.renderNotifications();
  }

  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  setupUI() {
    const header = document.querySelector('.header-right');
    if (!header) return;

    this._btnEl = document.createElement('div');
    this._btnEl.className = 'notification-btn';
    this._btnEl.id = 'notificationBtn';
    this._btnEl.innerHTML = `
      <span class="notification-icon">🔔</span>
      <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
    `;

    this._panelEl = document.createElement('div');
    this._panelEl.className = 'notification-panel hidden';
    this._panelEl.id = 'notificationPanel';
    this._panelEl.style.display = 'none';
    this._panelEl.innerHTML = `
      <div class="notification-header">
        <h3>通知中心</h3>
        <button class="notification-close" id="closeNotificationPanel">&times;</button>
      </div>
      <div style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="btn-small notif-filter-btn" data-filter="all">全部</button>
        <button class="btn-small notif-filter-btn" data-filter="unread">未读</button>
        <button class="btn-small notif-filter-btn" data-filter="read">已读</button>
      </div>
      <div class="notification-list" id="notificationList">
        <div class="empty-state">暂无通知</div>
      </div>
      <div class="notification-footer">
        <button class="btn-small" id="markAllRead">全部标记为已读</button>
        <button class="btn-small" id="deleteReadNotifications">删除已读</button>
        <button class="btn-small" id="clearNotifications">清空</button>
      </div>
    `;

    header.insertBefore(this._btnEl, header.firstChild);
    document.body.appendChild(this._panelEl);

    // Register cleanup for DOM nodes
    this.addCleanup(() => {
      if (this._panelEl && this._panelEl.parentNode) {
        this._panelEl.parentNode.removeChild(this._panelEl);
      }
      if (this._btnEl && this._btnEl.parentNode) {
        this._btnEl.parentNode.removeChild(this._btnEl);
      }
    });

    this.updateBadge();
  }

  setPanelVisible(visible) {
    if (!this._panelEl) return;
    this._panelEl.classList.toggle('hidden', !visible);
    this._panelEl.style.display = visible ? 'flex' : 'none';
  }

  isPanelVisible() {
    if (!this._panelEl) return false;
    return window.getComputedStyle(this._panelEl).display !== 'none' && !this._panelEl.classList.contains('hidden');
  }

  setupEventListeners() {
    const btn = this._btnEl;
    const panel = this._panelEl;
    const closeBtn = document.getElementById('closeNotificationPanel');
    const markAllReadBtn = document.getElementById('markAllRead');
    const clearBtn = document.getElementById('clearNotifications');
    const deleteReadBtn = document.getElementById('deleteReadNotifications');

    if (btn) this.addListener(btn, 'click', (e) => { e.stopPropagation(); this.setPanelVisible(!this.isPanelVisible()); });
    if (closeBtn) this.addListener(closeBtn, 'click', () => this.setPanelVisible(false));
    if (markAllReadBtn) this.addListener(markAllReadBtn, 'click', () => this.markAllAsRead());
    if (clearBtn) this.addListener(clearBtn, 'click', () => this.clearAll());
    if (deleteReadBtn) this.addListener(deleteReadBtn, 'click', () => this.deleteRead());

    const filterBtns = document.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach(b => {
      this.addListener(b, 'click', () => { this.currentFilter = b.dataset.filter || 'all'; this.renderNotifications(); });
    });

    this.addListener(document, 'click', (e) => {
      if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        this.setPanelVisible(false);
      }
    });
  }

  addNotification(notification) {
    const notif = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: notification.title || '通知',
      message: notification.message || '',
      type: notification.type || 'info',
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    this.notifications.unshift(notif);
    this.notifications = this.notifications.slice(0, 100);
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.message, tag: notif.id });
    }
  }

  markAsRead(id) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.updateBadge();
      this.renderNotifications();
      this.saveNotifications();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => { n.read = true; });
    this.unreadCount = 0;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  deleteRead() {
    this.notifications = this.notifications.filter(n => !n.read);
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  deleteOne(id) {
    this.notifications = this.notifications.filter(n => Number(n.id) !== Number(id));
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  clearAll() {
    this.notifications = [];
    this.unreadCount = 0;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  updateBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  renderNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    const filtered = this.notifications.filter(n => {
      if (this.currentFilter === 'unread') return !n.read;
      if (this.currentFilter === 'read') return !!n.read;
      return true;
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">${this.currentFilter === 'all' ? '暂无通知' : '当前筛选下暂无通知'}</div>`;
      this.updateFilterButtons();
      return;
    }

    const html = filtered.slice(0, 50).map(notif => {
      const time = new Date(notif.timestamp).toLocaleString('zh-CN');
      return `
        <div class="notification-item notification-${notif.type} ${notif.read ? 'read' : ''}" data-id="${notif.id}">
          <div class="notification-item-header">
            <span class="notification-item-title">${escapeHtml(notif.title)}</span>
            <span class="notification-item-time">${time}</span>
          </div>
          <div class="notification-item-message">${escapeHtml(notif.message)}</div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px; gap:6px;">
            ${notif.read ? '' : '<button class="btn-small notif-mark-read" style="padding:2px 8px; font-size:0.72em;">标记已读</button>'}
            <button class="btn-small notif-delete-one" style="padding:2px 8px; font-size:0.72em;">删除</button>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = html;

    list.querySelectorAll('.notification-item').forEach(item => {
      const id = Number(item.dataset.id);
      const markBtn = item.querySelector('.notif-mark-read');
      const delBtn = item.querySelector('.notif-delete-one');
      if (markBtn) markBtn.addEventListener('click', (e) => { e.stopPropagation(); this.markAsRead(id); });
      if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteOne(id); });
      item.addEventListener('click', () => this.markAsRead(id));
    });

    this.updateFilterButtons();
  }

  updateFilterButtons() {
    document.querySelectorAll('.notif-filter-btn').forEach(btn => {
      const active = btn.dataset.filter === this.currentFilter;
      btn.style.background = active ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)';
      btn.style.borderColor = active ? 'rgba(59,130,246,0.45)' : 'var(--border-color)';
      btn.style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)';
      btn.style.fontWeight = active ? '600' : '500';
    });
  }

  loadNotifications() {
    try {
      const saved = localStorage.getItem('notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.notifications = Array.isArray(parsed) ? parsed.map((n, idx) => ({
          id: Number(n.id) || Date.now() + idx,
          title: n.title || '通知',
          message: n.message || '',
          type: n.type || 'info',
          timestamp: n.timestamp || new Date().toISOString(),
          read: !!n.read
        })) : [];
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.updateBadge();
        this.renderNotifications();
      }
    } catch (error) {
      console.error('加载通知失败:', error);
      this.notifications = [];
      this.unreadCount = 0;
    }
  }

  saveNotifications() {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications.slice(0, 100)));
    } catch (error) {
      console.error('保存通知失败:', error);
    }
  }
}
