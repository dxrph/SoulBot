const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, MessageFlags, PermissionFlagsBits: V,
} = require('discord.js');
const { categories } = require('../template');
const { roleMap, isStaff, mergeOw, logEvent } = require('../util');

const CATEGORY = categories.find((c) => c.name.includes('TICKETS')).name;

const panels = {
  support: () => ({
    embeds: [new EmbedBuilder()
      .setTitle('🎫 Need help?')
      .setDescription('Press the button to open a private channel with the staff.')
      .setColor(0x3498db)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:open').setLabel('Open ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
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
  if (existing) return i.reply({ content: `You already have a ticket: ${existing}`, flags: MessageFlags.Ephemeral });

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
    embeds: [new EmbedBuilder().setColor(0x3498db).setDescription('Describe your issue. Staff will reply here.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    )],
  });
  await i.editReply(`Ticket opened: ${channel}`);
  logEvent(i.guild, { title: '🎫 Ticket opened', color: 0x3498db, description: `${channel} by <@${i.user.id}>` });
}

async function closeTicket(i) {
  const owner = i.channel.topic;
  if (!isStaff(i.member) && i.user.id !== owner) {
    return i.reply({ content: 'Only staff or the ticket owner can close this.', flags: MessageFlags.Ephemeral });
  }
  await i.reply('🔒 Closing in 5 seconds...');
  logEvent(i.guild, { title: '🔒 Ticket closed', color: 0x95a5a6, description: `${i.channel.name} by <@${i.user.id}>` });
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
