import { describe, expect, it } from 'vitest';
import { autoSubscribe, jsonEqual, logAction, reduxDevtools } from '../src/index.js';

describe('runtime helpers', () => {
  it('throws when autoSubscribe reaches runtime without its Vite transform', () => {
    const store = (() => ({ count: 1 })) as never;
    expect(() => autoSubscribe(store)).toThrow(
      "no-boiler-zustand's 'zustandAutoSubscribePlugin' isn't configured properly",
    );
  });

  it('throws when reduxDevtools reaches runtime without its Vite transform', () => {
    const creator = () => ({ count: 1 });
    expect(() => reduxDevtools(creator)).toThrow(
      "no-boiler-zustand's 'zustandDevtoolsPlugin' isn't configured properly",
    );
  });

  it('throws when logAction reaches runtime without its Vite transform', () => {
    expect(() => logAction(undefined, 'increment')).toThrow(
      "no-boiler-zustand's 'zustandLogActionPlugin' isn't configured properly",
    );
  });

  it('compares JSON-equivalent values', () => {
    expect(jsonEqual({ nested: [1, 2] }, { nested: [1, 2] })).toBe(true);
    expect(jsonEqual({ count: 1 }, { count: 2 })).toBe(false);
  });
});
