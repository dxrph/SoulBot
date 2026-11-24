const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits: V } = require('discord.js');
const { isStaff, logEvent } = require('../util');
const { palette } = require('../style');
const liveState = require('../liveState');

// Anti-spam: unchanged
const SPAM_WINDOW = 6_000;
const SPAM_LIMIT = 6;
const DUP_LIMIT = 4;
const MENTION_LIMIT = 6;
const TIMEOUT_MS = 10 * 60_000;

// Anti-raid: higher threshold, no auto-kick. During a live, even more permissive.
const RAID_JOINS = 12;
const RAID_JOINS_LIVE = 20;
const RAID_WINDOW = 30_000;
const LOCKDOWN_MS = 5 * 60_000;

const history = new Map();
const raid = new Map(); // guildId -> { joins: [{t, member}], until }

function raidState(guildId) {
  const s = raid.get(guildId) ?? { joins: [], until: 0 };
  raid.set(guildId, s);
  return s;
}

async function punishSpam(m, entries, reason) {
  await m.member.timeout(TIMEOUT_MS, reason).catch(() => {});
  const byChannel = new Map();
  for (const e of entries) byChannel.set(e.ch, [...(byChannel.get(e.ch) ?? []), e.id]);
  for (const [chId, ids] of byChannel) {
    await m.guild.channels.cache.get(chId)?.bulkDelete(ids, true).catch(() => {});
  }
  logEvent(m.guild, {
    title: 'Anti-spam', color: 0xe67e22,
    description: `<@${m.author.id}> in timeout per ${TIMEOUT_MS / 60_000} min.`,
    fields: [{ name: 'Motivo', value: reason, inline: true }, { name: 'Canale', value: `<#${m.channelId}>`, inline: true }],
  });
}

const unlockRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('raid:unlock').setLabel('Termina lockdown').setStyle(ButtonStyle.Success),
);

async function holdNewcomer(member, s) {
  const remaining = Math.max(10_000, s.until - Date.now());
  await member.timeout(remaining, 'Anti-raid lockdown').catch(() => {});
  logEvent(member.guild, {
    title: 'Lockdown: nuovo ingresso',
    color: palette.live,
    description: `<@${member.id}> (${member.user.tag}) messo in timeout, non espulso.`,
  });
}

function init(client) {
  setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of history) if (!arr.some((e) => now - e.t < SPAM_WINDOW)) history.delete(k);
  }, 60_000).unref();

  client.on('messageCreate', async (m) => {
    try {
      if (!m.guild || m.author.bot || !m.member || isStaff(m.member)) return;
      const key = `${m.guildId}:${m.author.id}`;
      const now = Date.now();
      const arr = (history.get(key) ?? []).filter((e) => now - e.t < SPAM_WINDOW);
      arr.push({ t: now, id: m.id, ch: m.channelId, c: m.content });
      history.set(key, arr);

      let reason = null;
      if (arr.length >= SPAM_LIMIT) reason = `${arr.length} messaggi in ${SPAM_WINDOW / 1000}s`;
      else if (m.content && arr.filter((e) => e.c === m.content).length >= DUP_LIMIT) reason = 'messaggio ripetuto';
      else if (m.mentions.users.size + m.mentions.roles.size >= MENTION_LIMIT) reason = 'menzioni di massa';
      if (!reason) return;

      history.delete(key);
      await punishSpam(m, arr, reason);
    } catch (err) {
      console.error(err);
    }
  });

  client.on('guildMemberAdd', async (member) => {
    try {
      if (member.user.bot) return;
      const now = Date.now();
      const s = raidState(member.guild.id);

      if (now < s.until) {
        await holdNewcomer(member, s);
        return;
      }

      s.joins = s.joins.filter((j) => now - j.t < RAID_WINDOW);
      s.joins.push({ t: now, member });
      const limit = liveState.any() ? RAID_JOINS_LIVE : RAID_JOINS;
      if (s.joins.length < limit) return;

      s.until = now + LOCKDOWN_MS;
      const suspects = s.joins.map((j) => j.member);
      s.joins = [];
      logEvent(member.guild, {
        title: 'Possibile raid',
        color: palette.live,
        description:
          `${suspects.length} ingressi in ${RAID_WINDOW / 1000}s. ` +
          `Lockdown ${LOCKDOWN_MS / 60_000} min: i nuovi arrivati vanno in timeout, **nessuna espulsione**. ` +
          `Controlla e premi il pulsante per sbloccare.`,
        fields: [{ name: 'Ingressi', value: suspects.map((m) => `<@${m.id}>`).join(', ').slice(0, 1000) || '—' }],
        components: [unlockRow()],
      });
      for (const sus of suspects) await holdNewcomer(sus, s);
    } catch (err) {
      console.error(err);
    }
  });

  client.on('interactionCreate', async (i) => {
    if (!i.isButton() || i.customId !== 'raid:unlock') return;
    try {
      if (!i.member.permissions.has(V.ModerateMembers) && !isStaff(i.member)) {
        return i.reply({ content: 'Solo lo staff può terminare il lockdown.', flags: MessageFlags.Ephemeral });
      }
      const s = raidState(i.guildId);
      s.until = 0;
      s.joins = [];
      await i.reply({ content: 'Lockdown terminato. I timeout già dati restano, puoi toglierli a mano se erano falsi positivi.', flags: MessageFlags.Ephemeral });
      logEvent(i.guild, { title: 'Lockdown terminato', color: palette.ok, description: `Da <@${i.user.id}>` });
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init };
