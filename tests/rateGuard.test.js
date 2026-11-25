const test = require('node:test');
const assert = require('node:assert');
const { rateGuard } = require('../src/rateGuard');

test('rateGuard: 2 renames every 10 minutes per channel', () => {
  const g = rateGuard(2, 600_000);
  const t0 = 1_000_000;
  assert.strictEqual(g.wait('a', t0), 0);
  g.hit('a', t0);
  g.hit('a', t0 + 1000);
  assert.strictEqual(g.wait('a', t0 + 2000), 598_000);
  assert.strictEqual(g.wait('b', t0 + 2000), 0);
  assert.strictEqual(g.wait('a', t0 + 600_001), 0);
});
