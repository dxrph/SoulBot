const { AuditLogEvent } = require('discord.js');
const { roles: roleDefs } = require('../template');
const { channelByKey, logEvent } = require('../util');
const store = require('../store');

const RED = 0xe74c3c;
const GREEN = 0x2ecc71;
const GREY = 0x95a5a6;
const BLUE = 0x4FC3F7;
const PURPLE = 0x7C4DFF;

// Self-assigned roles (free ranks, regions, notifications, heroes) change all the time: not logged
const SELF_ASSIGN = new Set(roleDefs.filter((r) => r.group && !r.verify).map((r) => r.name));
const quietRole = (guild, role) => SELF_ASSIGN.has(role.name)
  || Object.values(store.getHeroRoles(guild.id)).includes(role.id);

// Most recent audit-log entry of a type that targets this user (to find out who kicked/banned)
async function recentAudit(guild, type, targetId) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  return logs?.entries.find((e) => e.target?.id === targetId && Date.now() - e.createdTimestamp < 10_000);
}

const skipChannel = (guild, channelId) => [
  channelByKey(guild, 'modlog')?.id, channelByKey(guild, 'say')?.id,
  channelByKey(guild, 'log_messages')?.id, channelByKey(guild, 'log_voice')?.id,
].includes(channelId);

function init(client) {
  client.on('guildMemberAdd', (m) => {
    const days = Math.floor((Date.now() - m.user.createdTimestamp) / 86_400_000);
    logEvent(m.guild, {
      title: '📥 Nuovo membro', color: GREEN,
      description: `<@${m.id}> (${m.user.tag})`,
      fields: [{ name: 'Età account', value: `${days} giorni`, inline: true }],
    });
  });

  client.on('guildMemberRemove', async (m) => {
    const kick = await recentAudit(m.guild, AuditLogEvent.MemberKick, m.id);
    if (kick?.executorId === client.user.id) return; // anti-raid kicks are logged by the security module
    logEvent(m.guild, kick
      ? { title: '👢 Membro espulso', color: RED, description: `<@${m.id}> (${m.user.tag})`,
          fields: [{ name: 'Da', value: `<@${kick.executorId}>`, inline: true }, { name: 'Motivo', value: kick.reason ?? 'nessuno', inline: true }] }
      : { title: '📤 Membro uscito', color: GREY, description: `<@${m.id}> (${m.user.tag})` });
  });

  client.on('guildBanAdd', async (ban) => {
    const e = await recentAudit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    logEvent(ban.guild, {
      title: '🔨 Membro bannato', color: RED, description: `${ban.user.tag} (${ban.user.id})`,
      fields: [{ name: 'Da', value: e ? `<@${e.executorId}>` : 'sconosciuto', inline: true }, { name: 'Motivo', value: ban.reason ?? e?.reason ?? 'nessuno', inline: true }],
    });
  });

  client.on('guildBanRemove', (ban) => {
    logEvent(ban.guild, { title: '♻️ Ban rimosso', color: GREEN, description: `${ban.user.tag} (${ban.user.id})` });
  });

  // ---- messages (🗑️┃log-messaggi, or the mod log) ---------------------------------------------
  client.on('messageDelete', (m) => {
    if (!m.guild || m.author?.bot || skipChannel(m.guild, m.channelId)) return;
    const files = [...(m.attachments?.values() ?? [])].map((a) => a.url).join('\n');
    logEvent(m.guild, {
      to: 'log_messages',
      title: '🗑️ Messaggio cancellato', color: GREY,
      fields: [
        { name: 'Autore', value: m.author ? `<@${m.author.id}>` : 'sconosciuto', inline: true },
        { name: 'Canale', value: `<#${m.channelId}>`, inline: true },
        { name: 'Contenuto', value: m.partial ? '(messaggio precedente al riavvio del bot: testo non disponibile)' : (m.content || '(nessun testo)') },
        ...(files ? [{ name: 'Allegati', value: files }] : []),
      ],
    });
  });

  client.on('messageDeleteBulk', (messages, channel) => {
    if (!channel.guild || skipChannel(channel.guild, channel.id)) return;
    logEvent(channel.guild, {
      to: 'log_messages',
      title: '🧹 Messaggi cancellati in blocco', color: GREY,
      description: `${messages.size} messaggi in <#${channel.id}>`,
    });
  });

  client.on('messageUpdate', (oldM, newM) => {
    if (!newM.guild || newM.author?.bot || oldM.partial || !oldM.content || oldM.content === newM.content) return;
    if (skipChannel(newM.guild, newM.channelId)) return;
    logEvent(newM.guild, {
      to: 'log_messages',
      title: '✏️ Messaggio modificato', color: GREY,
      description: newM.url ? `[Vai al messaggio](${newM.url})` : undefined,
      fields: [
        { name: 'Autore', value: `<@${newM.author?.id ?? oldM.author?.id}>`, inline: true },
        { name: 'Canale', value: `<#${newM.channelId}>`, inline: true },
        { name: 'Prima', value: oldM.content },
        { name: 'Dopo', value: newM.content || '(nessun testo)' },
      ],
    });
  });

  // ---- roles (mod log) --------------------------------------------------------------------------
  client.on('guildMemberUpdate', (oldM, newM) => {
    if (oldM.partial || newM.user.bot) return;
    const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id) && !quietRole(newM.guild, r));
    const removed = oldM.roles.cache.filter((r) => !newM.roles.cache.has(r.id) && !quietRole(newM.guild, r));
    if (added.size || removed.size) {
      logEvent(newM.guild, {
        title: '🎭 Ruoli cambiati', color: PURPLE,
        description: `<@${newM.id}> (${newM.user.tag})`,
        fields: [
          ...(added.size ? [{ name: 'Aggiunti', value: added.map((r) => `${r}`).join(' '), inline: true }] : []),
          ...(removed.size ? [{ name: 'Tolti', value: removed.map((r) => `${r}`).join(' '), inline: true }] : []),
        ],
      });
    }
    const wasOut = oldM.communicationDisabledUntilTimestamp ?? 0;
    const isOut = newM.communicationDisabledUntilTimestamp ?? 0;
    if (isOut > Date.now() && isOut !== wasOut) {
      logEvent(newM.guild, {
        title: '🔇 Timeout', color: RED,
        description: `<@${newM.id}> fino a <t:${Math.floor(isOut / 1000)}:f>`,
      });
    }
  });

  // ---- voice (🔊┃log-vocale, or the mod log) ---------------------------------------------------
  client.on('voiceStateUpdate', (oldS, newS) => {
    if (oldS.channelId === newS.channelId || newS.member?.user.bot) return;
    const who = `<@${newS.id}>`;
    let title; let description; let color;
    if (!oldS.channelId) { title = '🔊 Entrato in vocale'; description = `${who} → <#${newS.channelId}>`; color = GREEN; }
    else if (!newS.channelId) { title = '🔇 Uscito dalla vocale'; description = `${who} ← <#${oldS.channelId}>`; color = GREY; }
    else { title = '🔀 Cambio stanza'; description = `${who}: <#${oldS.channelId}> → <#${newS.channelId}>`; color = BLUE; }
    logEvent(newS.guild, { to: 'log_voice', title, description, color });
  });
}

module.exports = { init };
