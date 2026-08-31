import type { Plugin } from 'vite';
import { transformSync } from '@babel/core';
import { assertNoUntransformedHelperCalls } from '../untransformed-helper-error.js';

function getPropertyKeyName(key: any, computed: boolean): string | null {
  if (computed) return null;

  if (key?.type === 'Identifier') return key.name;
  if (key?.type === 'StringLiteral') return key.value;
  if (key?.type === 'NumericLiteral') return String(key.value);

  return null;
}

function getEnclosingActionName(path: any): string | null {
  let currentPath = path;

  while (currentPath) {
    const node = currentPath.node;

    if (node?.type === 'ObjectMethod') {
      return getPropertyKeyName(node.key, node.computed);
    }

    if (
      node?.type === 'ObjectProperty' &&
      (node.value?.type === 'ArrowFunctionExpression' ||
        node.value?.type === 'FunctionExpression')
    ) {
      return getPropertyKeyName(node.key, node.computed);
    }

    if (
      node?.type === 'FunctionDeclaration' &&
      node.id?.type === 'Identifier'
    ) {
      return node.id.name;
    }

    if (
      node?.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      (node.init?.type === 'ArrowFunctionExpression' ||
        node.init?.type === 'FunctionExpression')
    ) {
      return node.id.name;
    }

    currentPath = currentPath.parentPath;
  }

  return null;
}

function buildActionNameExpression(
  baseActionName: string,
  optionalActionNameArg: any,
) {
  if (!optionalActionNameArg) {
    return {
      type: 'StringLiteral',
      value: baseActionName,
    };
  }

  if (optionalActionNameArg.type === 'StringLiteral') {
    return {
      type: 'StringLiteral',
      value: `${baseActionName}/${optionalActionNameArg.value}`,
    };
  }

  return {
    type: 'BinaryExpression',
    operator: '+',
    left: {
      type: 'StringLiteral',
      value: `${baseActionName}/`,
    },
    right: optionalActionNameArg,
  };
}

/**
 * Makes logging Zustand store actions more convenient.
 *
 * See {@link logAction} for more info.
 */
export function zustandLogActionPlugin(): Plugin {
  return {
    name: 'vite-plugin-zustand-log-action',

    transform(code, id) {
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;
      if (!code.includes('logAction')) return null;

      let didTransform = false;

      const result = transformSync(code, {
        filename: id,
        sourceMaps: true,
        sourceFileName: id,

        plugins: [
          function logActionPlugin() {
            return {
              visitor: {
                CallExpression(path: any) {
                  if (
                    path.node.callee?.type !== 'Identifier' ||
                    path.node.callee.name !== 'logAction'
                  ) {
                    return;
                  }

                  const setCall = path.node.arguments?.[0];

                  if (
                    setCall?.type !== 'CallExpression' ||
                    setCall.callee?.type !== 'Identifier' ||
                    setCall.callee.name !== 'set'
                  ) {
                    return;
                  }

                  const partialStateArg = setCall.arguments?.[0];

                  if (!partialStateArg) return;

                  const actionName = getEnclosingActionName(path);

                  if (!actionName) return;

                  const optionalActionNameArg = path.node.arguments?.[1];
                  const finalActionNameArg = buildActionNameExpression(
                    actionName,
                    optionalActionNameArg,
                  );

                  path.replaceWith({
                    type: 'CallExpression',
                    callee: setCall.callee,
                    arguments: [
                      partialStateArg,
                      {
                        type: 'Identifier',
                        name: 'undefined',
                      },
                      finalActionNameArg,
                    ],
                  });

                  didTransform = true;
                },
                Program: {
                  exit(programPath: any) {
                    assertNoUntransformedHelperCalls(programPath, 'logAction');
                  },
                },
              },
            };
          },
        ],

        parserOpts: {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        },
      });

      if (!didTransform || !result?.code) return null;

      return { code: result.code, map: result.map };
    },
  };
}
