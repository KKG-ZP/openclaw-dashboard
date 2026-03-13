import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/core/event-bus.js';

describe('EventBus', () => {
  it('emits events to registered handlers', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 'a', 'b');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('on() returns an unsubscribe function', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const unsub = bus.on('test', fn);
    unsub();
    bus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('once() fires handler only once', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.once('test', fn);
    bus.emit('test', 1);
    bus.emit('test', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('off() removes a specific handler', () => {
    const bus = new EventBus();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('test', fn1);
    bus.on('test', fn2);
    bus.off('test', fn1);
    bus.emit('test');
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });

  it('off() cleans up empty event sets', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('test', fn);
    bus.off('test', fn);
    expect(bus._listeners.has('test')).toBe(false);
  });

  it('clear() removes all listeners', () => {
    const bus = new EventBus();
    bus.on('a', vi.fn());
    bus.on('b', vi.fn());
    bus.clear();
    expect(bus._listeners.size).toBe(0);
  });

  it('handler errors do not break other handlers', () => {
    const bus = new EventBus();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn1 = vi.fn(() => { throw new Error('boom'); });
    const fn2 = vi.fn();
    bus.on('test', fn1);
    bus.on('test', fn2);
    bus.emit('test');
    expect(fn2).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('emit on non-existent event is a no-op', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nope')).not.toThrow();
  });
});
