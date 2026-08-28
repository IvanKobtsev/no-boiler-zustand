import { expectTypeOf, it } from 'vitest';
import { autoSubscribe, type UseZustandStore } from '../src/index.js';

type State = {
  count: number;
  testCase: { id: string; title: string };
};

function assertAutoSubscribeTypes(store: UseZustandStore<State>) {
  const state = autoSubscribe(store);
  const testCase = autoSubscribe(store, (value) => value.testCase);
  const compared = autoSubscribe(
    store,
    (value) => value.testCase,
    (a, b) => a.id === b.id,
  );

  expectTypeOf(state).toEqualTypeOf<State>();
  expectTypeOf(testCase).toEqualTypeOf<State['testCase']>();
  expectTypeOf(compared).toEqualTypeOf<State['testCase']>();
}

it('exports the autoSubscribe overload types without running the marker', () => {
  expectTypeOf(assertAutoSubscribeTypes).toBeFunction();
});
