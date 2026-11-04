const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeRequest, decodeRequest, checkRequest } = require('../src/rankRequest');

test('encode/decode round trip', () => {
  assert.deepEqual(decodeRequest(encodeRequest('123', 'oracle')), { userId: '123', rankKey: 'oracle' });
});

test('decode rejects garbage', () => {
  assert.equal(decodeRequest('nope'), null);
  assert.equal(decodeRequest(undefined), null);
});

const base = { rankKey: 'archon', contentType: 'image/png', alreadyHasRank: false, pendingExists: false };

test('valid request passes', () => assert.deepEqual(checkRequest(base), { ok: true }));
test('free rank is refused', () => assert.equal(checkRequest({ ...base, rankKey: 'seeker' }).ok, false));
test('non-image is refused', () => assert.equal(checkRequest({ ...base, contentType: 'application/pdf' }).ok, false));
test('missing content type is refused', () => assert.equal(checkRequest({ ...base, contentType: undefined }).ok, false));
test('already held is refused', () => assert.equal(checkRequest({ ...base, alreadyHasRank: true }).ok, false));
test('pending request is refused', () => assert.equal(checkRequest({ ...base, pendingExists: true }).ok, false));
test('every refusal explains why', () => {
  const out = checkRequest({ ...base, pendingExists: true });
  assert.match(out.reason, /pending/i);
});
