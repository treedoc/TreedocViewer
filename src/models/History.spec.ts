import History from './History';
import { describe, expect, test } from 'vitest'

describe('History.ts', () => {
  test('History should works', () => {
    const hist = new History<string>();
    expect(hist.canBack()).toBe(false);
    expect(hist.canForward()).toBe(false);

    hist.append('first');
    expect(hist.canBack()).toBe(false);
    expect(hist.canForward()).toBe(false);

    hist.append('second');
    expect(hist.canBack()).toBe(true);
    expect(hist.canForward()).toBe(false);

    expect(hist.back()).toBe('first');
    expect(hist.canForward()).toBe(true);
    expect(hist.canBack()).toBe(false);

    expect(hist.forward()).toBe('second');
    expect(hist.canForward()).toBe(false);
    expect(hist.canBack()).toBe(true);
  });
})
