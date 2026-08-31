import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * A Zustand bound store accepted by {@link autoSubscribe}.
 *
 * Custom hooks with the same selector call signature may be cast to this type
 * for root-level subscriptions. Selector mode additionally requires the real
 * {@link StoreApi} methods at runtime.
 */
export type UseZustandStore<TState> = UseBoundStore<StoreApi<TState>>;

/**
 * Subscribes independently to properties of a value selected from a Zustand
 * store while keeping the consuming code concise.
 *
 * The Vite transform replaces each destructured property with a separate
 * `useStoreWithEqualityFn` subscription. This prevents unrelated store changes
 * from rerendering the component. Without `equalityFn`, generated subscriptions
 * compare values through `JSON.stringify`.
 *
 * @example Subscribe to properties of a nested object
 * ```ts
 * const { id, title } = autoSubscribe(
 *   useTestCaseStore,
 *   (state) => state.testCase,
 * );
 * ```
 *
 * @example Provide a custom comparer for every destructured property
 * ```ts
 * const { title } = autoSubscribe(
 *   useTestCaseStore,
 *   (state) => state.testCase,
 *   (previous, next) => previous === next,
 * );
 * ```
 *
 * @param storeHook A genuine Zustand bound store. Selector mode passes it to
 * `useStoreWithEqualityFn`, so it must expose the Zustand `StoreApi` methods at
 * runtime.
 * @param selector Selects the object whose properties will be subscribed to.
 * @param equalityFn Optional comparer applied independently to every generated
 * property subscription. Defaults to JSON serialization equality.
 * @returns The selected value for type inference. The call itself is removed at
 * build time.
 * @throws If the call reaches runtime because `zustandAutoSubscribePlugin` was
 * not configured or could not transform it.
 * @see zustandAutoSubscribePlugin
 */
export function autoSubscribe<TStoreState, TSelectorReturn>(
  storeHook: UseZustandStore<TStoreState>,
  selector: (store: TStoreState) => TSelectorReturn,
  equalityFn?: (a: any, b: any) => boolean,
): TSelectorReturn;

/**
 * Subscribes independently to destructured root properties of a Zustand store.
 *
 * @example
 * ```ts
 * const { count, increment } = autoSubscribe(useCounterStore);
 * ```
 *
 * This becomes one ordinary Zustand selector call per property. A custom hook
 * that mimics Zustand's selector signature can be cast to
 * `UseZustandStore<TState>` in this root mode; unlike selector mode, no
 * `StoreApi` methods are used at runtime.
 *
 * @param storeHook A Zustand bound store, or a compatible selector hook cast to
 * {@link UseZustandStore}.
 * @returns The complete store state for type inference. The call itself is
 * removed at build time.
 * @throws If the call reaches runtime because `zustandAutoSubscribePlugin` was
 * not configured or could not transform it.
 * @see zustandAutoSubscribePlugin
 */
export function autoSubscribe<TStoreState>(
  storeHook: UseZustandStore<TStoreState>,
): TStoreState;
export function autoSubscribe<TStoreState, TSelectorReturn>(
  _storeHook: UseZustandStore<TStoreState>,
  _selector?: (store: TStoreState) => TSelectorReturn,
  _equalityFn?: (a: any, b: any) => boolean,
): TStoreState | TSelectorReturn {
  throw new Error(
    "no-boiler-zustand's 'autoSubscribe' reached runtime without being transformed. Make sure 'zustandAutoSubscribePlugin' is configured in Vite and processes this file.",
  );
}
