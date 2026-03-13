import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, formatTokens } from '../../../src/utils/time-format.js';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns 刚刚 for < 1 minute', () => {
    expect(formatRelativeTime('2026-03-13T11:59:30Z')).toBe('刚刚');
  });

  it('returns N分钟前 for < 60 minutes', () => {
    expect(formatRelativeTime('2026-03-13T11:30:00Z')).toBe('30分钟前');
  });

  it('returns N小时前 for < 24 hours', () => {
    expect(formatRelativeTime('2026-03-13T06:00:00Z')).toBe('6小时前');
  });

  it('returns N天前 for < 7 days', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00Z')).toBe('3天前');
  });

  it('returns locale date for >= 7 days', () => {
    const result = formatRelativeTime('2026-03-01T12:00:00Z');
    // toLocaleDateString('zh-CN') format varies by env, just check it's not a relative string
    expect(result).not.toMatch(/前$/);
  });
});

describe('formatTokens', () => {
  it('formats billions', () => {
    expect(formatTokens(1500000000)).toBe('1.5B');
  });

  it('formats millions', () => {
    expect(formatTokens(2500000)).toBe('2.5M');
  });

  it('formats thousands', () => {
    expect(formatTokens(1234)).toBe('1.2K');
  });

  it('returns plain number below 1000', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(0)).toBe('0');
  });

  it('handles non-numeric input', () => {
    expect(formatTokens(null)).toBe('0');
    expect(formatTokens('abc')).toBe('0');
    expect(formatTokens(undefined)).toBe('0');
  });

  it('handles string numbers', () => {
    expect(formatTokens('5000')).toBe('5.0K');
  });
});
