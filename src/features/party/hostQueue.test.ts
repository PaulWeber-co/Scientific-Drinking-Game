import { describe, expect, it, vi } from 'vitest';
import { createQueue } from './hostQueue';

describe('Host-Warteschlange', () => {
  it('lässt den zweiten Lauf erst starten, wenn der erste fertig ist', async () => {
    const enqueue = createQueue();
    const order: string[] = [];
    let release!: () => void;
    const first = enqueue(async () => {
      order.push('a-start');
      await new Promise<void>((r) => (release = r));
      order.push('a-ende');
    });
    const second = enqueue(() => {
      order.push('b');
    });
    await Promise.resolve();
    expect(order).toEqual(['a-start']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['a-start', 'a-ende', 'b']);
  });

  it('blockiert nach einem Fehler nicht', async () => {
    const enqueue = createQueue();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran: string[] = [];
    await enqueue(() => Promise.reject(new Error('kaputt')));
    await enqueue(() => {
      ran.push('weiter');
    });
    expect(ran).toEqual(['weiter']);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
