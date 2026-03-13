/**
 * DOM 工具函数
 */

/** 安全获取元素 */
export function $(selector) {
  return document.querySelector(selector);
}

/** 安全获取元素 by ID */
export function $id(id) {
  return document.getElementById(id);
}

/** 批量 DOM 写入 — 收集更新在单个 rAF 中执行 */
let pendingUpdates = [];
let rafScheduled = false;

export function batchDomWrite(fn) {
  pendingUpdates.push(fn);
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(() => {
      const updates = pendingUpdates;
      pendingUpdates = [];
      rafScheduled = false;
      for (const update of updates) {
        try { update(); } catch (e) { console.error('[batchDomWrite]', e); }
      }
    });
  }
}
