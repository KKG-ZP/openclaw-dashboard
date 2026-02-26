/**
 * 通知中心模块
 */

class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.currentFilter = 'all'; // all | unread | read
    this.init();
  }

  init() {
    const boot = () => {
      this.setupUI();
      this.loadNotifications();
      this.setupEventListeners();
      this.requestPermission();
      this.renderNotifications();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  // 请求通知权限
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  // 设置UI
  setupUI() {
    const header = document.querySelector('.header-right');
    if (!header) return;

    const notificationBtn = document.createElement('div');
    notificationBtn.className = 'notification-btn';
    notificationBtn.id = 'notificationBtn';
    notificationBtn.innerHTML = `
      <span class="notification-icon">🔔</span>
      <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
    `;

    const notificationPanel = document.createElement('div');
    notificationPanel.className = 'notification-panel';
    notificationPanel.id = 'notificationPanel';
    notificationPanel.classList.add('hidden');
    notificationPanel.style.display = 'none';
    notificationPanel.innerHTML = `
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

    header.insertBefore(notificationBtn, header.firstChild);
    document.body.appendChild(notificationPanel);

    // 更新未读数量
    this.updateBadge();
  }

  setPanelVisible(visible) {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
    panel.style.display = visible ? 'flex' : 'none';
  }

  isPanelVisible() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return false;
    const computed = window.getComputedStyle(panel).display;
    return computed !== 'none' && !panel.classList.contains('hidden');
  }

  // 设置事件监听器
  setupEventListeners() {
    const btn = document.getElementById('notificationBtn');
    const panel = document.getElementById('notificationPanel');
    const closeBtn = document.getElementById('closeNotificationPanel');
    const markAllReadBtn = document.getElementById('markAllRead');
    const clearBtn = document.getElementById('clearNotifications');
    const deleteReadBtn = document.getElementById('deleteReadNotifications');

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setPanelVisible(!this.isPanelVisible());
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.setPanelVisible(false);
      });
    }

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => {
        this.markAllAsRead();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAll();
      });
    }

    if (deleteReadBtn) {
      deleteReadBtn.addEventListener('click', () => {
        this.deleteRead();
      });
    }

    // 筛选按钮
    const filterBtns = document.querySelectorAll('.notif-filter-btn');
    filterBtns.forEach(btnEl => {
      btnEl.addEventListener('click', () => {
        this.currentFilter = btnEl.dataset.filter || 'all';
        this.renderNotifications();
      });
    });

    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        this.setPanelVisible(false);
      }
    });
  }

  // 添加通知
  addNotification(notification) {
    const notif = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: notification.title || '通知',
      message: notification.message || '',
      type: notification.type || 'info', // info, success, warning, error
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

    // 显示浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.message,
        icon: '/static/favicon.ico',
        tag: notif.id
      });
    }
  }

  // 标记为已读
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

  // 标记全部为已读
  markAllAsRead() {
    this.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
      }
    });
    this.unreadCount = 0;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  // 删除已读通知
  deleteRead() {
    this.notifications = this.notifications.filter(n => !n.read);
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  // 清除所有通知
  clearAll() {
    this.notifications = [];
    this.unreadCount = 0;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  // 更新徽章
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

  // 渲染通知列表
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
      const typeClass = `notification-${notif.type}`;
      const readClass = notif.read ? 'read' : '';
      const time = new Date(notif.timestamp).toLocaleString('zh-CN');

      return `
        <div class="notification-item ${typeClass} ${readClass}" data-id="${notif.id}">
          <div class="notification-item-header">
            <span class="notification-item-title">${this.escapeHtml(notif.title)}</span>
            <span class="notification-item-time">${time}</span>
          </div>
          <div class="notification-item-message">${this.escapeHtml(notif.message)}</div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px; gap:6px;">
            ${notif.read ? '' : '<button class="btn-small notif-mark-read" style="padding:2px 8px; font-size:0.72em;">标记已读</button>'}
            <button class="btn-small notif-delete-one" style="padding:2px 8px; font-size:0.72em;">删除</button>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = html;

    // 添加点击事件
    list.querySelectorAll('.notification-item').forEach(item => {
      const id = Number(item.dataset.id);
      const markBtn = item.querySelector('.notif-mark-read');
      const delBtn = item.querySelector('.notif-delete-one');

      if (markBtn) {
        markBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.markAsRead(id);
        });
      }
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteOne(id);
        });
      }

      item.addEventListener('click', () => {
        this.markAsRead(id);
      });
    });

    this.updateFilterButtons();
  }

  // 删除单条通知
  deleteOne(id) {
    this.notifications = this.notifications.filter(n => Number(n.id) !== Number(id));
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.updateBadge();
    this.renderNotifications();
    this.saveNotifications();
  }

  updateFilterButtons() {
    const buttons = document.querySelectorAll('.notif-filter-btn');
    buttons.forEach(btn => {
      const active = btn.dataset.filter === this.currentFilter;
      btn.style.background = active ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)';
      btn.style.borderColor = active ? 'rgba(59,130,246,0.45)' : 'var(--border-color)';
      btn.style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)';
      btn.style.fontWeight = active ? '600' : '500';
    });
  }

  // 加载通知
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
      this.updateBadge();
    }
  }

  // 保存通知
  saveNotifications() {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications.slice(0, 100)));
    } catch (error) {
      console.error('保存通知失败:', error);
    }
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 创建全局通知中心实例（防重复）
if (!window.notificationCenter) {
  window.notificationCenter = new NotificationCenter();
}
