const test = require('node:test');
const assert = require('node:assert');
const { parseWhen } = require('../src/when');

// 25/11/2026 00:30 in Brussels (UTC+1) = 24/11 23:30 UTC
const now = new Date(Date.UTC(2026, 10, 24, 23, 30));

test('parseWhen: time today/tomorrow in Brussels', () => {
  assert.strictEqual(parseWhen('21:30', now).toISOString(), '2026-11-25T20:30:00.000Z');
  assert.strictEqual(parseWhen('00:10', now).toISOString(), '2026-11-25T23:10:00.000Z'); // already past -> tomorrow
  assert.strictEqual(parseWhen('domani 21:30', now).toISOString(), '2026-11-26T20:30:00.000Z');
});

test('parseWhen: explicit dates and summer time', () => {
  assert.strictEqual(parseWhen('27/11 21:30', now).toISOString(), '2026-11-27T20:30:00.000Z');
  assert.strictEqual(parseWhen('01/07/2027 20:00', now).toISOString(), '2027-07-01T18:00:00.000Z');
  assert.strictEqual(parseWhen('01/01 10:00', now).toISOString(), '2027-01-01T09:00:00.000Z');
  assert.strictEqual(parseWhen('boh', now), null);
  assert.strictEqual(parseWhen('25:00', now), null);
});
