/**
 * MobileNavManager — 移动端监控导航
 * 底部导航按钮 + IntersectionObserver 自动高亮当前可见卡片
 */
import { Disposable } from '../core/disposable.js';

export class MobileNavManager extends Disposable {
  setup() {
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
      this.addListener(btn, 'click', () => {
        const targetId = btn.dataset.target;
        if (!targetId) return;

        const target =
          document.querySelector(`.card[data-card-id="${targetId}"]`) ||
          document.getElementById(targetId);
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActive(targetId);
      });
    });

    const observerTargets = buttons
      .map(btn =>
        document.querySelector(`.card[data-card-id="${btn.dataset.target}"]`) ||
        document.getElementById(btn.dataset.target)
      )
      .filter(Boolean);

    if (observerTargets.length > 0 && 'IntersectionObserver' in window) {
      const observer = this.addObserver(
        new IntersectionObserver((entries) => {
          const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]) {
            const targetId = visible[0].target.dataset.cardId || visible[0].target.id;
            if (targetId) setActive(targetId);
          }
        }, { threshold: [0.35, 0.6] })
      );

      observerTargets.forEach(el => observer.observe(el));
    }

    setActive(buttons[0].dataset.target);
  }
}
