/**
 * Expands destructured Zustand store access into individual selectors.
 *
 * <b>Example:</b><br/>
 * `const { a, b } = autoSubscribe(myStore())`
 *
 * becomes:<br/>
 * `const a = myStore(s => s.a);`<br/>
 * `const b = myStore(s => s.b);`
 *
 * This keeps the code needed to subscribe to Zustand store short while also
 * preventing unnecessary rerenders by subscribing to each field individually.
 *
 * <b>Note:</b> This function is a no-op at runtime and is meant to be transformed by a build-time plugin.
 * See {@link zustandAutoSubscribePlugin} for the implementation.
 */
export function autoSubscribe<T>(store: T): T {
  return store;
}
