const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRequest } = require('../src/lfgParse');

test('english need N still works', () => {
  const r = parseRequest('ranked archon need 2, evenings EU', 'initiate', 'lfg');
  assert.equal(r.mode, 'ranked');
  assert.equal(r.rank, 'archon');
  assert.equal(r.size, 3);
});

test('italian cerco N', () => {
  const r = parseRequest('cerco 2 ranked archon, sere EU', null, 'lfg');
  assert.equal(r.mode, 'ranked');
  assert.equal(r.rank, 'archon');
  assert.equal(r.size, 3);
});

test('italian mancano N', () => {
  const r = parseRequest('mancano 2 casual haze', 'seeker', 'lfg_casual');
  assert.equal(r.mode, 'casual');
  assert.equal(r.size, 3);
});

test('duo keyword', () => {
  assert.equal(parseRequest('casual duo chill', null, 'lfg').size, 2);
});

test('channel default ranked', () => {
  const r = parseRequest('cerco party', 'ritualist', 'lfg_ranked');
  assert.equal(r.mode, 'ranked');
  assert.equal(r.rank, 'ritualist');
});
