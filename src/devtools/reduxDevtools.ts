import type { DevtoolsOptions } from 'zustand/middleware';

/**
 * Enables integration with Redux DevTools for a Zustand store.
 *
 * We don't use the original "devtools()", since it makes IDE lose type references to the store,
 * which makes it harder to work with the store in development.
 *
 * The store is shown in DevTools under the name of the variable it is assigned to, without
 * the "use" prefix: "useMyStore" becomes "MyStore".
 *
 * @param createCallbackResult Store creation callback, e.g. `create()((set) => ({ count: 0 }))`.
 * @param _discriminator Optional label telling apart several instances of the same store,
 * prepended to the name as "[{discriminator}] MyStore".
 * @param _options Optional configuration forwarded to Zustand's "devtools" middleware,
 * e.g. `{ trace: true }`. The store "name" is derived from the variable and cannot be
 * overridden here.
 *
 * <b>Note:</b> This function is a no-op at runtime and is meant to be transformed by a build-time plugin.
 * See {@link zustandDevtoolsPlugin} for the implementation.
 */
export function reduxDevtools<T>(
  createCallbackResult: T,
  _discriminator?: string,
  _options?: Omit<DevtoolsOptions, 'name'>,
): T {
  throw new Error(
    "no-boiler-zustand's 'reduxDevtools' reached runtime without being transformed. Make sure 'zustandDevtoolsPlugin' is configured in Vite and processes this file.",
  );
}
