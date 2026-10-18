const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { roleMap, channelByKey } = require('../util');

const panels = {
  verify: () => ({
    embeds: [new EmbedBuilder()
      .setTitle('🔥 Become Soulbound')
      .setDescription('Press the button below to unlock the server.')
      .setColor(0xe67e22)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify').setLabel('Verify').setEmoji('🔥').setStyle(ButtonStyle.Success),
    )],
  }),
};

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isButton() || i.customId !== 'verify') return;
    try {
      const role = roleMap(i.guild).player;
      if (!role) return i.reply({ content: 'Role not found. Ask staff.', flags: MessageFlags.Ephemeral });
      if (i.member.roles.cache.has(role.id)) {
        return i.reply({ content: 'You are already Soulbound.', flags: MessageFlags.Ephemeral });
      }
      await i.member.roles.add(role, 'Verified');
      await i.reply({ content: '🔥 You are now Soulbound. Welcome!', flags: MessageFlags.Ephemeral });

      const welcome = channelByKey(i.guild, 'welcome');
      const roles = channelByKey(i.guild, 'roles');
      if (welcome) {
        await welcome.send({
          embeds: [new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('🔥 A new soul joins the hunt')
            .setDescription(`Welcome <@${i.user.id}>!${roles ? ` Pick your rank and region in ${roles}.` : ''}`)
            .setThumbnail(i.user.displayAvatarURL())],
        }).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, panels };
