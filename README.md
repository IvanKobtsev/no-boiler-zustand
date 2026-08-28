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

const { count, increment } = autoSubscribe(useCounterStore());
```

At build time this becomes one selector subscription per field:

```ts
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);
```

The marker is a runtime no-op, so the Vite plugin must be enabled. Object aliases and default values are supported; rest properties are ignored.

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
