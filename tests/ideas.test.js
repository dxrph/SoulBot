const test = require('node:test');
const assert = require('node:assert');
const { tally } = require('../src/features/predictions');
const { shouldHave } = require('../src/features/liveroom');
const { pickThread } = require('../src/features/build');
const { challengeFor, brussels } = require('../src/features/challenge');
const { isRight, quiet } = require('../src/features/quiz');
const { due } = require('../src/features/reminders');
const { highlightEmbed } = require('../src/features/clips');
const QUIZ = require('../src/data/quiz');
const CHALLENGES = require('../src/data/challenges');

test('predizione: conteggio voti', () => {
  const votes = new Map([['a', 'win'], ['b', 'lose'], ['c', 'win']]);
  assert.deepStrictEqual(tally({ votes }), { win: 2, lose: 1 });
});

test('Dominio Espanso: solo in live, nella stanza, non bot', () => {
  assert.strictEqual(shouldHave(true, true, false), true);
  assert.strictEqual(shouldHave(false, true, false), false);
  assert.strictEqual(shouldHave(true, false, false), false);
  assert.strictEqual(shouldHave(true, true, true), false);
});

test('/build: trova il post giusto', () => {
  const names = ['📌 Read me first', 'Grey Talon', 'Haze', 'Lady Geist', 'Mo & Krill'];
  assert.strictEqual(pickThread(names, 'haze'), 'Haze');
  assert.strictEqual(pickThread(names, 'grey'), 'Grey Talon');
  assert.strictEqual(pickThread(names, 'geist'), 'Lady Geist');
  assert.strictEqual(pickThread(names, 'mo krill'), 'Mo & Krill');
  assert.strictEqual(pickThread(names, 'zzz'), null);
});

test('sfida del giorno: stabile per data, ora di Bruxelles', () => {
  assert.strictEqual(challengeFor('2026-11-25'), challengeFor('2026-11-25'));
  assert.notStrictEqual(challengeFor('2026-11-25'), challengeFor('2026-11-26'));
  assert.ok(CHALLENGES.includes(challengeFor('2030-01-01')));
  // 24/11 23:30 UTC = 25/11 00:30 a Bruxelles
  assert.deepStrictEqual(brussels(new Date(Date.UTC(2026, 10, 24, 23, 30))), { date: '2026-11-25', hour: 0, dm: '25/11' });
});

test('quiz: risposte tolleranti e ore di silenzio', () => {
  const item = { q: '?', a: ['Super Saiyan', 'Jaeger'] };
  assert.ok(isRight(item, 'super saiyan!'));
  assert.ok(isRight(item, 'SUPER   SAIYAN'));
  assert.ok(isRight({ a: ['Jäger'] }, 'jager'));
  assert.ok(!isRight(item, 'saiyan'));
  assert.ok(quiet(3, [1, 11]) && !quiet(12, [1, 11]) && quiet(23, [22, 8]) && quiet(5, [22, 8]));
  for (const x of QUIZ) assert.ok(x.q && x.a.length, 'ogni domanda ha almeno una risposta');
});

test('promemoria: finestra dei 10 minuti senza doppioni', () => {
  const now = 0;
  assert.ok(due(10 * 60_000, now, 10));
  assert.ok(due(9 * 60_000, now, 10));
  assert.ok(!due(11 * 60_000, now, 10));
  assert.ok(!due(7 * 60_000, now, 10));
  assert.ok(!due(-1, now, 10));
});

test('highlight clip: embed curato con settimana nel footer', () => {
  const winner = {
    content: 'che giocata https://clips.twitch.tv/abc', url: 'https://discord.com/channels/1/2/3', createdAt: new Date(0),
    author: { id: '9', username: 'u', displayAvatarURL: () => 'https://cdn.discordapp.com/a.png' }, member: { displayName: 'Uzumaki' },
    attachments: { find: () => undefined },
  };
  const e = highlightEmbed(winner, 7, '2026-W48').toJSON();
  assert.match(e.footer.text, /Clip 2026-W48/);
  assert.match(e.description, /\*\*7\*\* voti/);
  assert.match(e.description, /clips\.twitch\.tv/);
});
