/**
 * FullscreenManager — 全屏切换管理
 */
import { Disposable } from '../core/disposable.js';

export class FullscreenManager extends Disposable {
  constructor() {
    super();
    this.isFullscreen = false;
  }

  setup() {
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-btn';
    fullscreenBtn.id = 'fullscreenBtn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = '全屏 (F11)';

    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.insertBefore(fullscreenBtn, headerRight.firstChild);
    }

    this.addListener(fullscreenBtn, 'click', () => this.toggle());

    this.addListener(document, 'fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      fullscreenBtn.innerHTML = this.isFullscreen ? '⛶' : '⛶';
    });
  }

  toggle() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('进入全屏失败:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }
}
