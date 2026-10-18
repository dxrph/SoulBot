const { AuditLogEvent } = require('discord.js');
const { channelByKey, logEvent } = require('../util');

const RED = 0xe74c3c;
const GREEN = 0x2ecc71;
const GREY = 0x95a5a6;

// Most recent audit-log entry of a type that targets this user (to find out who kicked/banned)
async function recentAudit(guild, type, targetId) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  return logs?.entries.find((e) => e.target?.id === targetId && Date.now() - e.createdTimestamp < 10_000);
}

function init(client) {
  client.on('guildMemberAdd', (m) => {
    const days = Math.floor((Date.now() - m.user.createdTimestamp) / 86_400_000);
    logEvent(m.guild, {
      title: '📥 Member joined', color: GREEN,
      description: `<@${m.id}> (${m.user.tag})`,
      fields: [{ name: 'Account age', value: `${days} day(s)`, inline: true }],
    });
  });

  client.on('guildMemberRemove', async (m) => {
    const kick = await recentAudit(m.guild, AuditLogEvent.MemberKick, m.id);
    if (kick?.executorId === client.user.id) return; // anti-raid kicks are logged by the security module
    logEvent(m.guild, kick
      ? { title: '👢 Member kicked', color: RED, description: `<@${m.id}> (${m.user.tag})`,
          fields: [{ name: 'By', value: `<@${kick.executorId}>`, inline: true }, { name: 'Reason', value: kick.reason ?? 'none', inline: true }] }
      : { title: '📤 Member left', color: GREY, description: `<@${m.id}> (${m.user.tag})` });
  });

  client.on('guildBanAdd', async (ban) => {
    const e = await recentAudit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    logEvent(ban.guild, {
      title: '🔨 Member banned', color: RED, description: `${ban.user.tag} (${ban.user.id})`,
      fields: [{ name: 'By', value: e ? `<@${e.executorId}>` : 'unknown', inline: true }, { name: 'Reason', value: ban.reason ?? e?.reason ?? 'none', inline: true }],
    });
  });

  client.on('guildBanRemove', (ban) => {
    logEvent(ban.guild, { title: '♻️ Member unbanned', color: GREEN, description: `${ban.user.tag} (${ban.user.id})` });
  });

  client.on('messageDelete', (m) => {
    if (!m.guild || m.author?.bot) return;
    if ([channelByKey(m.guild, 'modlog')?.id, channelByKey(m.guild, 'say')?.id].includes(m.channelId)) return;
    logEvent(m.guild, {
      title: '🗑️ Message deleted', color: GREY,
      fields: [
        { name: 'Author', value: m.author ? `<@${m.author.id}>` : 'unknown', inline: true },
        { name: 'Channel', value: `<#${m.channelId}>`, inline: true },
        { name: 'Content', value: m.content || '(no text)' },
      ],
    });
  });

  client.on('messageUpdate', (oldM, newM) => {
    if (!newM.guild || newM.author?.bot || oldM.content === newM.content || !oldM.content) return;
    if ([channelByKey(newM.guild, 'modlog')?.id, channelByKey(newM.guild, 'say')?.id].includes(newM.channelId)) return;
    logEvent(newM.guild, {
      title: '✏️ Message edited', color: GREY,
      fields: [
        { name: 'Author', value: `<@${newM.author.id}>`, inline: true },
        { name: 'Channel', value: `<#${newM.channelId}>`, inline: true },
        { name: 'Before', value: oldM.content },
        { name: 'After', value: newM.content || '(no text)' },
      ],
    });
  });
}

module.exports = { init };
