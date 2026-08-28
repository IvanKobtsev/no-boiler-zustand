import { describe, expect, it } from 'vitest';
import { autoSubscribe, jsonEqual, logAction, reduxDevtools } from '../src/index.js';

describe('runtime helpers', () => {
  it('returns the store value unchanged from autoSubscribe', () => {
    const store = { count: 1 };
    expect(autoSubscribe(store)).toBe(store);
  });

  it('returns the state creator unchanged from reduxDevtools', () => {
    const creator = () => ({ count: 1 });
    expect(reduxDevtools(creator)).toBe(creator);
  });

  it('keeps logAction as a runtime no-op', () => {
    expect(logAction(undefined, 'increment')).toBeUndefined();
  });

  it('compares JSON-equivalent values', () => {
    expect(jsonEqual({ nested: [1, 2] }, { nested: [1, 2] })).toBe(true);
    expect(jsonEqual({ count: 1 }, { count: 2 })).toBe(false);
  });
});
