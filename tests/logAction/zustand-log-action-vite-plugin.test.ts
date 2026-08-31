import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { generate } from '@babel/generator';
import { zustandLogActionPlugin } from '../../src/logAction/zustand-log-action-vite-plugin.js';

describe('zustandLogActionPlugin', () => {
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
      /could not transform 'logAction' at .*store\.ts:\d+/,
    );
  });

  it('reports the exact line of an unsupported call', async () => {
    await expect(
      transformCode(
        'const before = true;\nconst value = logAction(otherCall());',
      ),
    ).rejects.toThrow(/store\.ts:2/);
  });
});

const transformCases: { name: string; input: string; expected: string }[] = [
  {
    name: 'names the action after the enclosing object method',
    input: `
      const store = {
        increment() {
          logAction(set({ count: 1 }));
        },
      };
    `,
    expected: `
      const store = {
        increment() {
          set({ count: 1 }, undefined, 'increment');
        },
      };
    `,
  },
  {
    name: 'names the action after the enclosing object property',
    input: `
      const store = {
        updateName: () => logAction(set({ name: 'ivan' })),
      };
    `,
    expected: `
      const store = {
        updateName: () => set({ name: 'ivan' }, undefined, 'updateName'),
      };
    `,
  },
  {
    name: 'names the action after the enclosing function declaration',
    input: `
      function run() {
        return logAction(set({ started: true }));
      }
    `,
    expected: `
      function run() {
        return set({ started: true }, undefined, 'run');
      }
    `,
  },
  {
    name: 'names the action after the enclosing variable declarator',
    input: `
      const finish = () => logAction(set({ done: true }));
    `,
    expected: `
      const finish = () => set({ done: true }, undefined, 'finish');
    `,
  },
  {
    name: 'appends a string suffix from the second logAction argument',
    input: `
      const store = {
        updateName: () => logAction(set({ name: 'ivan' }), 'manual'),
      };
    `,
    expected: `
      const store = {
        updateName: () => set({ name: 'ivan' }, undefined, 'updateName/manual'),
      };
    `,
  },
  {
    name: 'builds the action name at runtime for a non-literal suffix',
    input: `
      const suffix = getSuffix();
      const save = () => logAction(set({ ok: true }), suffix);
    `,
    expected: `
      const suffix = getSuffix();
      const save = () => set({ ok: true }, undefined, 'save/' + suffix);
    `,
  },
  {
    name: 'rewrites every logAction call in the file',
    input: `
      function run() {
        return logAction(set({ started: true }));
      }

      const finish = () => logAction(set({ done: true }));
    `,
    expected: `
      function run() {
        return set({ started: true }, undefined, 'run');
      }

      const finish = () => set({ done: true }, undefined, 'finish');
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
    name: 'a file that does not reference logAction',
    input: `
      const store = {
        increment() {
          set({ count: 1 });
        },
      };
    `,
  },
];

const rejectedCases: { name: string; input: string }[] = [
  {
    name: 'a logAction argument that is not a set(...) call',
    input: `
      const store = {
        noSet() {
          logAction(otherCall({ x: 1 }));
        },
      };
    `,
  },
  {
    name: 'a set(...) call without a partial state argument',
    input: `
      const store = {
        noPayload() {
          logAction(set());
        },
      };
    `,
  },
  {
    name: 'a logAction call with no enclosing named function',
    input: `
      logAction(set({ count: 1 }));
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
  const plugin = zustandLogActionPlugin();
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
