/**
 * API 客户端 — fetch 封装，统一超时和错误处理
 */

const DEFAULT_TIMEOUT = 8000;

export async function fetchJson(url, opts = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal, ...fetchOpts });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function postAction(action) {
  return fetchJson(`/api/actions/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
}
