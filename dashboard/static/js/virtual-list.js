/**
 * Virtual List - 虚拟滚动组件
 * 用于优化大数据量列表渲染性能
 * 
 * 特性：
 * 1. 只渲染可视区域内的项目
 * 2. 支持动态高度
 * 3. 支持滚动缓冲（overscan）
 * 4. 支持搜索/筛选
 */

class VirtualList {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) {
      throw new Error('VirtualList: container not found');
    }

    this.options = {
      itemHeight: options.itemHeight || 60,      // 每项默认高度
      overscan: options.overscan || 5,           // 上下缓冲行数
      bufferSize: options.bufferSize || 100,     // 数据缓冲区大小
      onRenderItem: options.onRenderItem,        // 渲染单项的回调
      onItemClick: options.onItemClick,          // 点击回调
      ...options
    };

    this.data = [];
    this.filteredData = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;

    this.init();
  }

  init() {
    this.setupContainer();
    this.createElements();
    this.bindEvents();
    this.measureContainer();
  }

  setupContainer() {
    const container = this.container;
    container.style.position = 'relative';
    container.style.overflow = 'auto';
    container.style.willChange = 'transform';
    
    // 确保容器有明确的高度
    if (!container.style.height && !container.classList.contains('virtual-list-container')) {
      container.classList.add('virtual-list-container');
    }
  }

  createElements() {
    // 创建内容层
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'virtual-list-content';
    this.contentEl.style.position = 'relative';
    this.contentEl.style.width = '100%';
    
    // 创建高度占位元素
    this.spacerEl = document.createElement('div');
    this.spacerEl.className = 'virtual-list-spacer';
    this.spacerEl.style.height = '0px';
    
    // 清空容器并添加元素
    this.container.innerHTML = '';
    this.container.appendChild(this.spacerEl);
    this.container.appendChild(this.contentEl);
  }

  bindEvents() {
    // 滚动事件（节流）
    this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    
    // 窗口大小变化
    window.addEventListener('resize', this.debounce(() => {
      this.measureContainer();
      this.updateVisibleItems();
    }, 150));
  }

  measureContainer() {
    this.containerHeight = this.container.clientHeight;
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    
    // 标记正在滚动
    this.isScrolling = true;
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
    }, 150);

    // 使用 requestAnimationFrame 优化渲染
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.updateVisibleItems();
      });
    }
  }

  updateVisibleItems() {
    const { itemHeight, overscan } = this.options;
    const data = this.filteredData.length > 0 ? this.filteredData : this.data;
    const totalHeight = data.length * itemHeight;
    
    // 更新总高度
    this.spacerEl.style.height = `${totalHeight}px`;

    // 计算可见范围
    const startIdx = Math.max(0, Math.floor(this.scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(this.containerHeight / itemHeight) + overscan * 2;
    const endIdx = Math.min(data.length, startIdx + visibleCount);

    // 如果范围没有变化，跳过渲染
    if (startIdx === this.visibleStart && endIdx === this.visibleEnd) {
      return;
    }

    this.visibleStart = startIdx;
    this.visibleEnd = endIdx;

    // 渲染可见项目
    this.renderItems(data, startIdx, endIdx);
  }

  renderItems(data, startIdx, endIdx) {
    const { itemHeight, onRenderItem, onItemClick } = this.options;
    const { onItemEnter, onItemLeave } = this.options;
    
    // 计算偏移量
    const offsetTop = startIdx * itemHeight;
    
    // 生成 HTML
    const itemsHtml = [];
    for (let i = startIdx; i < endIdx; i++) {
      const item = data[i];
      if (!item) continue;
      
      const itemHtml = onRenderItem ? onRenderItem(item, i) : this.defaultRenderItem(item, i);
      itemsHtml.push(`
        <div class="virtual-list-item" 
             data-index="${i}"
             style="position: absolute; top: ${(i - startIdx) * itemHeight}px; left: 0; right: 0; height: ${itemHeight}px;">
          ${itemHtml}
        </div>
      `);
    }

    // 更新内容
    this.contentEl.innerHTML = itemsHtml.join('');
    this.contentEl.style.transform = `translateY(${offsetTop}px)`;

    // 绑定点击事件
    if (onItemClick) {
      this.contentEl.querySelectorAll('.virtual-list-item').forEach((el, idx) => {
        const dataIndex = startIdx + idx;
        el.addEventListener('click', () => onItemClick(data[dataIndex], dataIndex));
      });
    }

    // 触发渲染完成回调
    if (this.options.onRenderComplete) {
      this.options.onRenderComplete(startIdx, endIdx, data.length);
    }
  }

  defaultRenderItem(item, index) {
    return `<div style="padding: 10px; border-bottom: 1px solid var(--border);">
      ${typeof item === 'string' ? item : JSON.stringify(item)}
    </div>`;
  }

  // 设置数据
  setData(data) {
    this.data = Array.isArray(data) ? data : [];
    this.filteredData = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.updateVisibleItems();
  }

  // 追加数据
  appendData(newData) {
    if (!Array.isArray(newData)) return;
    this.data = [...this.data, ...newData];
    this.updateVisibleItems();
  }

  // 搜索/筛选
  filter(predicate) {
    if (!predicate) {
      this.filteredData = [];
    } else {
      this.filteredData = this.data.filter(predicate);
    }
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.container.scrollTop = 0;
    this.updateVisibleItems();
    return this.filteredData.length;
  }

  // 搜索（防抖包装）
  search(query, searchFields) {
    if (!query || query.trim() === '') {
      this.filter(null);
      return this.data.length;
    }

    const lowerQuery = query.toLowerCase();
    return this.filter(item => {
      if (!searchFields) {
        // 搜索所有字符串字段
        return Object.values(item).some(val => 
          typeof val === 'string' && val.toLowerCase().includes(lowerQuery)
        );
      }
      // 搜索指定字段
      return searchFields.some(field => {
        const val = item[field];
        return typeof val === 'string' && val.toLowerCase().includes(lowerQuery);
      });
    });
  }

  // 滚动到指定索引
  scrollToIndex(index, behavior = 'auto') {
    const { itemHeight } = this.options;
    this.container.scrollTo({
      top: index * itemHeight,
      behavior
    });
  }

  // 获取当前可见范围
  getVisibleRange() {
    return {
      start: this.visibleStart,
      end: this.visibleEnd,
      total: (this.filteredData.length > 0 ? this.filteredData : this.data).length
    };
  }

  // 工具方法：防抖
  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 销毁
  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.container.innerHTML = '';
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualList;
}
