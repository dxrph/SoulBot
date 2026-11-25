const test = require('node:test');
const assert = require('node:assert/strict');
const { roles } = require('../src/template');
const { freeRanks, verifiedRanks } = require('../src/ranks');
const { planRolePositions, roleColors } = require('../src/roleSetup');
const { planPanelRefresh } = require('../src/panelRefresh');
const {
  isLegacyTitle, PANEL_TITLE, formatRoleChange, slugHero, rolesPanelPayload, REGION_GONE,
} = require('../src/features/roles');

const regionRoles = roles.filter((r) => r.group === 'region');
const interestRoles = roles.filter((r) => r.group === 'interest');

test('i ruoli regione restano nel template ma non vengono offerti', () => {
  assert.deepEqual(regionRoles.map((r) => r.key), ['eu', 'na', 'asia']);
  assert.deepEqual(regionRoles.map((r) => r.name), ['EU · West Blue', 'NA · East Blue', 'Asia · Grand Line']);
  const payload = rolesPanelPayload({ emojis: { cache: { find: () => null } } });
  const text = JSON.stringify(payload);
  assert.equal(text.includes('profile:region'), false);
  assert.equal(text.includes('EU · West Blue'), false);
  assert.equal(text.includes('Regione'), false);
  assert.ok(text.includes('profile:rank'));
  assert.ok(text.includes('profile:heroes'));
  assert.ok(text.includes('profile:ping'));
  assert.ok(text.includes('profile:interest'));
  assert.ok(text.includes('profile:me'));
  assert.ok(text.includes('profile:reset'));
});

test('il pannello rispetta i limiti Discord e usa la palette', () => {
  const payload = rolesPanelPayload({ emojis: { cache: { find: () => null } } });
  assert.equal(payload.embeds[0].data.title, PANEL_TITLE);
  assert.equal(payload.embeds[0].data.color, 0x7C4DFF);
  assert.ok(payload.components.length <= 5);
  for (const row of payload.components) {
    assert.ok(row.components.length <= 5);
  }
  const buttons = payload.components.flatMap((r) => r.components);
  assert.ok(buttons.every((b) => (b.data.label || '').length <= 80));
  assert.ok(payload.embeds[0].data.description.includes('Soulside'));
  assert.ok(payload.embeds[0].data.fields.some((f) => f.name.includes('Rank')));
  assert.ok(payload.embeds[0].data.fields.some((f) => f.name.includes('Eroi')));
  assert.ok(payload.embeds[0].data.fields.some((f) => f.name.includes('Notifiche')));
  assert.ok(payload.embeds[0].data.fields.some((f) => f.name.includes('Interessi')));
});

test('titoli vecchi del pannello ruoli sono riconosciuti come legacy', () => {
  assert.equal(isLegacyTitle('Scegli il tuo percorso'), true);
  assert.equal(isLegacyTitle('🎭 CHOOSE YOUR PATH'), true);
  assert.equal(isLegacyTitle(PANEL_TITLE), false);
});

test('formatRoleChange spiega cosa è stato aggiunto o tolto', () => {
  assert.match(formatRoleChange([], []), /Nessun cambiamento/);
  assert.equal(formatRoleChange([{ name: 'Ritualist' }], []), '**Aggiunto** · Ritualist');
  assert.equal(formatRoleChange([], [{ name: 'Seeker' }]), '**Tolto** · Seeker');
  assert.equal(
    formatRoleChange([{ name: 'Scouter' }], [{ name: 'Hunters' }]),
    '**Aggiunto** · Scouter\n**Tolto** · Hunters',
  );
});

test('slugHero allinea i nomi alle emoji hero_ del server', () => {
  assert.equal(slugHero('Haze'), 'haze');
  assert.equal(slugHero('Grey Talon'), 'grey_talon');
  assert.equal(slugHero('Mo & Krill'), 'mo_and_krill');
  assert.equal(slugHero('The Doorman'), 'the_doorman');
  assert.equal(slugHero('Lady Geist'), 'lady_geist');
});

test('i ruoli interesse sono nel template, i rank verificati restano fuori dal self-serve', () => {
  assert.equal(interestRoles.length, 10);
  assert.ok(interestRoles.every((r) => r.group === 'interest' && !r.hoist));
  assert.ok(verifiedRanks.every((r) => r.verify));
  assert.equal(freeRanks.some((r) => r.verify), false);
  assert.ok(REGION_GONE.includes('regione') || REGION_GONE.includes('server di gioco'));
});

test('roleColors usa primaryColor al posto di color deprecato', () => {
  assert.deepEqual(roleColors(0x7C4DFF), { colors: { primaryColor: 0x7C4DFF } });
});

test('planRolePositions mette i ruoli nuovi sotto il bot, senza ricrearli', () => {
  const byKey = {
    owner: { id: '1', managed: false, position: 20 }, // above the bot: skipped
    player: { id: '2', managed: false, position: 5 },
    lvl_genin: { id: '3', managed: false, position: 1 },
    lvl_kage: { id: '4', managed: false, position: 1 },
    domain: { id: '5', managed: false, position: 1 },
  };
  const planned = planRolePositions(
    ['owner', 'player', 'lvl_genin', 'lvl_kage', 'domain'],
    byKey,
    12, // bot
  );
  assert.deepEqual(planned, [
    { role: '2', position: 11 },
    { role: '3', position: 10 },
    { role: '4', position: 9 },
    { role: '5', position: 8 },
  ]);
});

test('/refresh-panels modifica il messaggio vecchio e non lo duplica', () => {
  const titleOf = (p) => p.title;
  const payloads = [{ title: PANEL_TITLE }];
  const plan = planPanelRefresh(
    [{ id: 'old', title: 'Scegli il tuo percorso', createdTimestamp: 1 }],
    payloads,
    isLegacyTitle,
    titleOf,
  );
  assert.deepEqual(plan.edits, [{ id: 'old', payloadIndex: 0 }]);
  assert.deepEqual(plan.sends, []);
  assert.deepEqual(plan.leftovers, []);

  const already = planPanelRefresh(
    [{ id: 'cur', title: PANEL_TITLE, createdTimestamp: 2 }],
    payloads,
    isLegacyTitle,
    titleOf,
  );
  assert.deepEqual(already.edits, [{ id: 'cur', payloadIndex: 0 }]);
  assert.deepEqual(already.sends, []);

  const missing = planPanelRefresh([], payloads, isLegacyTitle, titleOf);
  assert.deepEqual(missing.edits, []);
  assert.deepEqual(missing.sends, [0]);
});
