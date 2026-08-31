export function assertNoUntransformedHelperCalls(
  programPath: any,
  helperName: string,
) {
  programPath.traverse({
    CallExpression(path: any) {
      if (
        path.node.callee?.type !== 'Identifier' ||
        path.node.callee.name !== helperName
      ) {
        return;
      }

      const filename = path.hub.file.opts.filename ?? 'unknown file';
      const line = path.node.loc?.start.line;
      const location = line ? `${filename}:${line}` : filename;

      throw path.buildCodeFrameError(
        `no-boiler-zustand could not transform '${helperName}' at ${location}. This call uses an unsupported expression.`,
      );
    },
  });
}
