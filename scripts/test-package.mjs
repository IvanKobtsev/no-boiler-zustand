import assert from 'node:assert/strict';
const root = await import('../dist/index.js');
const vite = await import('../dist/vite.js');

assert.equal(typeof root.autoSubscribe, 'function');
assert.equal(typeof root.logAction, 'function');
assert.equal(typeof root.reduxDevtools, 'function');
assert.equal(typeof root.jsonEqual, 'function');
assert.equal(typeof vite.zustandAutoSubscribePlugin, 'function');
assert.equal(typeof vite.zustandLogActionPlugin, 'function');
assert.equal(typeof vite.zustandDevtoolsPlugin, 'function');
