/**
 * 侧边栏导航 — ES module 化
 */
import { Disposable } from '../core/disposable.js';

export class SidebarManager extends Disposable {
  constructor() {
    super();
    this.currentPanel = 'overview';
    this.panelTitles = {
      overview: { title: '系统概览', subtitle: '实时监控系统状态和性能指标' },
      health: { title: '系统健康度', subtitle: '监控系统健康状态和问题' },
      resources: { title: '资源监控', subtitle: 'CPU、内存、磁盘、网络使用情况' },
      alerts: { title: '告警中心', subtitle: '系统告警和通知管理' },
      agents: { title: 'Agent管理', subtitle: 'Agent列表和状态监控' },
      models: { title: '模型统计', subtitle: 'AI模型使用量统计与分析' },
      tasks: { title: '当前任务', subtitle: '正在执行的任务列表' },
      history: { title: '任务历史', subtitle: '已完成的任务记录' },
      messages: { title: '消息流', subtitle: '实时消息流监控' },
      channels: { title: '通道状态', subtitle: '通信通道状态监控' },
      actions: { title: '快捷操作', subtitle: '系统快捷操作工具' },
      logs: { title: '实时日志', subtitle: '系统日志实时查看' },
      statistics: { title: '统计面板', subtitle: '数据统计和分析' }
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSavedPanel();
    this.setupMobileToggle();
  }

  setupEventListeners() {
    document.querySelectorAll('.sidebar-menu-link').forEach(link => {
      this.addListener(link, 'click', (e) => {
        e.preventDefault();
        const panel = link.dataset.panel;
        if (panel) this.switchPanel(panel);
      });
    });
  }

  setupMobileToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
      this.addListener(toggle, 'click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
      });
    }
    if (overlay) {
      this.addListener(overlay, 'click', () => {
        if (sidebar) sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }

    // 点击菜单项后关闭侧边栏（移动端）
    document.querySelectorAll('.sidebar-menu-link').forEach(link => {
      this.addListener(link, 'click', () => {
        if (window.innerWidth <= 1024) {
          if (sidebar) sidebar.classList.remove('open');
          if (overlay) overlay.classList.remove('show');
        }
      });
    });
  }

  switchPanel(panelId) {
    document.querySelectorAll('.content-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const targetPanel = document.getElementById(`panel-${panelId}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
      this.currentPanel = panelId;
      this.updateTitle(panelId);
      this.updateActiveMenu(panelId);
      this.savePanel(panelId);
    }
  }

  updateTitle(panelId) {
    const info = this.panelTitles[panelId];
    if (info) {
      const titleEl = document.getElementById('mainTitle');
      const subtitleEl = document.getElementById('mainSubtitle');
      if (titleEl) titleEl.textContent = info.title;
      if (subtitleEl) subtitleEl.textContent = info.subtitle;
    }
  }

  updateActiveMenu(panelId) {
    document.querySelectorAll('.sidebar-menu-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.panel === panelId) link.classList.add('active');
    });
  }

  savePanel(panelId) {
    try { localStorage.setItem('lastPanel', panelId); } catch (e) { /* ignore */ }
  }

  loadSavedPanel() {
    try {
      const saved = localStorage.getItem('lastPanel');
      if (saved && this.panelTitles[saved]) {
        this.switchPanel(saved);
      } else {
        this.switchPanel('overview');
      }
    } catch (e) {
      this.switchPanel('overview');
    }
  }

  updateBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}
