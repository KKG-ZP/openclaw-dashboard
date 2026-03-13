import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Disposable } from '../../../src/core/disposable.js';

describe('Disposable', () => {
  it('addListener registers and removes event listener on dispose', () => {
    const d = new Disposable();
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const handler = () => {};
    d.addListener(target, 'click', handler, { passive: true });
    expect(target.addEventListener).toHaveBeenCalledWith('click', handler, { passive: true });
    d.dispose();
    expect(target.removeEventListener).toHaveBeenCalledWith('click', handler, { passive: true });
  });

  it('addInterval clears interval on dispose', () => {
    vi.useFakeTimers();
    const d = new Disposable();
    const fn = vi.fn();
    d.addInterval(fn, 100);
    vi.advanceTimersByTime(350);
    expect(fn).toHaveBeenCalledTimes(3);
    d.dispose();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(3); // no more calls
    vi.useRealTimers();
  });

  it('addTimeout clears timeout on dispose', () => {
    vi.useFakeTimers();
    const d = new Disposable();
    const fn = vi.fn();
    d.addTimeout(fn, 1000);
    d.dispose();
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('addObserver disconnects observer on dispose', () => {
    const d = new Disposable();
    const observer = { disconnect: vi.fn() };
    d.addObserver(observer);
    d.dispose();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('addCleanup runs custom cleanup on dispose', () => {
    const d = new Disposable();
    const fn = vi.fn();
    d.addCleanup(fn);
    d.dispose();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('dispose clears the cleanup list (safe to call twice)', () => {
    const d = new Disposable();
    const fn = vi.fn();
    d.addCleanup(fn);
    d.dispose();
    d.dispose();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cleanup errors do not prevent other cleanups', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = new Disposable();
    const fn1 = vi.fn(() => { throw new Error('fail'); });
    const fn2 = vi.fn();
    d.addCleanup(fn1);
    d.addCleanup(fn2);
    d.dispose();
    expect(fn2).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('memory leak regression: 100 create-dispose cycles', () => {
    for (let i = 0; i < 100; i++) {
      const d = new Disposable();
      d.addCleanup(() => {});
      d.addCleanup(() => {});
      d.addCleanup(() => {});
      d.dispose();
    }
    // If we get here without OOM or error, the test passes
  });
});
