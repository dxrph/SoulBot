const test = require('node:test');
const assert = require('node:assert/strict');
const { freeRanks, verifiedRanks, rankByKey } = require('../src/ranks');
const { ranks } = require('../src/lfgParse');

test('official ladder order is Initiate..Eternus', () => {
  assert.deepEqual(ranks.map((r) => r.key), [
    'eternus', 'ascendant', 'phantom', 'oracle', 'emissary',
    'ritualist', 'mystic', 'sentinel', 'acolyte', 'seeker', 'initiate',
  ]);
});

test('free ranks are Initiate..Ritualist', () => {
  assert.deepEqual(freeRanks.map((r) => r.key).sort(),
    ['acolyte', 'initiate', 'mystic', 'ritualist', 'seeker', 'sentinel']);
});

test('verified ranks are Emissary and above', () => {
  assert.deepEqual(verifiedRanks.map((r) => r.key).sort(),
    ['ascendant', 'emissary', 'eternus', 'oracle', 'phantom']);
});

test('legacy names rename in place without colliding with Oracle', () => {
  const byKey = Object.fromEntries(ranks.map((r) => [r.key, r]));
  assert.ok(byKey.acolyte.old.includes('Alchemist'));
  assert.ok(byKey.sentinel.old.includes('Arcanist'));
  assert.ok(byKey.mystic.old.includes('Archon'));
  assert.ok(!byKey.oracle.old.includes('Archon'));
  assert.equal(byKey.oracle.verify, true);
  assert.equal(byKey.mystic.verify, undefined);
});

test('rankByKey returns undefined for non-ranks', () => {
  assert.equal(rankByKey('eu'), undefined);
});
