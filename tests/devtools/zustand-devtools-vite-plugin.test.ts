import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { generate } from '@babel/generator';
import { zustandDevtoolsPlugin } from '../../src/devtools/zustand-devtools-vite-plugin.js';

describe('zustandDevtoolsPlugin', () => {
  it.each(transformCases)('$name', async ({ input, expected }) => {
    const output = await transformCode(input);

    expect(output).not.toBeNull();
    expect(normalize(output!)).toBe(normalize(expected));
  });

  it.each(untouchedCases)('returns null for $name', async ({ input, id }) => {
    const output = await transformCode(input, id);

    expect(output).toBeNull();
  });

  it.each(rejectedCases)('rejects the build for $name', async ({ input }) => {
    await expect(transformCode(input)).rejects.toThrow(
      /could not transform 'reduxDevtools' at .*store\.ts:\d+/,
    );
  });

  it('reports the exact line of an unsupported call', async () => {
    await expect(
      transformCode(
        'const before = true;\nconst value = reduxDevtools(createStore());',
      ),
    ).rejects.toThrow(/store\.ts:2/);
  });
});

const transformCases: { name: string; input: string; expected: string }[] = [
  {
    name: 'wraps the state creator with devtools, injects the devtools import and removes the reduxDevtools import',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const useStore = reduxDevtools(
        create()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export const useStore = create()(
        devtools((set) => ({ count: 0 }), { name: 'Store' }),
      );
    `,
  },
  {
    name: 'wraps the state creating function with devtools',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const createMyStore = (prefix: string) => reduxDevtools(
        create()((set) => ({ count: 0 })),
        prefix
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export const createMyStore = (prefix: string) => create()(
        devtools((set) => ({ count: 0 }), { name: '[' + prefix + '] MyStore' }),
      );
    `,
  },
  {
    name: 'names the store after the variable, without its "use" prefix',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      interface State { count: number }

      export const useMyStore = reduxDevtools(
        create<State>()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      interface State { count: number }

      export const useMyStore = create<State>()(
        devtools((set) => ({ count: 0 }), { name: 'MyStore' }),
      );
    `,
  },
  {
    name: 'uses the whole variable name when it has no "use" prefix',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      interface State { count: number }

      export const myFancyStore = reduxDevtools(
        create<State>()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      interface State { count: number }

      export const myFancyStore = create<State>()(
        devtools((set) => ({ count: 0 }), { name: 'MyFancyStore' }),
      );
    `,
  },
  {
    name: 'does not strip a "use" prefix that is not followed by an upper case letter',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const userStore = reduxDevtools(
        create()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export const userStore = create()(
        devtools((set) => ({ count: 0 }), { name: 'UserStore' }),
      );
    `,
  },
  {
    name: 'prepends a constant discriminator to the store name',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const useMyStore = reduxDevtools(
        create()((set) => ({ count: 0 })),
        'Left'
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export const useMyStore = create()(
        devtools((set) => ({ count: 0 }), { name: '[Left] MyStore' }),
      );
    `,
  },
  {
    name: 'builds the store name at runtime for a dynamic discriminator',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const useMyStore = reduxDevtools(
        create()((set) => ({ count: 0 })),
        getPanelId()
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export const useMyStore = create()(
        devtools((set) => ({ count: 0 }), {
          name: '[' + getPanelId() + '] MyStore',
        }),
      );
    `,
  },
  {
    name: 'omits the devtools options when the store is not assigned to a variable',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export default reduxDevtools(
        create()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export default create()(devtools((set) => ({ count: 0 })));
    `,
  },
  {
    name: 'appends devtools to an existing zustand/middleware import',
    input: `
      import { create } from 'zustand';
      import { persist } from 'zustand/middleware';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const useStore = reduxDevtools(
        create()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { persist, devtools } from 'zustand/middleware';

      export const useStore = create()(
        devtools((set) => ({ count: 0 }), { name: 'Store' }),
      );
    `,
  },
  {
    name: 'does not add a duplicate devtools import when it is already present',
    input: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      export const useStore = reduxDevtools(
        create()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      export const useStore = create()(
        devtools((set) => ({ count: 0 }), { name: 'Store' }),
      );
    `,
  },
  {
    name: 'keeps a shared import when reduxDevtools is one of multiple specifiers',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools, someOtherHelper } from 'helpers/zustand/devtools/reduxDevtools';

      export const useStore = reduxDevtools(
        create()((set) => ({ count: 0 }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { someOtherHelper } from 'helpers/zustand/devtools/reduxDevtools';
      import { devtools } from 'zustand/middleware';

      export const useStore = create()(
        devtools((set) => ({ count: 0 }), { name: 'Store' }),
      );
    `,
  },
  {
    name: 'handles a real-world store shape with set and get',
    input: `
      import { create } from 'zustand';
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      interface CounterState {
        count: number;
        increment: () => void;
      }

      export const useCounterStore = reduxDevtools(
        create<CounterState>()((set, get) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }))
      );
    `,
    expected: `
      import { create } from 'zustand';
      import { devtools } from 'zustand/middleware';

      interface CounterState {
        count: number;
        increment: () => void;
      }

      export const useCounterStore = create<CounterState>()(
        devtools(
          (set, get) => ({
            count: 0,
            increment: () => set({ count: get().count + 1 }),
          }),
          { name: 'CounterStore' },
        ),
      );
    `,
  },
];

const untouchedCases: { name: string; input: string; id?: string }[] = [
  {
    name: 'a non-code file',
    id: 'file.css',
    input: 'const a = 1;',
  },
  {
    name: 'a file that does not reference reduxDevtools',
    input: `
      import { create } from 'zustand';

      export const useStore = create()((set) => ({ count: 0 }));
    `,
  },
];

const rejectedCases: { name: string; input: string }[] = [
  {
    name: 'a reduxDevtools call whose argument is not a curried create',
    input: `
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      const result = reduxDevtools(someOtherCall({ count: 0 }));
    `,
  },
  {
    name: 'a reduxDevtools call without a state creator argument',
    input: `
      import { reduxDevtools } from 'helpers/zustand/devtools/reduxDevtools';

      const result = reduxDevtools(create<State>()());
    `,
  },
];

/**
 * Re-prints code from its AST, so that expected snippets can be written in a
 * readable style: indentation, line breaks and quote style don't affect the
 * comparison, only the code itself does.
 *
 * Parsing also throws a SyntaxError on unparseable code, which makes the
 * theories resilient against transform bugs producing broken output.
 */
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

async function transformCode(code: string, id = 'store.ts') {
  const plugin = zustandDevtoolsPlugin();
  const transform = plugin.transform;

  if (!transform) {
    throw new Error('Transform hook is not defined');
  }

  // @ts-ignore
  const result = await transform.call({}, code, id);

  if (result === null) {
    return null;
  }

  if (typeof result === 'string') {
    return result;
  }

  return result.code;
}
