const test = require('node:test');
const assert = require('node:assert');
const { label } = require('../src/features/stats');

const def = (stat, name) => ({ stat, name });

test('stats labels', () => {
  assert.strictEqual(label(def('members', '👥 Membri'), { members: 37 }), '👥 Membri: 37');
  assert.strictEqual(label(def('followers', '💜 Follower'), { follows: 2 }), '💜 Follower: 2');
  assert.strictEqual(label(def('followers', '💜 Follower'), { follows: null }), null);
  assert.strictEqual(label(def('affiliate', '🎯 Affiliate'), { follows: 12 }), '🎯 Affiliate: 12/50');
  assert.strictEqual(label(def('affiliate', '🎯 Affiliate'), { follows: 64 }), '🎯 Affiliate: ✅ 50/50');
});
