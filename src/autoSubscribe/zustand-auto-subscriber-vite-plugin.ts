import type { Plugin } from 'vite';
import { transformSync } from '@babel/core';

/**
 * Expands destructured access of Zustand stores into individual selectors.
 *
 * See {@link autoSubscribe} for more info.
 */
export function zustandAutoSubscribePlugin(): Plugin {
  return {
    name: 'vite-plugin-zustand-auto-subscribe',

    transform(code, id) {
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;
      if (!code.includes('autoSubscribe')) return null;

      let didTransform = false;

      const result = transformSync(code, {
        filename: id,
        sourceMaps: true,
        sourceFileName: id,

        plugins: [
          function autoSubscribePlugin() {
            return {
              visitor: {
                VariableDeclaration(path: any) {
                  const newNodes: any[] = [];
                  let changed = false;

                  for (const decl of path.node.declarations) {
                    if (
                      decl.id?.type === 'ObjectPattern' &&
                      decl.init?.type === 'CallExpression' &&
                      decl.init.callee?.type === 'Identifier' &&
                      decl.init.callee.name === 'autoSubscribe'
                    ) {
                      const innerCall = decl.init.arguments?.[0];

                      if (
                        innerCall?.type === 'CallExpression' &&
                        innerCall.callee?.type === 'Identifier'
                      ) {
                        const storeName = innerCall.callee.name;

                        for (const prop of decl.id.properties) {
                          if (prop.type !== 'ObjectProperty') continue;
                          if (prop.key.type !== 'Identifier') continue;

                          const keyName = prop.key.name;

                          let varName = keyName;

                          if (prop.value.type === 'Identifier') {
                            varName = prop.value.name;
                          }

                          if (prop.value.type === 'AssignmentPattern') {
                            if (prop.value.left.type === 'Identifier') {
                              varName = prop.value.left.name;
                            }
                          }

                          newNodes.push({
                            type: 'VariableDeclaration',
                            kind: path.node.kind,
                            loc: decl.loc ?? path.node.loc,
                            declarations: [
                              {
                                type: 'VariableDeclarator',
                                loc: decl.loc ?? path.node.loc,
                                id: {
                                  type: 'Identifier',
                                  name: varName,
                                },
                                init: {
                                  type: 'CallExpression',
                                  callee: {
                                    type: 'Identifier',
                                    name: storeName,
                                  },
                                  arguments: [
                                    {
                                      type: 'ArrowFunctionExpression',
                                      params: [
                                        {
                                          type: 'Identifier',
                                          name: 's',
                                        },
                                      ],
                                      body: {
                                        type: 'MemberExpression',
                                        object: {
                                          type: 'Identifier',
                                          name: 's',
                                        },
                                        property: {
                                          type: 'Identifier',
                                          name: keyName,
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          });
                        }

                        changed = true;
                        continue;
                      }
                    }

                    newNodes.push({
                      type: 'VariableDeclaration',
                      kind: path.node.kind,
                      declarations: [decl],
                    });
                  }

                  if (changed) {
                    didTransform = true;
                    path.replaceWithMultiple(newNodes);
                  }
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
