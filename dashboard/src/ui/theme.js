/**
 * ThemeManager — 主题切换管理
 * 支持 light / dark 两套主题，持久化到 localStorage
 */
import { Disposable } from '../core/disposable.js';

const DARK = {
  '--bg-primary': '#1e293b',
  '--bg-secondary': '#0f172a',
  '--bg-card': '#1e293b',
  '--text-primary': '#f1f5f9',
  '--text-secondary': '#cbd5e1',
  '--text-muted': '#94a3b8',
  '--border-color': 'rgba(59, 130, 246, 0.3)',
};

const LIGHT = {
  '--bg-primary': '#f5f7fa',
  '--bg-secondary': '#ffffff',
  '--bg-card': '#ffffff',
  '--text-primary': '#1e293b',
  '--text-secondary': '#64748b',
  '--text-muted': '#94a3b8',
  '--border-color': 'rgba(59, 130, 246, 0.2)',
};

export class ThemeManager extends Disposable {
  constructor() {
    super();
    this.currentTheme = 'light';
  }

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

    this.addListener(themeBtn, 'click', () => this.toggleTheme());
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
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    const vars = theme === 'dark' ? DARK : LIGHT;
    for (const [prop, value] of Object.entries(vars)) {
      root.style.setProperty(prop, value);
    }
  }
}
