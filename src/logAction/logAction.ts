/**
 * A helper for more convenient way of logging
 * Zustand actions (e.g. to Redux DevTools).
 *
 * @example
 * ```ts
 * devTools((set) => ({
 *   // ...
 *   clearStates: () => {
 *    logAction(set({ state1: null }, 'start');
 *    // Instead of `set({ state1: null }, undefined, 'clearState/start');`
 *
 *    doSomeOtherAction();
 *
 *    logAction(set({ state2: null }, 'end');
 *    // Instead of `set({ state2: null }, undefined, 'clearState/end');`
 *   },
 * }),
 * {
 *   name: 'MyStore',
 * })
 * ```
 * This keeps the code needed to log actions short and more obvious to newcomers.
 *
 * <b>Note:</b> This function is a no-op at runtime and is meant to be transformed by a build-time plugin.
 * See {@link zustandLogActionPlugin} for the implementation.
 */
export function logAction(set: void, actionName?: string) {
  throw new Error(
    "no-boiler-zustand's 'logAction' reached runtime without being transformed. Make sure 'zustandLogActionPlugin' is configured in Vite and that the call uses a supported expression.",
  );
}
