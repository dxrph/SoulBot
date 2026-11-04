const test = require('node:test');
const assert = require('node:assert/strict');
const { freeRanks, verifiedRanks, rankByKey } = require('../src/ranks');

test('free ranks are Initiate..Ritualist', () => {
  assert.deepEqual(freeRanks.map((r) => r.key).sort(),
    ['alchemist', 'arcanist', 'initiate', 'ritualist', 'seeker']);
});

test('verified ranks are Emissary and above', () => {
  assert.deepEqual(verifiedRanks.map((r) => r.key).sort(),
    ['archon', 'ascendant', 'emissary', 'eternus', 'oracle', 'phantom']);
});

test('rankByKey returns undefined for non-ranks', () => {
  assert.equal(rankByKey('eu'), undefined);
});
