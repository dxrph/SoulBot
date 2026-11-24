// Levels and XP without a database.
// State lives in memory and is saved every few minutes as levels.json attached to a pinned message
// in 💾┃dati-bot. Railway wipes the disk at every deploy, a Discord message survives it.
const { AttachmentBuilder, ChannelType, MessageFlags } = require('discord.js');
const { roles: roleDefs, settings } = require('../template');
const { channelByKey, roleMap } = require('../util');
const { guildSlash } = require('../slash');
const { palette, withFooter, baseEmbed } = require('../style');
const { levelOf, bar, rewardFor } = require('../levels');

const CFG = settings.levels;
const REWARDS = roleDefs.filter((r) => r.level);
const FILE = 'levels.json';
const MARK = 'SoulBot · livelli'; // message content that identifies the save message

// guildId -> { loaded, xp: Map<userId, number>, dirty, messageId }
const state = new Map();
const cooldown = new Map(); // `${guildId}:${userId}` -> last message XP time
const g = (guildId) => {
  if (!state.has(guildId)) state.set(guildId, { loaded: false, xp: new Map(), dirty: false, messageId: null });
  return state.get(guildId);
};

const commands = [
  guildSlash('rank', 'Il tuo livello (o quello di un altro membro)')
    .addUserOption((o) => o.setName('utente').setDescription('Di chi vuoi vedere il livello')),
  guildSlash('classifica', 'I 10 membri con più XP'),
].map((c) => c.toJSON());

// ---- persistence ------------------------------------------------------------------------------
async function findSave(ch) {
  const me = ch.client.user.id;
  const isSave = (m) => m.author.id === me && m.content.startsWith(MARK) && m.attachments.some((a) => a.name === FILE);
  const pins = await ch.messages.fetchPins().catch(() => null);
  const pinned = pins?.items.map((p) => p.message).find(isSave);
  if (pinned) return pinned;
  const recent = await ch.messages.fetch({ limit: 100 }).catch(() => null);
  return [...(recent?.values() ?? [])].find(isSave) ?? null;
}

// Loads the saved XP. On a network error it stays "not loaded" and never saves, so a hiccup can't wipe the data.
async function load(guild) {
  const s = g(guild.id);
  if (s.loaded) return true;
  const ch = channelByKey(guild, 'botdata');
  if (!ch) return false; // no channel yet: /add-tools creates 💾┃dati-bot
  const msg = await findSave(ch);
  if (msg) {
    const url = msg.attachments.find((a) => a.name === FILE).url;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data || typeof data.xp !== 'object') return false;
    // XP earned before the load finished is added on top
    for (const [id, xp] of Object.entries(data.xp)) s.xp.set(id, (s.xp.get(id) ?? 0) + Number(xp || 0));
    s.messageId = msg.id;
  }
  s.loaded = true;
  return true;
}

async function save(guild) {
  const s = g(guild.id);
  if (!s.loaded || !s.dirty) return;
  const ch = channelByKey(guild, 'botdata');
  if (!ch) return;
  const body = JSON.stringify({ v: 1, savedAt: new Date().toISOString(), xp: Object.fromEntries(s.xp) });
  const file = new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: FILE });
  const content = `${MARK} · ${s.xp.size} membri · non cancellare questo messaggio`;
  s.dirty = false;
  try {
    const old = s.messageId && await ch.messages.fetch(s.messageId).catch(() => null);
    if (old) {
      await old.edit({ content, files: [file], attachments: [] });
    } else {
      const msg = await ch.send({ content, files: [file] });
      s.messageId = msg.id;
      await msg.pin().catch(() => {});
    }
  } catch (err) {
    s.dirty = true;
    console.error('levels save', err.message);
  }
}

// ---- XP and rewards ---------------------------------------------------------------------------
async function addXp(member, amount, announceIn) {
  const s = g(member.guild.id);
  const before = levelOf(s.xp.get(member.id) ?? 0).level;
  const total = (s.xp.get(member.id) ?? 0) + amount;
  s.xp.set(member.id, total);
  s.dirty = true;
  const after = levelOf(total).level;
  if (after > before) await levelUp(member, after, announceIn);
}

async function syncReward(member, level) {
  const R = roleMap(member.guild);
  const target = rewardFor(REWARDS, level);
  for (const def of REWARDS) {
    const role = R[def.key];
    if (!role) continue;
    const want = target?.key === def.key;
    const has = member.roles.cache.has(role.id);
    if (want && !has) await member.roles.add(role, `Livello ${level}`).catch(() => {});
    if (!want && has) await member.roles.remove(role, `Livello ${level}`).catch(() => {});
  }
  return target ? R[target.key] : null;
}

const levelUpLines = [
  '{u} è salito al **livello {l}**. La tua energia maledetta cresce.',
  '{u} ora è **livello {l}**. Gojo approva (forse).',
  '{u} ha raggiunto il **livello {l}**. Credi in te, come Onyzuka crede nell\'Eternus.',
];

async function levelUp(member, level, announceIn) {
  const role = await syncReward(member, level);
  const ch = member.guild.channels.cache.find((c) => c.name === '🤖┃comandi-bot') ?? announceIn;
  if (!ch?.isTextBased()) return;
  const line = levelUpLines[level % levelUpLines.length].replace('{u}', `<@${member.id}>`).replace('{l}', level);
  const reward = role && rewardFor(REWARDS, level)?.level === level ? `\nNuovo grado: **${role.name}** 🎖️` : '';
  await ch.send({ content: `${line}${reward}`, allowedMentions: { users: [member.id] } }).catch(() => {});
}

async function onMessage(m) {
  if (!CFG.enabled || !m.guild || m.author.bot || !m.member || m.content.length < 3) return;
  if (m.channel.type !== ChannelType.GuildText && !m.channel.isThread?.()) return;
  const key = `${m.guildId}:${m.author.id}`;
  const now = Date.now();
  if (now - (cooldown.get(key) ?? 0) < CFG.messageCooldownSec * 1000) return;
  cooldown.set(key, now);
  const [min, max] = CFG.messageXp;
  await addXp(m.member, min + Math.floor(Math.random() * (max - min + 1)), m.channel);
}

async function voiceTick(client) {
  for (const guild of client.guilds.cache.values()) {
    const afk = guild.afkChannelId;
    for (const ch of guild.channels.cache.values()) {
      if (ch.type !== ChannelType.GuildVoice || ch.id === afk || ch.name === '🌙 AFK') continue;
      const humans = ch.members.filter((m) => !m.user.bot);
      if (humans.size < 2) continue; // farming alone does not count
      for (const m of humans.values()) {
        const v = m.voice;
        if (v.selfDeaf || v.serverDeaf || v.selfMute || v.serverMute) continue;
        await addXp(m, CFG.voiceXpPerMinute, null);
      }
    }
  }
}

// ---- commands ---------------------------------------------------------------------------------
async function rankCmd(i) {
  const user = i.options.getUser('utente') ?? i.user;
  if (user.bot) return i.reply({ content: 'I bot non hanno energia maledetta.', flags: MessageFlags.Ephemeral });
  const s = g(i.guildId);
  const total = s.xp.get(user.id) ?? 0;
  const { level, into, need } = levelOf(total);
  const sorted = [...s.xp.entries()].sort((a, b) => b[1] - a[1]);
  const pos = sorted.findIndex(([id]) => id === user.id) + 1;
  const reward = rewardFor(REWARDS, level);
  const next = REWARDS.filter((d) => d.level > level).sort((a, b) => a.level - b.level)[0];
  return i.reply({
    embeds: [withFooter(baseEmbed(palette.accent)
      .setAuthor({ name: user.displayName ?? user.username, iconURL: user.displayAvatarURL() })
      .setTitle(`Livello ${level}${reward ? ` · ${reward.name}` : ''}`)
      .setDescription(`${bar(into, need)} ${into}/${need} XP\nXP totali: **${total}**${pos ? ` · Posizione **#${pos}**` : ''}` +
        `${next ? `\nProssimo grado: **${next.name}** al livello ${next.level}` : ''}` +
        `${s.loaded ? '' : '\n*(dati in caricamento: riprova tra un minuto)*'}`))],
  });
}

async function topCmd(i) {
  const s = g(i.guildId);
  const top = [...s.xp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!top.length) return i.reply({ content: 'Ancora nessuno in classifica. Scrivete, entrate in vocale, fate qualcosa!', flags: MessageFlags.Ephemeral });
  const medal = ['🥇', '🥈', '🥉'];
  return i.reply({
    embeds: [withFooter(baseEmbed(palette.primary)
      .setTitle('🏆 Classifica di Soulside')
      .setDescription(top.map(([id, xp], n) => `${medal[n] ?? `**${n + 1}.**`} <@${id}> · livello ${levelOf(xp).level} · ${xp} XP`).join('\n')))],
    allowedMentions: { parse: [] },
  });
}

async function onInteraction(i) {
  if (!i.isChatInputCommand() || !['rank', 'classifica'].includes(i.commandName)) return;
  try {
    if (!CFG.enabled) return await i.reply({ content: 'I livelli sono spenti per ora.', flags: MessageFlags.Ephemeral });
    if (i.commandName === 'rank') return await rankCmd(i);
    return await topCmd(i);
  } catch (err) {
    console.error(err);
  }
}

function onReady(client) {
  if (!CFG.enabled) return;
  const loadAll = async () => {
    for (const guild of client.guilds.cache.values()) await load(guild).catch((e) => console.error('levels load', e.message));
  };
  const saveAll = async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!g(guild.id).loaded) await load(guild).catch(() => {});
      await save(guild);
    }
  };
  loadAll();
  setInterval(() => voiceTick(client).catch(console.error), 60_000).unref();
  setInterval(() => saveAll().catch(console.error), CFG.saveEveryMinutes * 60_000).unref();
  // Railway sends SIGTERM before a redeploy: save what we have, then exit
  process.once('SIGTERM', () => {
    const done = () => process.exit(0);
    setTimeout(done, 8_000).unref();
    saveAll().catch(() => {}).finally(done);
  });
}

module.exports = {
  onMessage, onInteraction, onReady, commands, REWARDS,
};
