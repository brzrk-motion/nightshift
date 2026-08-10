import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './events.js';
import { createDisposableBag } from './disposables.js';

interface TestEvents extends Record<string, unknown[]> {
  tick: [count: number];
  done: [];
}

describe('createEventBus', () => {
  it('delivers events to every subscriber', () => {
    const bus = createEventBus<TestEvents>();
    const first = vi.fn();
    const second = vi.fn();
    bus.on('tick', first);
    bus.on('tick', second);

    bus.emit('tick', 3);

    expect(first).toHaveBeenCalledWith(3);
    expect(second).toHaveBeenCalledWith(3);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus<TestEvents>();
    const listener = vi.fn();
    const off = bus.on('tick', listener);

    off();
    off(); // unsubscribing twice must be safe
    bus.emit('tick', 1);

    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount('tick')).toBe(0);
  });

  it('fires a once listener a single time', () => {
    const bus = createEventBus<TestEvents>();
    const listener = vi.fn();
    bus.once('tick', listener);

    bus.emit('tick', 1);
    bus.emit('tick', 2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it('does not deliver to listeners added during dispatch', () => {
    const bus = createEventBus<TestEvents>();
    const late = vi.fn();
    bus.on('tick', () => bus.on('tick', late));

    bus.emit('tick', 1);

    expect(late).not.toHaveBeenCalled();
  });

  it('keeps dispatching when a listener throws', () => {
    const onError = vi.fn();
    const bus = createEventBus<TestEvents>({ onError });
    const after = vi.fn();
    bus.on('tick', () => {
      throw new Error('boom');
    });
    bus.on('tick', after);

    bus.emit('tick', 1);

    expect(after).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[1]).toBe('tick');
  });

  it('counts and clears listeners', () => {
    const bus = createEventBus<TestEvents>();
    bus.on('tick', vi.fn());
    bus.on('done', vi.fn());
    expect(bus.listenerCount()).toBe(2);

    bus.clear('tick');
    expect(bus.listenerCount()).toBe(1);

    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });
});

describe('createDisposableBag', () => {
  it('disposes in reverse order', async () => {
    const order: string[] = [];
    const bag = createDisposableBag();
    bag.add(() => order.push('first'));
    bag.add({ dispose: () => void order.push('second') });

    await bag.dispose();

    expect(order).toEqual(['second', 'first']);
    expect(bag.disposed).toBe(true);
  });

  it('disposes the rest when one teardown throws', async () => {
    const onError = vi.fn();
    const after = vi.fn();
    const bag = createDisposableBag({ onError });
    bag.add(after);
    bag.add(() => {
      throw new Error('boom');
    });

    await bag.dispose();

    expect(after).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('releases anything added after disposal', async () => {
    const bag = createDisposableBag();
    await bag.dispose();

    const late = vi.fn();
    bag.add(late);

    expect(late).toHaveBeenCalledOnce();
    expect(bag.size).toBe(0);
  });

  it('only disposes once', async () => {
    const teardown = vi.fn();
    const bag = createDisposableBag();
    bag.add(teardown);

    await bag.dispose();
    await bag.dispose();

    expect(teardown).toHaveBeenCalledOnce();
  });
});
