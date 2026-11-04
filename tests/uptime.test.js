const test = require('node:test');
const assert = require('node:assert/strict');
const { parseUptime } = require('../src/uptime');

test('offline is null', () => assert.equal(parseUptime('onyzuk4 is offline'), null));
test('empty is null', () => assert.equal(parseUptime(''), null));
test('hours, minutes, seconds', () => assert.equal(parseUptime('1 hour, 4 minutes, 12 seconds'), 3852));
test('single unit', () => assert.equal(parseUptime('45 seconds'), 45));
test('days count', () => assert.equal(parseUptime('1 day, 2 hours'), 93600));
