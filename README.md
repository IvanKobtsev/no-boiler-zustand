# better-zustand

> [!IMPORTANT]
> **Vite only:** `better-zustand` relies on custom Vite transforms and does not work with Webpack, Parcel, esbuild-only setups, or other build tools.

Build-time Vite helpers for concise Zustand selectors, Redux DevTools integration, and action names without sacrificing store type inference.

## Install

```sh
npm install better-zustand
```

`better-zustand` requires Node.js 20+, Vite 5–7, and Zustand 5. Vite is required even when you only import the marker helpers, because those helpers depend on the corresponding build-time transforms.

## Configure Vite

Add the transforms before plugins that compile your application code:

```ts
import { defineConfig } from 'vite';
import {
  zustandAutoSubscribePlugin,
  zustandDevtoolsPlugin,
  zustandLogActionPlugin,
} from 'better-zustand/vite';

export default defineConfig({
  plugins: [
    zustandAutoSubscribePlugin(),
    zustandLogActionPlugin(),
    zustandDevtoolsPlugin(),
  ],
});
```

## Automatically subscribe to fields

```ts
import { autoSubscribe } from 'better-zustand';

const { count, increment } = autoSubscribe(useCounterStore);
```

At build time this becomes one selector subscription per field:

```ts
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);
```

Pass a selector as the second argument to destructure a nested value. Each field receives an independent subscription with JSON serialization equality by default:

```ts
const { id, title } = autoSubscribe(
  useCounterStore,
  (state) => state.testCase,
);
```

This is transformed into the equivalent of:

```ts
import { useStoreWithEqualityFn } from 'zustand/traditional';

const id = useStoreWithEqualityFn(
  useCounterStore,
  (state) => state.testCase.id,
  (a, b) => JSON.stringify(a) === JSON.stringify(b),
);
const title = useStoreWithEqualityFn(
  useCounterStore,
  (state) => state.testCase.title,
  (a, b) => JSON.stringify(a) === JSON.stringify(b),
);
```

Named selectors and member-expression selectors are supported. Pass a third argument to replace the JSON comparison for every generated field:

```ts
const { title } = autoSubscribe(
  useCounterStore,
  selectTestCase,
  (previous, next) => previous.localeCompare(next) === 0,
);
```

JSON comparison is useful for deeply nested JSON-compatible values, but serialization has a runtime cost and depends on stable key order. Prefer a custom comparer for hot paths or values that are not JSON-compatible.

`autoSubscribe` must receive the hook itself. The former `autoSubscribe(useCounterStore())` syntax is unsupported. If the marker reaches runtime, it throws an error explaining that the Vite plugin is not configured.

Genuine Zustand bound stores support all modes. A custom React hook that merely mimics a bound-store call signature may be cast to `UseZustandStore<TState>` for root destructuring only:

```ts
import { autoSubscribe, type UseZustandStore } from 'better-zustand';

const { count } = autoSubscribe(
  useContextStore as UseZustandStore<ContextStoreState>,
);
```

Selector and custom-comparer modes pass the first argument to `useStoreWithEqualityFn`, so they require real `StoreApi` methods such as `getState` and `subscribe`; a TypeScript cast does not add those methods at runtime. Object aliases and default values are supported, while rest properties are ignored.

## Name stores in Redux DevTools

```ts
import { create } from 'zustand';
import { reduxDevtools } from 'better-zustand';

const useCounterStore = create<CounterState>()(
  reduxDevtools((set) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
  })),
);
```

The plugin wraps the state creator with Zustand's `devtools` middleware and derives `CounterStore` from the variable name. Pass a second argument such as `reduxDevtools(creator, 'Sidebar')` to produce `[Sidebar] CounterStore`.

## Name actions

Inside a store action, wrap a `set` call with `logAction`:

```ts
import { logAction } from 'better-zustand';

const useCounterStore = create<CounterState>()(
  reduxDevtools((set) => ({
    count: 0,
    increment: () => logAction(set({ count: 1 })),
    reset: () => logAction(set({ count: 0 }), 'confirmed'),
  })),
);
```

The transform adds the inferred names `increment` and `reset/confirmed` to Zustand's `set` calls.

## Equality helper

```ts
import { jsonEqual } from 'better-zustand';

jsonEqual({ values: [1, 2] }, { values: [1, 2] }); // true
```

`jsonEqual` compares JSON serialization. It is intended only for JSON-compatible values where key order is stable.

## Development and publishing

```sh
npm install
npm run verify
npm pack --dry-run
```

Review the tarball file list, authenticate with npm, confirm that the unscoped package name is available to your account, then publish manually:

```sh
npm publish
```

The `prepack` hook repeats type checking, tests, the production build, and package-entry smoke tests before npm creates a tarball.
