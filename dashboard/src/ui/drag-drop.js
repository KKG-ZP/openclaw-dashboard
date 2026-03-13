/**
 * DragDropManager — 瀑布流布局 + 跟手拖拽
 * 从 ui-enhancements.js 移植，使用 Disposable 管理所有事件/Observer 生命周期
 */
import { Disposable } from '../core/disposable.js';

export class DragDropManager extends Disposable {
  constructor() {
    super();
    this._drag = null;
    this._masonryEnabled = false;
    this._layoutRAFPending = false;
    this._lastCardWidths = new Map();
    this._masonryGap = 20;
    this._masonryMinCol = 350;
    this._masonryMaxCols = 4;
  }

  setupDragAndDrop() {
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
      if (header._dragHandler) {
        header.removeEventListener('mousedown', header._dragHandler);
      }
      // 绑定新的事件监听器
      const boundHandler = (e) => this._onMouseDown(e, card, grid);
      this.addListener(header, 'mousedown', boundHandler);
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
    this.addListener(btn, 'click', () => {
      localStorage.removeItem('cardLayout');
      window.location.reload();
    });
    document.body.appendChild(btn);
    if (localStorage.getItem('cardLayout')) btn.classList.add('visible');
  }

  // ---- 瀑布流核心 ----

  _initMasonry(grid) {
    this._masonryEnabled = true;

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
    this.addListener(window, 'resize', this._resizeHandler);

    // 卡片尺寸变化时重新计算（内容更新导致高度变化）
    this._contentObserver = this.addObserver(new ResizeObserver((entries) => {
      if (this._drag && this._drag.activated) return;

      let hasHeightChange = false;
      for (const entry of entries) {
        const el = entry.target;
        const prev = this._lastCardWidths.get(el);
        const curH = entry.contentRect.height;
        if (!prev || Math.abs(prev.h - curH) > 1) {
          hasHeightChange = true;
          break;
        }
      }
      if (hasHeightChange) {
        this._scheduleLayout();
      }
    }));

    grid.querySelectorAll(':scope > .card[data-card-id]').forEach(card => {
      this._contentObserver.observe(card);
    });

    // 额外保险：所有资源加载完毕后重排一次
    this.addListener(window, 'load', () => this.layoutMasonry());
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

    // 平板/手机关闭瀑布流，回退自然流
    if (window.matchMedia('(max-width: 1024px)').matches) {
      this._disableMasonryLayout(grid);
      return;
    }

    // 桌面大屏：固定两列(1:3)
    if (window.matchMedia('(min-width: 1200px)').matches) {
      this._enableMasonryLayout(grid);
      this._layoutDesktopTwoColumn(grid);
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

    // 强制所有卡片重新计算高度
    items.forEach(item => {
      item.style.height = 'auto';
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

  _layoutDesktopTwoColumn(grid) {
    const containerWidth = grid.clientWidth;
    if (containerWidth <= 0) return;

    const gapX = 16;
    const rightGapY = 16;
    const leftGapY = 16;

    const leftW = Math.max(260, (containerWidth - gapX) * 0.25);
    const rightW = Math.max(0, containerWidth - gapX - leftW);

    const byId = (id) => grid.querySelector(`:scope > .card[data-card-id="${id}"]`);
    const leftCards = [
      byId('system-overview'),
      byId('current-tasks'),
      byId('task-history')
    ].filter(Boolean);
    const rightCards = [
      byId('agents'),
      byId('model-usage'),
      byId('skills-usage')
    ].filter(Boolean);

    const allCards = Array.from(grid.querySelectorAll(':scope > .card[data-card-id]'));
    let leftTop = 0;
    let rightTop = 0;

    // 先清理可能残留的样式
    allCards.forEach(card => {
      card.style.height = 'auto';
      card.style.gridColumn = 'auto';
      card.style.gridRow = 'auto';
    });

    // 左列：无缝堆叠
    leftCards.forEach((card, idx) => {
      card.style.width = `${leftW}px`;
      card.style.left = '0px';
      card.style.top = `${leftTop}px`;
      leftTop += card.offsetHeight + (idx < leftCards.length - 1 ? leftGapY : 0);
      this._lastCardWidths.set(card, { w: leftW, h: card.offsetHeight });
    });

    // 右列：常规间距
    rightCards.forEach((card, idx) => {
      card.style.width = `${rightW}px`;
      card.style.left = `${leftW + gapX}px`;
      card.style.top = `${rightTop}px`;
      rightTop += card.offsetHeight + (idx < rightCards.length - 1 ? rightGapY : 0);
      this._lastCardWidths.set(card, { w: rightW, h: card.offsetHeight });
    });

    // 兜底：未在映射中的卡片放到右列末尾
    const mapped = new Set([...leftCards, ...rightCards]);
    allCards.forEach(card => {
      if (mapped.has(card)) return;
      card.style.width = `${rightW}px`;
      card.style.left = `${leftW + gapX}px`;
      card.style.top = `${rightTop}px`;
      rightTop += card.offsetHeight + rightGapY;
      this._lastCardWidths.set(card, { w: rightW, h: card.offsetHeight });
    });

    grid.style.height = `${Math.max(leftTop, rightTop)}px`;
  }

  _disableMasonryLayout(grid) {
    grid.classList.remove('masonry-active', 'masonry-no-transition', 'is-dragging');
    grid.classList.add('masonry-disabled');
    grid.style.height = '';

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
    if (window.matchMedia('(max-width: 1024px), (min-width: 1200px)').matches) return;
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
    card.style.cssText = '';
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
      const dist = dx * dx + dy * dy;

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

      const appended = new Set();

      // 先按旧顺序恢复已存在卡片
      order.forEach(id => {
        const c = cardMap[id];
        if (c) {
          grid.appendChild(c);
          appended.add(id);
        }
      });

      // 再补上新增卡片（旧布局里没有的）
      grid.querySelectorAll(':scope > .card[data-card-id]').forEach(c => {
        const id = c.dataset.cardId;
        if (!appended.has(id)) {
          grid.appendChild(c);
          appended.add(id);
        }
      });

      // 若检测到布局缺失新卡片，自动写回一次
      if (appended.size !== order.length) {
        this.saveLayout();
      }
    } catch (err) {
      console.error('加载布局失败:', err);
    }
  }
}
