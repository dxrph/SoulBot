const { PermissionFlagsBits: V } = require('discord.js');
const { channelByKey } = require('../util');

// In the say channel write:  #target-channel your message   (attachments are forwarded too)
function init(client) {
  client.on('messageCreate', async (m) => {
    try {
      if (!m.guild || m.author.bot || !m.member) return;
      if (m.channelId !== channelByKey(m.guild, 'say')?.id) return;
      if (!m.member.permissions.has(V.ManageMessages)) return;

      const target = m.mentions.channels.first();
      const text = m.content.replace(/<#\d+>/, '').trim();
      const files = [...m.attachments.values()].map((a) => a.url);
      if (!target || !target.isTextBased() || target.guildId !== m.guildId || (!text && !files.length)) {
        await m.react('❌');
        return;
      }
      await target.send({ content: text || undefined, files });
      await m.react('✅');
    } catch (err) {
      console.error(err);
      await m.react('❌').catch(() => {});
    }
  });
}

module.exports = { init };
