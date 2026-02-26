/**
 * UI/UX增强功能模块
 * 包括：主题切换、全屏、快捷键、响应式、动画、拖拽
 */

class UIEnhancements {
  constructor() {
    this.currentTheme = 'light';
    this.isFullscreen = false;
    this.refreshInterval = 5000;
    this.isPaused = false;
    this.init();
  }

  init() {
    this.loadTheme();
    this.setupThemeToggle();
    this.setupFullscreen();
    this.setupKeyboardShortcuts();
    this.setupRefreshControl();
    this.setupDragAndDrop();
    this.setupAnimations();
    this.setupRightSidebarToggle();
    this.setupMobileMonitorNav();
  }

  // ========== 主题切换 ==========
  loadTheme() {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) {
        this.currentTheme = saved;
        this.applyTheme(saved);
      }
    } catch (error) {
      console.error('加载主题失败:', error);
    }
  }

  setupThemeToggle() {
    const themeBtn = document.createElement('button');
    themeBtn.className = 'theme-toggle-btn';
    themeBtn.id = 'themeToggle';
    themeBtn.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
    themeBtn.title = '切换主题';

    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.insertBefore(themeBtn, headerRight.firstChild);
    }

    themeBtn.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
    
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--bg-primary', '#1e293b');
      document.documentElement.style.setProperty('--bg-secondary', '#0f172a');
      document.documentElement.style.setProperty('--bg-card', '#1e293b');
      document.documentElement.style.setProperty('--text-primary', '#f1f5f9');
      document.documentElement.style.setProperty('--text-secondary', '#cbd5e1');
      document.documentElement.style.setProperty('--text-muted', '#94a3b8');
      document.documentElement.style.setProperty('--border-color', 'rgba(59, 130, 246, 0.3)');
    } else {
      document.documentElement.style.setProperty('--bg-primary', '#f5f7fa');
      document.documentElement.style.setProperty('--bg-secondary', '#ffffff');
      document.documentElement.style.setProperty('--bg-card', '#ffffff');
      document.documentElement.style.setProperty('--text-primary', '#1e293b');
      document.documentElement.style.setProperty('--text-secondary', '#64748b');
      document.documentElement.style.setProperty('--text-muted', '#94a3b8');
      document.documentElement.style.setProperty('--border-color', 'rgba(59, 130, 246, 0.2)');
    }
  }

  // ========== 全屏功能 ==========
  setupFullscreen() {
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-btn';
    fullscreenBtn.id = 'fullscreenBtn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = '全屏 (F11)';

    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.insertBefore(fullscreenBtn, headerRight.firstChild);
    }

    fullscreenBtn.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      fullscreenBtn.innerHTML = this.isFullscreen ? '⛶' : '⛶';
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('进入全屏失败:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ========== 快捷键支持 ==========
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // F5: 刷新数据
      if (e.key === 'F5') {
        e.preventDefault();
        if (window.dashboard) {
          window.dashboard.loadInitialData();
        }
      }

      // Ctrl+F: 打开搜索
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
          globalSearch.focus();
        }
      }

      // F11: 全屏切换
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }

      // Ctrl+T: 切换主题
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        this.toggleTheme();
      }

      // Esc: 关闭模态框
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
          if (modal.style.display === 'block') {
            modal.style.display = 'none';
          }
        });
      }
    });
  }

  // ========== 刷新控制 ==========
  setupRefreshControl() {
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-control-btn';
    refreshBtn.id = 'refreshControl';
    refreshBtn.innerHTML = '⏸️';
    refreshBtn.title = '暂停/恢复刷新';

    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.insertBefore(refreshBtn, headerRight.firstChild);
    }

    refreshBtn.addEventListener('click', () => {
      this.togglePause();
    });
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('refreshControl');
    if (btn) {
      btn.innerHTML = this.isPaused ? '▶️' : '⏸️';
      btn.title = this.isPaused ? '恢复刷新' : '暂停刷新';
    }
  }

  // ========== 瀑布流布局 + 跟手拖拽 ==========
  setupDragAndDrop() {
    this._drag = null;
    this._masonryEnabled = false;

    // 先恢复已保存的 DOM 顺序
    this.loadLayout();

    const grid = document.querySelector('.grid');
    if (!grid) return;

    this._injectMasonryStyles();
    this._createResetButton();
    this._initMasonry(grid);

    // 绑定拖拽到每张卡片的 header
    this._bindDragEvents(grid);
  }

  _bindDragEvents(grid) {
    if (!grid) grid = document.querySelector('.grid');
    if (!grid) return;
    
    grid.querySelectorAll(':scope > .card[data-card-id]').forEach(card => {
      const header = card.querySelector('.card-header');
      if (!header) return;
      // 移除旧的事件监听器（如果有）
      header.removeEventListener('mousedown', this._boundMouseDown);
      // 绑定新的事件监听器
      const boundHandler = (e) => this._onMouseDown(e, card, grid);
      header.addEventListener('mousedown', boundHandler);
      // 保存引用以便后续移除
      header._dragHandler = boundHandler;
    });
  }

  // ---- 样式注入 ----
  _injectMasonryStyles() {
    if (document.getElementById('masonry-drag-styles')) return;
    const s = document.createElement('style');
    s.id = 'masonry-drag-styles';
    s.textContent = `
      /* --- 瀑布流容器 --- */
      .grid.masonry-active {
        display: block !important;
        position: relative;
      }
      .grid.masonry-active > .card[data-card-id] {
        position: absolute;
        box-sizing: border-box;
        transition: top 0.35s cubic-bezier(.4,0,.2,1), left 0.35s cubic-bezier(.4,0,.2,1),
                    transform 0.3s, box-shadow 0.3s;
      }
      /* 首次布局跳过动画 */
      .grid.masonry-no-transition > .card[data-card-id] {
        transition: none !important;
      }
      /* 拖拽过程中其他卡片也跳过动画（即时响应） */
      .grid.masonry-active.is-dragging > .card[data-card-id] {
        transition: none !important;
      }

      /* --- 拖拽手柄 --- */
      .grid > .card > .card-header { cursor: grab; user-select: none; }
      .grid > .card > .card-header:active { cursor: grabbing; }
      .grid.masonry-disabled > .card > .card-header { cursor: default; user-select: auto; }

      /* --- 浮动卡片 --- */
      .card.drag-floating {
        position: fixed !important;
        z-index: 10000 !important;
        pointer-events: none !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25), 0 0 0 2px rgba(59,130,246,0.5) !important;
        transform: rotate(1.5deg) scale(1.03) !important;
        opacity: 0.92;
        transition: transform 0.1s, box-shadow 0.1s !important;
      }

      /* --- 占位符 --- */
      .drag-placeholder {
        position: absolute;
        box-sizing: border-box;
        border: 2.5px dashed rgba(59,130,246,0.45);
        border-radius: 12px;
        background: repeating-linear-gradient(
          -45deg,
          rgba(59,130,246,0.03),
          rgba(59,130,246,0.03) 8px,
          rgba(59,130,246,0.07) 8px,
          rgba(59,130,246,0.07) 16px
        );
        transition: top 0.15s ease, left 0.15s ease;
      }

      /* --- 重置按钮 --- */
      .layout-reset-btn {
        position: fixed; bottom: 16px; left: 16px; z-index: 999;
        background: var(--accent, #3b82f6); color: white;
        border: none; padding: 6px 14px; border-radius: 6px;
        font-size: 0.8em; cursor: pointer;
        opacity: 0; pointer-events: none; transition: opacity 0.2s;
      }
      .layout-reset-btn.visible { opacity: 1; pointer-events: auto; }
      .layout-reset-btn:hover { filter: brightness(1.1); }

      /* --- 拖拽中禁止选中文字 --- */
      body.is-dragging-card { user-select: none !important; cursor: grabbing !important; }
    `;
    document.head.appendChild(s);
  }

  _createResetButton() {
    if (document.getElementById('layoutResetBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'layoutResetBtn';
    btn.className = 'layout-reset-btn';
    btn.textContent = '↩ 重置布局';
    btn.title = '恢复默认卡片排列顺序';
    btn.addEventListener('click', () => {
      localStorage.removeItem('cardLayout');
      window.location.reload();
    });
    document.body.appendChild(btn);
    if (localStorage.getItem('cardLayout')) btn.classList.add('visible');
  }

  // ---- 瀑布流核心 ----

  _initMasonry(grid) {
    this._masonryEnabled = true;
    this._masonryGap = 20;
    this._masonryMinCol = 350;
    this._masonryMaxCols = 4;
    this._layoutRAFPending = false;
    this._lastCardWidths = new Map();   // 记录上一次布局中每张卡片的宽度

    // 首次布局：无动画
    grid.classList.add('masonry-active', 'masonry-no-transition');
    this.layoutMasonry();
    // 下一帧开始允许过渡动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        grid.classList.remove('masonry-no-transition');
      });
    });

    // 窗口 resize 时重新计算
    this._resizeHandler = this._debounce(() => this.layoutMasonry(), 80);
    window.addEventListener('resize', this._resizeHandler);

    // 卡片尺寸变化时重新计算（内容更新导致高度变化）
    // 不再用 _isLayouting 标志压制，改用 _scheduleLayout 的 rAF 节流来避免过度计算。
    // 即使 layoutMasonry 自己改 width 触发了 ResizeObserver，最坏情况也只是
    // 多跑一次 layoutMasonry（第二次 width 不变 → 不再触发 → 自动收敛）。
    this._contentObserver = new ResizeObserver((entries) => {
      if (this._drag && this._drag.activated) return;      // 拖拽中不自动重排

      // 检查是否有真正的高度变化（过滤掉纯 width 变化——那是我们自己设的）
      let hasHeightChange = false;
      for (const entry of entries) {
        const el = entry.target;
        const prev = this._lastCardWidths.get(el);
        const curW = entry.contentRect.width;
        const curH = entry.contentRect.height;
        // 如果宽度和上次一样，但高度变了 → 是内容驱动的变化
        // 或者 prev 不存在（首次）→ 也需要重排
        if (!prev || Math.abs(prev.h - curH) > 1) {
          hasHeightChange = true;
          break;
        }
      }
      if (hasHeightChange) {
        this._scheduleLayout();
      }
    });
    grid.querySelectorAll(':scope > .card[data-card-id]').forEach(card => {
      this._contentObserver.observe(card);
    });

    // 额外保险：所有资源加载完毕后重排一次
    window.addEventListener('load', () => this.layoutMasonry());
  }

  /** 用 requestAnimationFrame 合并同一帧内的多次布局请求 */
  _scheduleLayout() {
    if (this._layoutRAFPending) return;
    this._layoutRAFPending = true;
    requestAnimationFrame(() => {
      this._layoutRAFPending = false;
      this.layoutMasonry();
    });
  }

  /**
   * 瀑布流排列算法
   * 将 .grid 内的所有卡片按 DOM 顺序依次放入最矮的列中。
   * card-wide 类的卡片跨 2 列。
   */
  layoutMasonry() {
    const grid = document.querySelector('.grid');
    if (!grid || !this._masonryEnabled) return;

    // 平板/手机关闭瀑布流，回退到自然流式布局，避免移动端监控信息错位
    if (window.matchMedia('(max-width: 1024px)').matches) {
      this._disableMasonryLayout(grid);
      return;
    }

    this._enableMasonryLayout(grid);

    const containerWidth = grid.clientWidth;
    if (containerWidth <= 0) return;

    const gap = this._masonryGap;
    let numCols = Math.max(1, Math.floor((containerWidth + gap) / (this._masonryMinCol + gap)));
    numCols = Math.min(numCols, this._masonryMaxCols);

    const colWidth = (containerWidth - (numCols - 1) * gap) / numCols;
    const colHeights = new Array(numCols).fill(0);

    // 获取所有需要排列的元素（排除正在浮动的拖拽卡片）
    const items = Array.from(grid.querySelectorAll(
      ':scope > .card[data-card-id]:not(.drag-floating), :scope > .drag-placeholder'
    ));
    
    // 强制所有卡片重新计算高度（清除可能的缓存问题）
    items.forEach(item => {
      item.style.height = 'auto'; // 清除之前可能的高度限制
    });

    items.forEach(item => {
      const isWide = item.classList.contains('card-wide') || item.classList.contains('drag-placeholder-wide');
      const span = (isWide && numCols >= 2) ? 2 : 1;

      // 先设宽度，浏览器会同步计算高度
      const itemWidth = colWidth * span + gap * (span - 1);
      item.style.width = itemWidth + 'px';

      // 找到最矮的连续 span 列
      let bestCol = 0;
      let bestHeight = Infinity;
      for (let i = 0; i <= numCols - span; i++) {
        let maxH = 0;
        for (let j = i; j < i + span; j++) maxH = Math.max(maxH, colHeights[j]);
        if (maxH < bestHeight) { bestHeight = maxH; bestCol = i; }
      }

      // 定位
      item.style.left = (bestCol * (colWidth + gap)) + 'px';
      item.style.top = bestHeight + 'px';

      // 更新列高度
      const itemHeight = item.offsetHeight;
      for (let j = bestCol; j < bestCol + span; j++) {
        colHeights[j] = bestHeight + itemHeight + gap;
      }

      // 记录本次宽高，供 ResizeObserver 判断变化来源
      this._lastCardWidths.set(item, { w: itemWidth, h: itemHeight });
    });

    // 设置容器高度
    grid.style.height = Math.max(...colHeights, 0) + 'px';
  }

  _disableMasonryLayout(grid) {
    grid.classList.remove('masonry-active', 'masonry-no-transition', 'is-dragging');
    grid.classList.add('masonry-disabled');
    grid.style.height = '';

    // 清理瀑布流留下的定位样式，恢复文档流
    grid.querySelectorAll(':scope > .card[data-card-id], :scope > .drag-placeholder').forEach(item => {
      item.classList.remove('drag-floating');
      item.style.position = '';
      item.style.left = '';
      item.style.top = '';
      item.style.width = '';
      item.style.height = '';
    });
  }

  _enableMasonryLayout(grid) {
    grid.classList.remove('masonry-disabled');
    if (!grid.classList.contains('masonry-active')) {
      grid.classList.add('masonry-active');
    }
  }

  _debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms); };
  }

  // ---- 拖拽核心 ----

  _onMouseDown(e, card, grid) {
    if (e.button !== 0) return;
    if (window.matchMedia('(max-width: 1024px)').matches) return;
    if (e.target.closest('input, select, button, textarea, a, .search-input, .btn-small')) return;
    e.preventDefault();

    this._drag = { card, grid, startX: e.clientX, startY: e.clientY, activated: false };

    this._boundMM = (ev) => this._onMouseMove(ev);
    this._boundMU = (ev) => this._onMouseUp(ev);
    document.addEventListener('mousemove', this._boundMM);
    document.addEventListener('mouseup', this._boundMU);
  }

  _onMouseMove(e) {
    const d = this._drag;
    if (!d) return;

    // 5px 阈值：区分点击与拖拽
    if (!d.activated) {
      if (Math.abs(e.clientX - d.startX) < 5 && Math.abs(e.clientY - d.startY) < 5) return;
      this._activateDrag(d, e);
    }

    // 浮动卡片跟手
    d.card.style.left = (e.clientX - d.offsetX) + 'px';
    d.card.style.top = (e.clientY - d.offsetY) + 'px';

    // 移动占位符
    this._updatePlaceholder(e, d);
  }

  _onMouseUp() {
    document.removeEventListener('mousemove', this._boundMM);
    document.removeEventListener('mouseup', this._boundMU);

    const d = this._drag;
    if (!d) return;
    this._drag = null;
    if (!d.activated) return;

    const { card, grid, placeholder } = d;

    // 卡片归位到占位符位置
    if (placeholder && placeholder.parentNode) {
      grid.insertBefore(card, placeholder);
      placeholder.remove();
    }

    // 移除浮动样式
    card.classList.remove('drag-floating');
    card.style.cssText = '';  // 清除所有内联样式，masonry 会重新设置
    grid.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-card');

    this.layoutMasonry();
    this.saveLayout();
  }

  _activateDrag(d, e) {
    d.activated = true;
    const { card, grid } = d;
    const rect = card.getBoundingClientRect();

    d.offsetX = e.clientX - rect.left;
    d.offsetY = e.clientY - rect.top;

    // 创建占位符（继承宽/高和 wide 属性）
    const ph = document.createElement('div');
    ph.className = 'drag-placeholder';
    if (card.classList.contains('card-wide')) {
      ph.classList.add('drag-placeholder-wide', 'card-wide');
    }
    ph.style.height = rect.height + 'px';
    d.placeholder = ph;
    d.lastPHIndex = -1;

    // 占位符插到卡片原位
    card.parentNode.insertBefore(ph, card);

    // 卡片浮起
    card.classList.add('drag-floating');
    card.style.width = rect.width + 'px';
    card.style.height = rect.height + 'px';
    card.style.left = rect.left + 'px';
    card.style.top = rect.top + 'px';
    grid.classList.add('is-dragging');
    document.body.classList.add('is-dragging-card');

    // 带占位符重新布局
    this.layoutMasonry();
  }

  _updatePlaceholder(e, d) {
    const { grid, placeholder } = d;

    const items = Array.from(grid.querySelectorAll(
      ':scope > .card[data-card-id]:not(.drag-floating), :scope > .drag-placeholder'
    ));

    let closest = null;
    let before = true;
    let minDist = Infinity;

    for (const item of items) {
      if (item === placeholder) continue;
      const r = item.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = dx * dx + dy * dy; // 无需开根号

      if (dist < minDist) {
        minDist = dist;
        closest = item;
        before = (dy < 0 || (Math.abs(dy) < r.height / 3 && dx < 0));
      }
    }

    if (!closest) return;

    // 计算目标索引，只在位置真正变化时才移动 + relayout
    const children = Array.from(grid.children);
    const targetIdx = children.indexOf(closest);
    const newIdx = before ? targetIdx : targetIdx + 1;

    if (newIdx !== d.lastPHIndex) {
      d.lastPHIndex = newIdx;
      if (before) {
        grid.insertBefore(placeholder, closest);
      } else {
        grid.insertBefore(placeholder, closest.nextSibling);
      }
      this.layoutMasonry();
    }
  }

  // ---- 布局持久化 ----

  saveLayout() {
    const grid = document.querySelector('.grid');
    if (!grid) return;
    const order = Array.from(grid.querySelectorAll(':scope > .card[data-card-id]'))
      .map(c => c.dataset.cardId);
    localStorage.setItem('cardLayout', JSON.stringify(order));
    const btn = document.getElementById('layoutResetBtn');
    if (btn) btn.classList.add('visible');
  }

  loadLayout() {
    try {
      const saved = localStorage.getItem('cardLayout');
      if (!saved) return;
      const order = JSON.parse(saved);
      const grid = document.querySelector('.grid');
      if (!grid || !Array.isArray(order)) return;

      const cardMap = {};
      grid.querySelectorAll(':scope > .card[data-card-id]').forEach(c => {
        cardMap[c.dataset.cardId] = c;
      });
      order.forEach(id => {
        const c = cardMap[id];
        if (c) grid.appendChild(c);
      });
    } catch (err) {
      console.error('加载布局失败:', err);
    }
  }

  // ========== 右侧边栏切换 ==========
  setupRightSidebarToggle() {
    const toggle = document.getElementById('rightSidebarToggle');
    const sidebar = document.getElementById('rightSidebar');
    const overlay = document.getElementById('rightSidebarOverlay');
    
    if (toggle && sidebar) {
      const openSidebar = () => {
        sidebar.classList.remove('collapsed');
        if (overlay && window.matchMedia('(max-width: 640px)').matches) {
          overlay.classList.add('show');
        }
        toggle.textContent = '✕';
        toggle.title = '隐藏侧边栏';
      };

      const closeSidebar = () => {
        sidebar.classList.add('collapsed');
        if (overlay) overlay.classList.remove('show');
        toggle.textContent = '⚙️';
        toggle.title = '显示侧边栏';
      };

      const syncByViewport = () => {
        if (window.matchMedia('(max-width: 640px)').matches) {
          closeSidebar();
        } else {
          sidebar.classList.remove('collapsed');
          if (overlay) overlay.classList.remove('show');
          toggle.textContent = '⚙️';
          toggle.title = '显示/隐藏侧边栏';
        }
      };

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = sidebar.classList.contains('collapsed');
        if (isCollapsed) {
          openSidebar();
        } else {
          closeSidebar();
        }
      });
      
      // 点击遮罩关闭侧边栏
      if (overlay) {
        overlay.addEventListener('click', () => {
          closeSidebar();
        });
      }

      syncByViewport();
      window.addEventListener('resize', this._debounce(syncByViewport, 120));
    }
  }

  // ========== 移动端监控导航 ==========
  setupMobileMonitorNav() {
    const nav = document.getElementById('mobileMonitorNav');
    if (!nav) return;

    const buttons = Array.from(nav.querySelectorAll('.mobile-monitor-nav-btn'));
    if (buttons.length === 0) return;

    const setActive = (targetId) => {
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === targetId);
      });
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        if (!targetId) return;

        let target = document.querySelector(`.card[data-card-id="${targetId}"]`) || document.getElementById(targetId);
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActive(targetId);
      });
    });

    const observerTargets = buttons
      .map(btn => document.querySelector(`.card[data-card-id="${btn.dataset.target}"]`) || document.getElementById(btn.dataset.target))
      .filter(Boolean);

    if (observerTargets.length > 0 && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const targetId = visible[0].target.dataset.cardId || visible[0].target.id;
          if (targetId) setActive(targetId);
        }
      }, { threshold: [0.35, 0.6] });

      observerTargets.forEach(el => observer.observe(el));
    }

    setActive(buttons[0].dataset.target);
  }

  // ========== 动画增强 ==========
  setupAnimations() {
    // 添加页面过渡动画
    document.body.style.transition = 'opacity 0.3s ease-in-out';

    // 卡片进入动画
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animation = 'fadeInUp 0.5s ease-out';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.card').forEach(card => {
      observer.observe(card);
    });

    // 添加CSS动画
    if (!document.getElementById('uiAnimations')) {
      const style = document.createElement('style');
      style.id = 'uiAnimations';
      style.textContent = `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// 创建全局UI增强实例
window.uiEnhancements = new UIEnhancements();
