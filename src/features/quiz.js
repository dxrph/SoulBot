// Anime quiz: now and then (random gap between settings.quiz.minGapMinutes and maxGapMinutes, only when
// the chat is alive and outside quiet hours) the bot asks a question in 💬┃generale. First right answer
// gets XP. Answers ignore case, accents and punctuation. Unanswered questions expire after answerSeconds.
const { ChannelType } = require('discord.js');
const { settings } = require('../template');
const { palette, withFooter, baseEmbed } = require('../style');
const { grantXp } = require('./levels');
const QUESTIONS = require('../data/quiz');

const CFG = settings.quiz;
const state = new Map(); // guildId -> { next, active: { item, channelId, ends, timer } | null, recent: [ts], used: [idx] }

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const isRight = (item, text) => item.a.some((ans) => norm(ans) === norm(text));

const gap = () => (CFG.minGapMinutes + Math.random() * Math.max(0, CFG.maxGapMinutes - CFG.minGapMinutes)) * 60_000;
const s = (guildId) => {
  if (!state.has(guildId)) state.set(guildId, { next: Date.now() + gap(), active: null, recent: [], used: [] });
  return state.get(guildId);
};

function brusselsHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', hourCycle: 'h23', hour: '2-digit' }).format(now));
}
const quiet = (h, [from, to] = CFG.quietHours) => (from <= to ? h >= from && h < to : h >= from || h < to);

// Random question not asked recently
function pick(st) {
  const free = QUESTIONS.map((_, n) => n).filter((n) => !st.used.includes(n));
  const idx = free[Math.floor(Math.random() * free.length)] ?? 0;
  st.used.push(idx);
  if (st.used.length > Math.floor(QUESTIONS.length / 2)) st.used.shift();
  return QUESTIONS[idx];
}

const quizChannel = (guild) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CFG.channelName) ?? null;

async function ask(guild) {
  const st = s(guild.id);
  const ch = quizChannel(guild);
  if (!ch) return;
  const item = pick(st);
  st.next = Date.now() + gap();
  await ch.send({
    embeds: [withFooter(baseEmbed(palette.accent).setTitle('🧠 Quiz anime')
      .setDescription(`**${item.q}**\nIl primo che scrive la risposta giusta qui in chat prende **${CFG.xp} XP**. Avete ${CFG.answerSeconds} secondi.`), 'Quiz')],
  });
  st.active = {
    item,
    channelId: ch.id,
    timer: setTimeout(() => {
      if (st.active?.item !== item) return;
      st.active = null;
      ch.send({ content: `⏰ Tempo scaduto! La risposta era **${item.a[0]}**. Nessuno ci è arrivato: Gojo è deluso.` }).catch(() => {});
    }, CFG.answerSeconds * 1000),
  };
}

async function onMessage(m) {
  if (!CFG.enabled || !m.guild || m.author.bot) return;
  const st = s(m.guildId);
  if (m.channel.name !== CFG.channelName) return;
  const now = Date.now();
  st.recent = st.recent.filter((t) => now - t < 15 * 60_000);
  st.recent.push(now);
  if (st.active && st.active.channelId === m.channelId && isRight(st.active.item, m.content)) {
    const { item } = st.active;
    clearTimeout(st.active.timer);
    st.active = null;
    await m.reply({ content: `✅ Esatto, <@${m.author.id}>! **${item.a[0]}**. +${CFG.xp} XP`, allowedMentions: { users: [m.author.id] } }).catch(() => {});
    await grantXp(m.member, CFG.xp, m.channel);
  }
}

async function tick(client) {
  if (!CFG.enabled) return;
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    const st = s(guild.id);
    if (st.active || now < st.next || quiet(brusselsHour())) continue;
    if (st.recent.filter((t) => now - t < 15 * 60_000).length < CFG.minRecentMessages) continue; // dead chat: wait
    await ask(guild).catch(console.error);
  }
}

function onReady(client) {
  if (!CFG.enabled) return;
  setInterval(() => tick(client).catch(console.error), 60_000).unref();
}

module.exports = {
  onMessage, onReady, isRight, norm, quiet,
};
