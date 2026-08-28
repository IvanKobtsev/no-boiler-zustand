import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import { zustandAutoSubscribePlugin } from '../src/autoSubscribe/zustand-auto-subscriber-vite-plugin.js';
import { zustandLogActionPlugin } from '../src/logAction/zustand-log-action-vite-plugin.js';
import { zustandDevtoolsPlugin } from '../src/devtools/zustand-devtools-vite-plugin.js';

async function transform(plugin: Plugin, code: string, id = 'store.tsx') {
  const hook = plugin.transform;

  if (typeof hook !== 'function') {
    throw new Error('Transform hook is not defined');
  }

  // @ts-ignore
  return hook.call({}, code, id);
}

const unrelatedCode = [
  'export function add(a: number, b: number) {',
  '  const sum = a + b;',
  '  return sum;',
  '}',
].join('\n');

const cases = [
  {
    name: 'zustandAutoSubscribePlugin',
    plugin: zustandAutoSubscribePlugin,
    triggeringCode: 'const { count } = autoSubscribe(useMyStore);',
  },
  {
    name: 'zustandLogActionPlugin',
    plugin: zustandLogActionPlugin,
    triggeringCode: [
      'const useStore = create((set) => ({',
      '  increment: () => logAction(set({ count: 1 })),',
      '}));',
    ].join('\n'),
  },
  {
    name: 'zustandDevtoolsPlugin',
    plugin: zustandDevtoolsPlugin,
    triggeringCode: [
      'const useStore = reduxDevtools(',
      '  create<State>()((set) => ({ count: 0 })),',
      ');',
    ].join('\n'),
  },
];

describe.each(cases)('$name', ({ plugin, triggeringCode }) => {
  it('returns a sourcemap alongside the transformed code', async () => {
    const result = await transform(plugin(), triggeringCode);

    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');

    const { code, map } = result as { code: string; map: unknown };

    expect(code).toBeTruthy();
    expect(map).toBeTruthy();
    expect((map as { mappings: string }).mappings).not.toBe('');
  });

  it('leaves files that do not use the helper untouched', async () => {
    const result = await transform(plugin(), unrelatedCode, 'unrelated.ts');

    expect(result).toBeNull();
  });

  it('returns null for non-code files', async () => {
    const result = await transform(plugin(), 'body { color: red; }', 'a.css');

    expect(result).toBeNull();
  });
});
