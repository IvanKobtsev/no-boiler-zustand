import { transformSync } from '@babel/core';
import type { Plugin } from 'vite';

const traditionalModule = 'zustand/traditional';
const equalityHookExport = 'useStoreWithEqualityFn';

function isCallableExpression(node: any): boolean {
  if (!node) return false;
  if (
    node.type === 'Identifier' ||
    node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression'
  ) {
    return true;
  }
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TypeCastExpression' ||
    node.type === 'ParenthesizedExpression'
  ) {
    return isCallableExpression(node.expression);
  }
  return false;
}

function getPropertyBinding(prop: any) {
  if (prop.type !== 'ObjectProperty' || prop.key.type !== 'Identifier') {
    return null;
  }
  let variableName = prop.key.name;
  if (prop.value.type === 'Identifier') variableName = prop.value.name;
  if (
    prop.value.type === 'AssignmentPattern' &&
    prop.value.left.type === 'Identifier'
  ) {
    variableName = prop.value.left.name;
  }
  return { propertyName: prop.key.name, variableName };
}

function buildRootSelector(propertyName: string) {
  return {
    type: 'ArrowFunctionExpression',
    params: [{ type: 'Identifier', name: 'state' }],
    body: {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'state' },
      property: { type: 'Identifier', name: propertyName },
      computed: false,
    },
  };
}

function buildPropertySelector(selector: any, propertyName: string) {
  return {
    type: 'ArrowFunctionExpression',
    params: [{ type: 'Identifier', name: 'state' }],
    body: {
      type: 'MemberExpression',
      object: {
        type: 'CallExpression',
        callee: selector,
        arguments: [{ type: 'Identifier', name: 'state' }],
      },
      property: { type: 'Identifier', name: propertyName },
      computed: false,
    },
  };
}

function buildJsonEquality() {
  const stringify = (name: string) => ({
    type: 'CallExpression',
    callee: {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'JSON' },
      property: { type: 'Identifier', name: 'stringify' },
      computed: false,
    },
    arguments: [{ type: 'Identifier', name }],
  });
  return {
    type: 'ArrowFunctionExpression',
    params: [
      { type: 'Identifier', name: 'a' },
      { type: 'Identifier', name: 'b' },
    ],
    body: {
      type: 'BinaryExpression',
      operator: '===',
      left: stringify('a'),
      right: stringify('b'),
    },
  };
}

function findEqualityHookImport(programPath: any): string | null {
  for (const node of programPath.node.body) {
    if (
      node.type !== 'ImportDeclaration' ||
      node.source.value !== traditionalModule ||
      node.importKind === 'type'
    ) {
      continue;
    }
    const specifier = node.specifiers.find(
      (candidate: any) =>
        candidate.type === 'ImportSpecifier' &&
        candidate.importKind !== 'type' &&
        (candidate.imported?.name === equalityHookExport ||
          candidate.imported?.value === equalityHookExport),
    );
    if (specifier?.local?.name) return specifier.local.name;
  }
  return null;
}

function addEqualityHookImport(programPath: any, localName: string) {
  const specifier = {
    type: 'ImportSpecifier',
    imported: { type: 'Identifier', name: equalityHookExport },
    local: { type: 'Identifier', name: localName },
  };
  const compatibleImport = programPath.node.body.find(
    (node: any) =>
      node.type === 'ImportDeclaration' &&
      node.source.value === traditionalModule &&
      node.importKind !== 'type' &&
      !node.specifiers.some(
        (candidate: any) => candidate.type === 'ImportNamespaceSpecifier',
      ),
  );
  if (compatibleImport) {
    compatibleImport.specifiers.push(specifier);
    return;
  }
  const declaration = {
    type: 'ImportDeclaration',
    specifiers: [specifier],
    source: { type: 'StringLiteral', value: traditionalModule },
  };
  let lastImportIndex = -1;
  for (let index = 0; index < programPath.node.body.length; index++) {
    if (programPath.node.body[index].type === 'ImportDeclaration') {
      lastImportIndex = index;
    }
  }
  programPath.node.body.splice(lastImportIndex + 1, 0, declaration);
}

/** Expands destructured Zustand access into individual subscriptions. */
export function zustandAutoSubscribePlugin(): Plugin {
  return {
    name: 'vite-plugin-zustand-auto-subscribe',
    transform(code, id) {
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;
      if (!code.includes('autoSubscribe')) return null;

      let didTransform = false;
      let didUseEqualityHook = false;
      let equalityHookName = equalityHookExport;
      let shouldAddEqualityHookImport = false;

      const result = transformSync(code, {
        filename: id,
        sourceMaps: true,
        sourceFileName: id,
        plugins: [
          function autoSubscribeTransform() {
            return {
              visitor: {
                Program: {
                  enter(programPath: any) {
                    const existingName = findEqualityHookImport(programPath);
                    if (existingName) {
                      equalityHookName = existingName;
                    } else {
                      if (programPath.scope.hasBinding(equalityHookExport)) {
                        equalityHookName =
                          programPath.scope.generateUidIdentifier(
                            equalityHookExport,
                          ).name;
                      }
                      shouldAddEqualityHookImport = true;
                    }
                  },
                  exit(programPath: any) {
                    if (didUseEqualityHook && shouldAddEqualityHookImport) {
                      addEqualityHookImport(programPath, equalityHookName);
                    }
                  },
                },
                VariableDeclaration(path: any) {
                  const newNodes: any[] = [];
                  let changed = false;

                  for (const declaration of path.node.declarations) {
                    const call = declaration.init;
                    if (
                      declaration.id?.type !== 'ObjectPattern' ||
                      call?.type !== 'CallExpression' ||
                      call.callee?.type !== 'Identifier' ||
                      call.callee.name !== 'autoSubscribe'
                    ) {
                      newNodes.push({
                        type: 'VariableDeclaration',
                        kind: path.node.kind,
                        declarations: [declaration],
                      });
                      continue;
                    }

                    const args = call.arguments;
                    const isRootMode =
                      args.length === 1 && isCallableExpression(args[0]);
                    const isSelectorMode =
                      (args.length === 2 || args.length === 3) &&
                      isCallableExpression(args[0]) &&
                      isCallableExpression(args[1]) &&
                      (args.length !== 3 || isCallableExpression(args[2]));
                    if (!isRootMode && !isSelectorMode) {
                      newNodes.push({
                        type: 'VariableDeclaration',
                        kind: path.node.kind,
                        declarations: [declaration],
                      });
                      continue;
                    }

                    for (const property of declaration.id.properties) {
                      const binding = getPropertyBinding(property);
                      if (!binding) continue;
                      const init = isRootMode
                        ? {
                            type: 'CallExpression',
                            callee: args[0],
                            arguments: [buildRootSelector(binding.propertyName)],
                          }
                        : {
                            type: 'CallExpression',
                            callee: {
                              type: 'Identifier',
                              name: equalityHookName,
                            },
                            arguments: [
                              args[0],
                              buildPropertySelector(
                                args[1],
                                binding.propertyName,
                              ),
                              args[2] ?? buildJsonEquality(),
                            ],
                          };
                      newNodes.push({
                        type: 'VariableDeclaration',
                        kind: path.node.kind,
                        loc: declaration.loc ?? path.node.loc,
                        declarations: [
                          {
                            type: 'VariableDeclarator',
                            loc: declaration.loc ?? path.node.loc,
                            id: {
                              type: 'Identifier',
                              name: binding.variableName,
                            },
                            init,
                          },
                        ],
                      });
                    }
                    changed = true;
                    if (isSelectorMode) didUseEqualityHook = true;
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
        parserOpts: { sourceType: 'module', plugins: ['typescript', 'jsx'] },
      });

      if (!didTransform || !result?.code) return null;
      return { code: result.code, map: result.map };
    },
  };
}
