import { describe, expect, it } from 'vitest';
import { autoSubscribe, jsonEqual, logAction, reduxDevtools } from '../src/index.js';

describe('runtime helpers', () => {
  it('throws when autoSubscribe reaches runtime without its Vite transform', () => {
    const store = (() => ({ count: 1 })) as never;
    expect(() => autoSubscribe(store)).toThrow(
      "no-boiler-zustand's 'autoSubscribe' reached runtime without being transformed. Make sure 'zustandAutoSubscribePlugin' is configured in Vite and processes this file.",
    );
  });

  it('throws when reduxDevtools reaches runtime without its Vite transform', () => {
    const creator = () => ({ count: 1 });
    expect(() => reduxDevtools(creator)).toThrow(
      "no-boiler-zustand's 'reduxDevtools' reached runtime without being transformed. Make sure 'zustandDevtoolsPlugin' is configured in Vite and processes this file.",
    );
  });

  it('throws when logAction reaches runtime without its Vite transform', () => {
    expect(() => logAction(undefined, 'increment')).toThrow(
      "no-boiler-zustand's 'logAction' reached runtime without being transformed. Make sure 'zustandLogActionPlugin' is configured in Vite and processes this file.",
    );
  });

  it('compares JSON-equivalent values', () => {
    expect(jsonEqual({ nested: [1, 2] }, { nested: [1, 2] })).toBe(true);
    expect(jsonEqual({ count: 1 }, { count: 2 })).toBe(false);
  });
});
