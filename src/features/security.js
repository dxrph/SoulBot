const { isStaff, logEvent } = require('../util');

// Anti-spam: SPAM_LIMIT messages in SPAM_WINDOW ms, DUP_LIMIT identical ones, or MENTION_LIMIT mentions in one message
const SPAM_WINDOW = 6_000;
const SPAM_LIMIT = 6;
const DUP_LIMIT = 4;
const MENTION_LIMIT = 6;
const TIMEOUT_MS = 10 * 60_000;

// Anti-raid: RAID_JOINS joins within RAID_WINDOW ms starts a lockdown; newcomers get kicked meanwhile
const RAID_JOINS = 8;
const RAID_WINDOW = 20_000;
const LOCKDOWN_MS = 5 * 60_000;

const history = new Map(); // guildId:userId -> [{t, id, ch, c}]
const raid = new Map(); // guildId -> { joins: [{t, member}], until }

async function punishSpam(m, entries, reason) {
  await m.member.timeout(TIMEOUT_MS, reason).catch(() => {});
  const byChannel = new Map();
  for (const e of entries) byChannel.set(e.ch, [...(byChannel.get(e.ch) ?? []), e.id]);
  for (const [chId, ids] of byChannel) {
    await m.guild.channels.cache.get(chId)?.bulkDelete(ids, true).catch(() => {});
  }
  logEvent(m.guild, {
    title: '🚫 Anti-spam', color: 0xe67e22,
    description: `<@${m.author.id}> timed out for ${TIMEOUT_MS / 60_000} min.`,
    fields: [{ name: 'Reason', value: reason, inline: true }, { name: 'Channel', value: `<#${m.channelId}>`, inline: true }],
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
      if (arr.length >= SPAM_LIMIT) reason = `${arr.length} messages in ${SPAM_WINDOW / 1000}s`;
      else if (m.content && arr.filter((e) => e.c === m.content).length >= DUP_LIMIT) reason = 'repeated message';
      else if (m.mentions.users.size + m.mentions.roles.size >= MENTION_LIMIT) reason = 'mass mention';
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
      const s = raid.get(member.guild.id) ?? { joins: [], until: 0 };
      raid.set(member.guild.id, s);

      if (now < s.until) {
        await member.kick('Anti-raid lockdown').catch(() => {});
        return logEvent(member.guild, { title: '🛡️ Lockdown kick', color: 0xe74c3c, description: `<@${member.id}> (${member.user.tag})` });
      }

      s.joins = s.joins.filter((j) => now - j.t < RAID_WINDOW);
      s.joins.push({ t: now, member });
      if (s.joins.length < RAID_JOINS) return;

      s.until = now + LOCKDOWN_MS;
      const suspects = s.joins.map((j) => j.member);
      s.joins = [];
      logEvent(member.guild, {
        title: '🚨 Raid detected', color: 0xe74c3c,
        description: `${suspects.length} joins in ${RAID_WINDOW / 1000}s. New members are kicked for ${LOCKDOWN_MS / 60_000} min.`,
      });
      for (const sus of suspects) await sus.kick('Anti-raid lockdown').catch(() => {});
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init };
