/**
 * HTML 转义 — 防止 XSS
 * 使用预编译的正则替换，比 DOM 方式更快
 */
const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const ESCAPE_RE = /[&<>"']/g;

export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(ESCAPE_RE, ch => ESCAPE_MAP[ch]);
}
