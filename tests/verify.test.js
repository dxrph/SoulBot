const test = require('node:test');
const assert = require('node:assert');
const { newCode } = require('../src/features/verify');

test('captcha code: 5 readable characters', () => {
  for (let n = 0; n < 200; n += 1) {
    const code = newCode();
    assert.strictEqual(code.length, 5);
    assert.match(code, /^[A-HJKMNP-Z2-9]+$/);
  }
});
