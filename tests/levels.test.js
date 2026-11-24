const test = require('node:test');
const assert = require('node:assert');
const { levelOf, xpForNext, rewardFor } = require('../src/levels');
const { REWARDS } = require('../src/features/levels');

test('level curve', () => {
  assert.deepStrictEqual(levelOf(0), { level: 0, into: 0, need: 100 });
  assert.strictEqual(levelOf(99).level, 0);
  assert.strictEqual(levelOf(100).level, 1);
  assert.strictEqual(xpForNext(1), 155);
  assert.strictEqual(levelOf(255).level, 2);
});

test('reward roles: highest reached', () => {
  assert.strictEqual(rewardFor(REWARDS, 4), null);
  assert.strictEqual(rewardFor(REWARDS, 5).name, 'Genin');
  assert.strictEqual(rewardFor(REWARDS, 29).name, 'Jonin');
  assert.strictEqual(rewardFor(REWARDS, 99).name, 'Kage');
});
