import { generate } from '@babel/generator';
import { parse } from '@babel/parser';
import { describe, expect, it } from 'vitest';
import { zustandAutoSubscribePlugin } from '../../src/autoSubscribe/zustand-auto-subscriber-vite-plugin.js';

describe('zustandAutoSubscribePlugin', () => {
  it.each(transformCases)('$name', async ({ input, expected }) => {
    const output = await transformCode(input);
    expect(output).not.toBeNull();
    expect(normalize(output!)).toBe(normalize(expected));
  });

  it.each(untouchedCases)('returns null for $name', async ({ input, id }) => {
    expect(await transformCode(input, id)).toBeNull();
  });

  it.each(rejectedCases)('rejects the build for $name', async ({ input }) => {
    await expect(transformCode(input)).rejects.toThrow(
      /could not transform 'autoSubscribe' at .*component\.tsx:\d+/,
    );
  });

  it('reports the exact line of an unsupported call', async () => {
    await expect(
      transformCode(
        'const before = true;\nconst value = autoSubscribe(useMyStore);',
      ),
    ).rejects.toThrow(/component\.tsx:2/);
  });
});

const transformCases = [
  {
    name: 'expands root fields from a hook reference',
    input: `const { count, name } = autoSubscribe(useMyStore);`,
    expected: `
      const count = useMyStore((state) => state.count);
      const name = useMyStore((state) => state.name);
    `,
  },
  {
    name: 'supports casts used by hook-compatible wrappers',
    input: `
      const { count } = autoSubscribe(
        useMyStore as UseZustandStore<MyState>,
      );
    `,
    expected: `
      const count = (useMyStore as UseZustandStore<MyState>)(
        (state) => state.count,
      );
    `,
  },
  {
    name: 'preserves aliases, defaults, declaration kind, and source order',
    input: `let { id: value = 'none', title } = autoSubscribe(useMyStore);`,
    expected: `
      let value = useMyStore((state) => state.id);
      let title = useMyStore((state) => state.title);
    `,
  },
  {
    name: 'skips rest properties',
    input: `const { count, ...rest } = autoSubscribe(useMyStore);`,
    expected: `const count = useMyStore((state) => state.count);`,
  },
  {
    name: 'preserves unrelated declarations in a shared statement',
    input: `const plain = 42, { count } = autoSubscribe(useMyStore);`,
    expected: `
      const plain = 42;
      const count = useMyStore((state) => state.count);
    `,
  },
  {
    name: 'composes an inline selector and injects deep equality',
    input: `
      const { id, title } = autoSubscribe(
        useMyStore,
        (state) => state.testCase,
      );
    `,
    expected: `
      import { useStoreWithEqualityFn } from 'zustand/traditional';
      const id = useStoreWithEqualityFn(
        useMyStore,
        (state) => ((state) => state.testCase)(state).id,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
      const title = useStoreWithEqualityFn(
        useMyStore,
        (state) => ((state) => state.testCase)(state).title,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    `,
  },
  {
    name: 'accepts a store API returned by a function call in selector mode',
    input: `
      const { attachments, tags } = autoSubscribe(
        useTestCaseChangeTrackerStoreApi(),
        (state) => state.updateTestCaseDto,
      );
    `,
    expected: `
      import { useStoreWithEqualityFn } from 'zustand/traditional';
      const attachments = useStoreWithEqualityFn(
        useTestCaseChangeTrackerStoreApi(),
        (state) => ((state) => state.updateTestCaseDto)(state).attachments,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
      const tags = useStoreWithEqualityFn(
        useTestCaseChangeTrackerStoreApi(),
        (state) => ((state) => state.updateTestCaseDto)(state).tags,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    `,
  },
  {
    name: 'subscribes directly to a selector result',
    input: `
      const blockers = autoSubscribe(
        useNavigationBlockerStore,
        (state) => state.blockers,
      );
    `,
    expected: `
      import { useStoreWithEqualityFn } from 'zustand/traditional';
      const blockers = useStoreWithEqualityFn(
        useNavigationBlockerStore,
        (state) => state.blockers,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    `,
  },
  {
    name: 'subscribes directly with a custom comparer',
    input: `
      const selected = autoSubscribe(store, selectValue, shallow);
    `,
    expected: `
      import { useStoreWithEqualityFn } from 'zustand/traditional';
      const selected = useStoreWithEqualityFn(store, selectValue, shallow);
    `,
  },
  {
    name: 'composes a named selector and custom comparer',
    input: `
      const { title } = autoSubscribe(
        stores.counter,
        selectors.testCase,
        customEquality,
      );
    `,
    expected: `
      import { useStoreWithEqualityFn } from 'zustand/traditional';
      const title = useStoreWithEqualityFn(
        stores.counter,
        (state) => selectors.testCase(state).title,
        customEquality,
      );
    `,
  },
  {
    name: 'merges into an existing traditional import',
    input: `
      import { createWithEqualityFn } from 'zustand/traditional';
      const { title } = autoSubscribe(useMyStore, selectTestCase);
    `,
    expected: `
      import {
        createWithEqualityFn,
        useStoreWithEqualityFn,
      } from 'zustand/traditional';
      const title = useStoreWithEqualityFn(
        useMyStore,
        (state) => selectTestCase(state).title,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    `,
  },
  {
    name: 'reuses an aliased traditional import',
    input: `
      import {
        useStoreWithEqualityFn as useStoreEq,
      } from 'zustand/traditional';
      const { title } = autoSubscribe(useMyStore, selectTestCase);
    `,
    expected: `
      import {
        useStoreWithEqualityFn as useStoreEq,
      } from 'zustand/traditional';
      const title = useStoreEq(
        useMyStore,
        (state) => selectTestCase(state).title,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    `,
  },
  {
    name: 'avoids a local equality hook name collision',
    input: `
      const useStoreWithEqualityFn = localHelper;
      const { title } = autoSubscribe(useMyStore, selectTestCase);
    `,
    expected: `
      import {
        useStoreWithEqualityFn as _useStoreWithEqualityFn,
      } from 'zustand/traditional';
      const useStoreWithEqualityFn = localHelper;
      const title = _useStoreWithEqualityFn(
        useMyStore,
        (state) => selectTestCase(state).title,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    `,
  },
];

const untouchedCases: { name: string; input: string; id?: string }[] = [
  { name: 'a non-code file', id: 'file.css', input: 'autoSubscribe(store)' },
  { name: 'a file without autoSubscribe', input: 'const value = store();' },
];

const rejectedCases: { name: string; input: string }[] = [
  {
    name: 'the removed invoked-hook syntax',
    input: 'const { count } = autoSubscribe(useMyStore());',
  },
  {
    name: 'a non-object binding',
    input: 'const count = autoSubscribe(useMyStore);',
  },
  {
    name: 'a missing store hook',
    input: 'const { count } = autoSubscribe();',
  },
  {
    name: 'a literal store value',
    input: 'const { count } = autoSubscribe({ count: 1 });',
  },
  {
    name: 'a selector without a callable store',
    input: 'const { count } = autoSubscribe(null, selectValue);',
  },
  {
    name: 'a non-callable selector',
    input: 'const { count } = autoSubscribe(useMyStore, 42);',
  },
  {
    name: 'a non-callable custom comparer',
    input: 'const { count } = autoSubscribe(useMyStore, selectValue, false);',
  },
  {
    name: 'too many arguments',
    input: 'const { count } = autoSubscribe(store, select, equal, extra);',
  },
];

function normalize(code: string) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  return generate(ast, { compact: true, comments: false }).code.replace(
    /"/g,
    "'",
  );
}

async function transformCode(code: string, id = 'component.tsx') {
  const transform = zustandAutoSubscribePlugin().transform;
  if (!transform) throw new Error('Transform hook is not defined');
  // @ts-ignore Vite supports callable transform hooks.
  const result = await transform.call({}, code, id);
  if (result === null || typeof result === 'string') return result;
  return result.code;
}
