import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { generate } from '@babel/generator';
import { zustandAutoSubscribePlugin } from '../../src/autoSubscribe/zustand-auto-subscriber-vite-plugin.js';

describe('zustandAutoSubscribePlugin', () => {
  it.each(transformCases)('$name', async ({ input, expected }) => {
    const output = await transformCode(input);

    expect(output).not.toBeNull();
    expect(normalize(output!)).toBe(normalize(expected));
  });

  it.each(untouchedCases)('returns null for $name', async ({ input, id }) => {
    const output = await transformCode(input, id);

    expect(output).toBeNull();
  });
});

const transformCases: { name: string; input: string; expected: string }[] = [
  {
    name: 'expands a shorthand destructure into individual selectors',
    input: `
      const { count, name } = autoSubscribe(useMyStore());
    `,
    expected: `
      const count = useMyStore((s) => s.count);
      const name = useMyStore((s) => s.name);
    `,
  },
  {
    name: 'uses the alias as the variable name for a renamed property',
    input: `
      const { count: total } = autoSubscribe(useMyStore());
    `,
    expected: `
      const total = useMyStore((s) => s.count);
    `,
  },
  {
    name: 'uses the binding name for a property with a default value',
    input: `
      const { count = 0 } = autoSubscribe(useMyStore());
    `,
    expected: `
      const count = useMyStore((s) => s.count);
    `,
  },
  {
    name: 'uses the binding name for a renamed property with a default value',
    input: `
      const { count: total = 0 } = autoSubscribe(useMyStore());
    `,
    expected: `
      const total = useMyStore((s) => s.count);
    `,
  },
  {
    name: 'preserves the "let" declaration kind',
    input: `
      let { x } = autoSubscribe(useMyStore());
    `,
    expected: `
      let x = useMyStore((s) => s.x);
    `,
  },
  {
    name: 'silently skips rest elements and only expands regular properties',
    input: `
      const { count, ...rest } = autoSubscribe(useMyStore());
    `,
    expected: `
      const count = useMyStore((s) => s.count);
    `,
  },
  {
    name: 'leaves unrelated declarations untouched',
    input: `
      const plain = 42;
      const { value } = autoSubscribe(useMyStore());
    `,
    expected: `
      const plain = 42;
      const value = useMyStore((s) => s.value);
    `,
  },
  {
    name: 'expands declarations that share a statement with an unrelated one',
    input: `
      const plain = 42,
        { value } = autoSubscribe(useMyStore());
    `,
    expected: `
      const plain = 42;
      const value = useMyStore((s) => s.value);
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
    name: 'a file that does not reference autoSubscribe',
    input: `
      const { count } = useMyStore();
    `,
  },
  {
    name: 'a destructure whose left-hand side is not an object pattern',
    input: `
      const count = autoSubscribe(useMyStore());
    `,
  },
  {
    name: 'a destructure that is not initialised by autoSubscribe',
    input: `
      const { count } = otherHelper(useMyStore());
    `,
  },
  {
    name: 'an autoSubscribe argument that is not a call expression',
    input: `
      const { count } = autoSubscribe(myStore);
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

async function transformCode(code: string, id = 'component.tsx') {
  const plugin = zustandAutoSubscribePlugin();
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
