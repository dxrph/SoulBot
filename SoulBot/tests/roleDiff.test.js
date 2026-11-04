const test = require('node:test');
const assert = require('node:assert/strict');
const { diffRoles } = require('../src/roleDiff');

const r = (id) => ({ id });

test('removes unselected held roles and adds new ones', () => {
  const [a, b, c] = [r('a'), r('b'), r('c')];
  const held = new Set(['a']);
  const { add, remove } = diffRoles([a, b, c], [b], (x) => held.has(x.id));
  assert.deepEqual(add, [b]);
  assert.deepEqual(remove, [a]);
});

test('no change when selection equals what is held', () => {
  const a = r('a');
  assert.deepEqual(diffRoles([a], [a], () => true), { add: [], remove: [] });
});
