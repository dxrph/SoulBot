const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, MessageFlags, PermissionFlagsBits: V,
} = require('discord.js');
const { categories } = require('../template');
const { roleMap, isStaff, mergeOw, logEvent } = require('../util');
const { palette, withFooter, baseEmbed } = require('../style');

const CATEGORY = categories.find((c) => c.name.includes('TICKETS')).name;

const panels = {
  support: () => ({
    embeds: [withFooter(new EmbedBuilder()
      .setTitle('Hai bisogno di aiuto?')
      .setDescription('Premi il pulsante per aprire un canale privato con lo staff.\n*Press the button to open a private ticket with staff.*')
      .setColor(palette.primary))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:open').setLabel('Apri ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
    )],
  }),
};

async function ticketCategory(guild, R) {
  const found = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY);
  if (found) return found;
  return guild.channels.create({
    name: CATEGORY, type: ChannelType.GuildCategory,
    permissionOverwrites: mergeOw([
      { id: guild.roles.everyone.id, deny: [V.ViewChannel] },
      ...[R.owner, R.admin, R.mod].filter(Boolean).map((r) => ({ id: r.id, allow: [V.ViewChannel, V.SendMessages, V.ManageMessages] })),
    ]),
  });
}

async function openTicket(i) {
  const R = roleMap(i.guild);
  const category = await ticketCategory(i.guild, R);
  const existing = i.guild.channels.cache.find((c) => c.parentId === category.id && c.topic === i.user.id);
  if (existing) return i.reply({ content: `Hai già un ticket: ${existing}`, flags: MessageFlags.Ephemeral });

  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const name = `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90) || 'ticket';
  const channel = await i.guild.channels.create({
    name, type: ChannelType.GuildText, parent: category.id, topic: i.user.id,
    permissionOverwrites: mergeOw([
      ...category.permissionOverwrites.cache.values(),
      { id: i.user.id, allow: [V.ViewChannel, V.SendMessages, V.ReadMessageHistory, V.AttachFiles] },
    ]),
  });
  await channel.send({
    content: `<@${i.user.id}>${R.mod ? ` ${R.mod}` : ''}`,
    embeds: [withFooter(baseEmbed(palette.primary).setDescription('Descrivi il problema. Lo staff ti risponde qui.\n*Describe your issue. Staff will reply here.*'))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Chiudi ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    )],
  });
  await i.editReply(`Ticket aperto: ${channel}`);
  logEvent(i.guild, { title: 'Ticket aperto', color: palette.primary, description: `${channel} da <@${i.user.id}>` });
}

async function closeTicket(i) {
  const owner = i.channel.topic;
  if (!isStaff(i.member) && i.user.id !== owner) {
    return i.reply({ content: 'Solo lo staff o chi ha aperto il ticket può chiuderlo.', flags: MessageFlags.Ephemeral });
  }
  await i.reply('Chiusura tra 5 secondi...');
  logEvent(i.guild, { title: 'Ticket chiuso', color: palette.muted, description: `${i.channel.name} da <@${i.user.id}>` });
  setTimeout(() => i.channel.delete('Ticket closed').catch(() => {}), 5000);
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    try {
      if (i.customId === 'ticket:open') return await openTicket(i);
      if (i.customId === 'ticket:close') return await closeTicket(i);
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, panels };
