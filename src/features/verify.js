const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { roleMap, channelByKey } = require('../util');
const { streamer } = require('../template');
const { palette, LINE, withFooter, baseEmbed } = require('../style');

const panels = {
  verify: () => ({
    embeds: [withFooter(new EmbedBuilder()
      .setTitle(`Entra nella community di ${streamer.name}`)
      .setDescription(
        `Premi il pulsante qui sotto per diventare un **Egoista** e sbloccare tutto il server: chat, stanze vocali, clip e partite con me.\n` +
        `${LINE}\n*Press the button to unlock the server.*`,
      )
      .setColor(palette.primary))],
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
        return i.reply({ content: 'Sei già dei nostri.', flags: MessageFlags.Ephemeral });
      }
      await i.member.roles.add(role, 'Verified');
      await i.reply({ content: 'Benvenuto tra gli Egoisti! Ora vedi tutto il server.', flags: MessageFlags.Ephemeral });

      const welcome = channelByKey(i.guild, 'welcome');
      const rolesCh = channelByKey(i.guild, 'roles');
      const socials = channelByKey(i.guild, 'socials');
      if (welcome) {
        await welcome.send({
          embeds: [withFooter(baseEmbed(palette.primary)
            .setTitle('Un nuovo Egoista è arrivato')
            .setDescription(
              `Benvenuto <@${i.user.id}>! Sei il membro numero **${i.guild.memberCount}**.\n` +
              `${rolesCh ? `Scegli rank e notifiche live in ${rolesCh}\n` : ''}` +
              `${socials ? `Seguimi ovunque da ${socials}\n` : ''}` +
              `Ci vediamo in live: ${streamer.links.twitch}`,
            )
            .setThumbnail(i.user.displayAvatarURL()))],
        }).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, panels };
