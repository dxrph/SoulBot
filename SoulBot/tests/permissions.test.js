const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { EVERYONE_PERMS, ensureEveryoneCanStream } = require('../src/permissions');

test('EVERYONE_PERMS includes Stream', () => {
  assert.ok(EVERYONE_PERMS.includes(PermissionFlagsBits.Stream));
});

test('ensureEveryoneCanStream adds only Stream when missing', async () => {
  const calls = [];
  const everyone = {
    permissions: new PermissionsBitField([PermissionFlagsBits.ViewChannel]),
    setPermissions: async (p) => calls.push(new PermissionsBitField(p)),
  };
  assert.equal(await ensureEveryoneCanStream({ roles: { everyone } }), true);
  assert.deepEqual(calls[0].toArray().sort(), ['Stream', 'ViewChannel']);
});

test('ensureEveryoneCanStream does nothing when already allowed', async () => {
  const everyone = {
    permissions: new PermissionsBitField([PermissionFlagsBits.Stream]),
    setPermissions: async () => assert.fail('must not be called'),
  };
  assert.equal(await ensureEveryoneCanStream({ roles: { everyone } }), false);
});
