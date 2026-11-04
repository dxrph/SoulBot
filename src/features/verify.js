const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { roleMap, channelByKey } = require('../util');
const { streamer } = require('../template');

const panels = {
  verify: () => ({
    embeds: [new EmbedBuilder()
      .setTitle(`🔥 ENTRA NELLA COMMUNITY DI ${streamer.name}`)
      .setDescription('Premi il pulsante qui sotto per diventare un **Egoista** e sbloccare tutto il server: chat, stanze vocali, clip e partite con me.\n\n*Press the button to unlock the server.*')
      .setColor(streamer.color)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify').setLabel('Entra').setEmoji('🔥').setStyle(ButtonStyle.Success),
    )],
  }),
};

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isButton() || i.customId !== 'verify') return;
    try {
      const role = roleMap(i.guild).player;
      if (!role) return i.reply({ content: 'Ruolo non trovato. Chiedi allo staff.', flags: MessageFlags.Ephemeral });
      if (i.member.roles.cache.has(role.id)) {
        return i.reply({ content: 'Sei già dei nostri. 🔥', flags: MessageFlags.Ephemeral });
      }
      await i.member.roles.add(role, 'Verified');
      await i.reply({ content: '🔥 Benvenuto tra gli Egoisti! Ora vedi tutto il server.', flags: MessageFlags.Ephemeral });

      const welcome = channelByKey(i.guild, 'welcome');
      const roles = channelByKey(i.guild, 'roles');
      const socials = channelByKey(i.guild, 'socials');
      if (welcome) {
        await welcome.send({
          embeds: [new EmbedBuilder()
            .setColor(streamer.color)
            .setTitle('🔥 Un nuovo Egoista è arrivato')
            .setDescription(
              `Benvenuto <@${i.user.id}>! Sei il membro numero **${i.guild.memberCount}**.\n` +
              `${roles ? `🎭 Scegli rank e notifiche live in ${roles}\n` : ''}` +
              `${socials ? `🔗 Seguimi ovunque da ${socials}\n` : ''}` +
              `🔴 Ci vediamo in live: ${streamer.links.twitch}`)
            .setThumbnail(i.user.displayAvatarURL())],
        }).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, panels };
