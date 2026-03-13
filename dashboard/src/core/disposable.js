/**
 * Disposable 基类 — 统一管理事件监听器、定时器、Observer 的生命周期
 * 所有模块继承此类，页面卸载时调用 dispose() 清理资源
 */
export class Disposable {
  #cleanups = [];

  /**
   * 注册 DOM 事件监听器，dispose 时自动移除
   */
  addListener(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    this.#cleanups.push(() => target.removeEventListener(event, handler, opts));
  }

  /**
   * 注册 setInterval，dispose 时自动 clearInterval
   */
  addInterval(fn, ms) {
    const id = setInterval(fn, ms);
    this.#cleanups.push(() => clearInterval(id));
    return id;
  }

  /**
   * 注册 setTimeout，dispose 时自动 clearTimeout
   */
  addTimeout(fn, ms) {
    const id = setTimeout(fn, ms);
    this.#cleanups.push(() => clearTimeout(id));
    return id;
  }

  /**
   * 注册 ResizeObserver / IntersectionObserver / MutationObserver
   */
  addObserver(observer) {
    this.#cleanups.push(() => observer.disconnect());
    return observer;
  }

  /**
   * 注册自定义清理函数
   */
  addCleanup(fn) {
    this.#cleanups.push(fn);
  }

  /**
   * 清理所有注册的资源
   */
  dispose() {
    for (const fn of this.#cleanups) {
      try { fn(); } catch (e) { console.error('[Disposable] cleanup error:', e); }
    }
    this.#cleanups.length = 0;
  }
}
