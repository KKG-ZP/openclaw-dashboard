/**
 * KeyboardShortcuts — 全局快捷键管理
 * F5: 刷新数据, Ctrl+F: 搜索, F11: 全屏, Ctrl+T: 切换主题, Esc: 关闭模态框
 */
import { Disposable } from '../core/disposable.js';
import { bus } from '../core/event-bus.js';

export class KeyboardShortcuts extends Disposable {
  constructor({ fullscreenManager, themeManager } = {}) {
    super();
    this._fullscreenManager = fullscreenManager;
    this._themeManager = themeManager;
  }

  setup() {
    this.addListener(document, 'keydown', (e) => this._handleKeydown(e));
  }

  _handleKeydown(e) {
    // F5: 刷新数据
    if (e.key === 'F5') {
      e.preventDefault();
      bus.emit('request:refresh');
      return;
    }

    // Ctrl+F: 打开搜索
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const globalSearch = document.getElementById('globalSearch');
      if (globalSearch) globalSearch.focus();
      return;
    }

    // F11: 全屏切换
    if (e.key === 'F11') {
      e.preventDefault();
      if (this._fullscreenManager) this._fullscreenManager.toggle();
      return;
    }

    // Ctrl+T: 切换主题
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      if (this._themeManager) this._themeManager.toggleTheme();
      return;
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
  }
}
