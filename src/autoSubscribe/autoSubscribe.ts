import type { StoreApi, UseBoundStore } from 'zustand';

export type UseZustandStore<TState> = UseBoundStore<StoreApi<TState>>;

/**
 * Expands destructured Zustand store access into individual selectors.
 * This is a build-time marker and throws if the Vite plugin does not transform it.
 */
export function autoSubscribe<TStoreState, TSelectorReturn>(
  storeHook: UseZustandStore<TStoreState>,
  selector: (store: TStoreState) => TSelectorReturn,
  equalityFn?: (a: any, b: any) => boolean,
): TSelectorReturn;
export function autoSubscribe<TStoreState>(
  storeHook: UseZustandStore<TStoreState>,
): TStoreState;
export function autoSubscribe<TStoreState, TSelectorReturn>(
  _storeHook: UseZustandStore<TStoreState>,
  _selector?: (store: TStoreState) => TSelectorReturn,
  _equalityFn?: (a: any, b: any) => boolean,
): TStoreState | TSelectorReturn {
  throw new Error(
    "better-zustand's 'autoSubscribe' plugin isn't configured properly",
  );
}
