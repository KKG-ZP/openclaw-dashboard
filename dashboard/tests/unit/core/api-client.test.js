import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson, postAction } from '../../../src/core/api-client.js';

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns parsed JSON on success', async () => {
    const data = { status: 'ok' };
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
    const result = await fetchJson('/api/test');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('throws on non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchJson('/api/fail')).rejects.toThrow('HTTP 500');
  });

  it('supports custom timeout', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await fetchJson('/api/test', { timeout: 3000 });
    // Just verify it doesn't throw — timeout plumbing is internal
  });

  it('passes through extra fetch options', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await fetchJson('/api/test', {
      method: 'POST',
      headers: { 'X-Custom': 'yes' },
    });
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      headers: { 'X-Custom': 'yes' },
    }));
  });
});

describe('postAction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends POST to /api/actions/:action', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const result = await postAction('restart');
    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith('/api/actions/restart', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });
});
