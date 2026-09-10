import type { Plugin } from 'vite';
import { transformSync } from '@babel/core';
import { assertNoUntransformedHelperCalls } from '../untransformed-helper-error.js';

/**
 * Derives the PascalCase name shown in Redux DevTools from the variable the
 * store is assigned to: "useMyStore" becomes "MyStore", "myFancyStore" becomes
 * "MyFancyStore".
 *
 * The variable may also hold a function creating the store, in which case its
 * "create" prefix is dropped as well: "createMyStore" becomes "MyStore".
 *
 * Returns null when the store is not assigned to a plain variable, in which
 * case no name can be inferred.
 */
function getStoreName(path: any): string | null {
  const declarator = path.findParent(
    (parent: any) => parent.node?.type === 'VariableDeclarator',
  )?.node;

  if (declarator?.id?.type !== 'Identifier') {
    return null;
  }

  const variableName: string = declarator.id.name;
  const prefix = ['use', 'create'].find((candidate) =>
    new RegExp(`^${candidate}[A-Z]`).test(variableName),
  );
  const withoutPrefix = prefix
    ? variableName.slice(prefix.length)
    : variableName;

  return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
}

/**
 * Prepends the optional discriminator to the store name, so that several instances
 * of the same store can be told apart: "[Left] MyStore".
 *
 * A discriminator which is not a literal is concatenated at runtime.
 */
function buildStoreNameExpression(storeName: string, discriminatorArg: any) {
  if (!discriminatorArg) {
    return { type: 'StringLiteral', value: storeName };
  }

  if (discriminatorArg.type === 'StringLiteral') {
    return {
      type: 'StringLiteral',
      value: `[${discriminatorArg.value}] ${storeName}`,
    };
  }

  return {
    type: 'BinaryExpression',
    operator: '+',
    left: {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'StringLiteral', value: '[' },
      right: discriminatorArg,
    },
    right: { type: 'StringLiteral', value: `] ${storeName}` },
  };
}

/**
 * Treats an omitted value, as well as an explicit "undefined" or "null"
 * placeholder, as absent: `reduxDevtools(store, undefined)` or
 * `{ discriminator: undefined }`.
 */
function normalizeOptionalArg(arg: any) {
  if (!arg) return null;
  if (arg.type === 'NullLiteral') return null;
  if (arg.type === 'Identifier' && arg.name === 'undefined') return null;

  return arg;
}

function identifier(name: string) {
  return { type: 'Identifier', name };
}

function nameProperty(value: any) {
  return {
    type: 'ObjectProperty',
    computed: false,
    shorthand: false,
    key: identifier('name'),
    value,
  };
}

/**
 * Matches the "discriminator" property of an options object literal. It is
 * consumed by the plugin to build the store name and not forwarded to devtools().
 */
function isDiscriminatorProperty(property: any) {
  if (property.type !== 'ObjectProperty' || property.computed) return false;

  return (
    (property.key.type === 'Identifier' &&
      property.key.name === 'discriminator') ||
    (property.key.type === 'StringLiteral' &&
      property.key.value === 'discriminator')
  );
}

/**
 * Handles options whose "discriminator" is only known at runtime, by
 * destructuring them in place:
 * `(({ discriminator, ...options } = {}) => ({ ...options, name: ... }))(sharedOptions)`.
 */
function buildRuntimeDevtoolsOptions(
  storeName: string | null,
  optionsArg: any,
) {
  const body = storeName
    ? {
        type: 'ObjectExpression',
        properties: [
          { type: 'SpreadElement', argument: identifier('options') },
          nameProperty({
            type: 'ConditionalExpression',
            test: {
              type: 'BinaryExpression',
              operator: '==',
              left: identifier('discriminator'),
              right: { type: 'NullLiteral' },
            },
            consequent: { type: 'StringLiteral', value: storeName },
            alternate: buildStoreNameExpression(
              storeName,
              identifier('discriminator'),
            ),
          }),
        ],
      }
    : identifier('options');

  return {
    type: 'CallExpression',
    callee: {
      type: 'ArrowFunctionExpression',
      params: [
        {
          type: 'AssignmentPattern',
          left: {
            type: 'ObjectPattern',
            properties: [
              {
                type: 'ObjectProperty',
                computed: false,
                shorthand: true,
                key: identifier('discriminator'),
                value: identifier('discriminator'),
              },
              { type: 'RestElement', argument: identifier('options') },
            ],
          },
          right: { type: 'ObjectExpression', properties: [] },
        },
      ],
      body,
      expression: true,
    },
    arguments: [optionsArg],
  };
}

/**
 * Builds the options object passed to devtools(): the caller's options without
 * "discriminator", with the inferred "name" appended, so that the derived store
 * name always wins.
 *
 * Object literals are rewritten property by property, keeping the output readable;
 * any other expression, including a literal with spread elements, is destructured
 * at runtime, since its "discriminator" is only known then.
 *
 * Returns null when there is nothing to pass, in which case devtools() is called
 * with the state creator alone.
 */
function buildDevtoolsOptions(storeName: string | null, optionsArg: any) {
  if (!optionsArg) {
    return storeName
      ? {
          type: 'ObjectExpression',
          properties: [nameProperty(buildStoreNameExpression(storeName, null))],
        }
      : null;
  }

  const isStaticLiteral =
    optionsArg.type === 'ObjectExpression' &&
    !optionsArg.properties.some(
      (property: any) => property.type === 'SpreadElement',
    );

  if (!isStaticLiteral) {
    return buildRuntimeDevtoolsOptions(storeName, optionsArg);
  }

  const discriminatorArg = normalizeOptionalArg(
    optionsArg.properties.find(isDiscriminatorProperty)?.value,
  );
  const forwardedProperties = optionsArg.properties.filter(
    (property: any) => !isDiscriminatorProperty(property),
  );

  if (!storeName) {
    return forwardedProperties.length
      ? { type: 'ObjectExpression', properties: forwardedProperties }
      : null;
  }

  return {
    type: 'ObjectExpression',
    properties: [
      ...forwardedProperties,
      nameProperty(buildStoreNameExpression(storeName, discriminatorArg)),
    ],
  };
}

/**
 * Adds devtools() callback to "create" calls which are
 * wrapped with {@link reduxDevtools} function.
 *
 * See {@link reduxDevtools} for more info.
 */
export function zustandDevtoolsPlugin(): Plugin {
  return {
    name: 'vite-plugin-zustand-devtools',

    transform(code, id) {
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;
      if (!code.includes('reduxDevtools')) return null;

      let didTransform = false;

      const result = transformSync(code, {
        filename: id,
        sourceMaps: true,
        sourceFileName: id,

        plugins: [
          function devtoolsPlugin() {
            return {
              visitor: {
                CallExpression(path: any) {
                  // Match: reduxDevtools(create<T>()(stateCreator), options?)
                  if (
                    path.node.callee?.type !== 'Identifier' ||
                    path.node.callee.name !== 'reduxDevtools'
                  ) {
                    return;
                  }

                  // Leave the former positional form, reduxDevtools(store, 'Left', options),
                  // untransformed, so that it fails the build instead of spreading a string.
                  const [, optionsNode, ...extraArgs] = path.node.arguments;
                  if (
                    extraArgs.length ||
                    optionsNode?.type === 'StringLiteral' ||
                    optionsNode?.type === 'TemplateLiteral'
                  ) {
                    return;
                  }

                  // The single argument should be: create<T>()(stateCreator)
                  const outerArg = path.node.arguments?.[0];
                  if (outerArg?.type !== 'CallExpression') return;

                  // outerArg.callee should be the curried call: create<T>()
                  const curriedCall = outerArg.callee;
                  if (curriedCall?.type !== 'CallExpression') return;

                  // The state creator arguments passed to the curried call
                  const stateCreatorArgs = outerArg.arguments;
                  if (!stateCreatorArgs?.length) return;

                  const devtoolsOptions = buildDevtoolsOptions(
                    getStoreName(path),
                    normalizeOptionalArg(optionsNode),
                  );

                  const devtoolsArgs = devtoolsOptions
                    ? [...stateCreatorArgs, devtoolsOptions]
                    : stateCreatorArgs;

                  // Transform to: create<T>()(devtools(stateCreator, { name }))
                  path.replaceWith({
                    type: 'CallExpression',
                    callee: curriedCall,
                    arguments: [
                      {
                        type: 'CallExpression',
                        callee: {
                          type: 'Identifier',
                          name: 'devtools',
                        },
                        arguments: devtoolsArgs,
                      },
                    ],
                  });

                  didTransform = true;
                },

                Program: {
                  exit(programPath: any) {
                    assertNoUntransformedHelperCalls(
                      programPath,
                      'reduxDevtools',
                    );
                    if (!didTransform) return;

                    // --- Inject `devtools` import from 'zustand/middleware' ---
                    const hasDevtoolsImport = programPath.node.body.some(
                      (node: any) =>
                        node.type === 'ImportDeclaration' &&
                        node.source.value === 'zustand/middleware' &&
                        node.specifiers.some(
                          (s: any) =>
                            s.type === 'ImportSpecifier' &&
                            (s.imported?.name === 'devtools' ||
                              s.imported?.value === 'devtools'),
                        ),
                    );

                    if (!hasDevtoolsImport) {
                      const devtoolsSpecifier = {
                        type: 'ImportSpecifier',
                        imported: { type: 'Identifier', name: 'devtools' },
                        local: { type: 'Identifier', name: 'devtools' },
                      };

                      // Try to add to an existing 'zustand/middleware' import
                      const existingMiddlewareImport =
                        programPath.node.body.find(
                          (node: any) =>
                            node.type === 'ImportDeclaration' &&
                            node.source.value === 'zustand/middleware',
                        );

                      if (existingMiddlewareImport) {
                        existingMiddlewareImport.specifiers.push(
                          devtoolsSpecifier,
                        );
                      } else {
                        // Insert a brand-new import declaration before the first non-import node
                        const newImport = {
                          type: 'ImportDeclaration',
                          specifiers: [devtoolsSpecifier],
                          source: {
                            type: 'StringLiteral',
                            value: 'zustand/middleware',
                          },
                        };

                        const firstNonImportIdx =
                          programPath.node.body.findIndex(
                            (node: any) => node.type !== 'ImportDeclaration',
                          );

                        if (firstNonImportIdx === -1) {
                          programPath.node.body.push(newImport);
                        } else {
                          programPath.node.body.splice(
                            firstNonImportIdx,
                            0,
                            newImport,
                          );
                        }
                      }
                    }

                    // --- Remove `reduxDevtools` specifier from its import ---
                    for (
                      let i = programPath.node.body.length - 1;
                      i >= 0;
                      i--
                    ) {
                      const node = programPath.node.body[i];

                      if (node.type !== 'ImportDeclaration') continue;

                      const specifierIdx = node.specifiers.findIndex(
                        (s: any) =>
                          s.type === 'ImportSpecifier' &&
                          (s.imported?.name === 'reduxDevtools' ||
                            s.imported?.value === 'reduxDevtools'),
                      );

                      if (specifierIdx === -1) continue;

                      node.specifiers.splice(specifierIdx, 1);

                      // Drop the whole import declaration if it has no specifiers left
                      if (node.specifiers.length === 0) {
                        programPath.node.body.splice(i, 1);
                      }

                      break;
                    }
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
