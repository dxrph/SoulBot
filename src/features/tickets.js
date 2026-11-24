const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, MessageFlags, PermissionFlagsBits: V,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} = require('discord.js');
const { categories } = require('../template');
const {
  roleMap, isStaff, mergeOw, logEvent, channelByKey,
} = require('../util');
const { palette, withFooter, baseEmbed } = require('../style');

const CATEGORY = categories.find((c) => c.name.includes('TICKETS')).name;

// Ticket types: each one opens a modal with its own questions
const TYPES = {
  supporto: {
    label: 'Supporto', emoji: '🛟', description: 'Problemi col server, ruoli, bot o domande allo staff',
    questions: [
      { id: 'what', label: 'Di cosa hai bisogno?', style: TextInputStyle.Paragraph, required: true },
      { id: 'tried', label: 'Hai già provato qualcosa?', style: TextInputStyle.Paragraph, required: false },
    ],
  },
  segnalazione: {
    label: 'Segnalazione', emoji: '🚨', description: 'Segnala un utente o un comportamento',
    questions: [
      { id: 'who', label: 'Chi stai segnalando? (nome o ID)', style: TextInputStyle.Short, required: true },
      { id: 'what', label: 'Cosa è successo?', style: TextInputStyle.Paragraph, required: true },
      { id: 'proof', label: 'Prove (link a messaggi o screenshot)', style: TextInputStyle.Paragraph, required: false },
    ],
  },
  rank: {
    label: 'Verifica rank', emoji: '🏆', description: 'Problemi con la verifica del rank Deadlock',
    questions: [
      { id: 'rank', label: 'Il tuo rank attuale in Deadlock', style: TextInputStyle.Short, required: true },
      { id: 'proof', label: 'Link al profilo o allo screenshot', style: TextInputStyle.Paragraph, required: true },
      { id: 'notes', label: 'Note per lo staff', style: TextInputStyle.Paragraph, required: false },
    ],
  },
};

const categoryMenu = () => new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder().setCustomId('ticket:category').setPlaceholder('Scegli il tipo di ticket')
    .addOptions(Object.entries(TYPES).map(([value, t]) => ({
      label: t.label, value, emoji: t.emoji, description: t.description,
    }))),
);

const panels = {
  support: () => ({
    embeds: [withFooter(new EmbedBuilder()
      .setTitle('Hai bisogno di aiuto?')
      .setDescription(
        'Scegli il tipo di ticket dal menu: rispondi a due domande e si apre un canale privato con lo staff.\n' +
        '🛟 **Supporto** · 🚨 **Segnalazione** · 🏆 **Verifica rank**\n' +
        '*Pick a ticket type to open a private channel with staff.*',
      )
      .setColor(palette.primary))],
    components: [categoryMenu()],
  }),
};

// topic = "<userId> · <type>"; old tickets have just "<userId>"
const ticketOwner = (ch) => ch.topic?.split(' ')[0] ?? null;
const findOpen = (guild, categoryId, userId) => guild.channels.cache
  .find((c) => c.parentId === categoryId && ticketOwner(c) === userId);

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

// Old panel button (before /refresh-panels): show the type menu privately
async function legacyOpen(i) {
  return i.reply({ content: 'Che tipo di ticket vuoi aprire?', components: [categoryMenu()], flags: MessageFlags.Ephemeral });
}

async function pickType(i) {
  const type = TYPES[i.values[0]];
  if (!type) return i.reply({ content: 'Tipo di ticket sconosciuto.', flags: MessageFlags.Ephemeral });
  const category = i.guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY);
  const existing = category && findOpen(i.guild, category.id, i.user.id);
  if (existing) return i.reply({ content: `Hai già un ticket aperto: ${existing}`, flags: MessageFlags.Ephemeral });
  return i.showModal(new ModalBuilder().setCustomId(`ticket:modal:${i.values[0]}`).setTitle(`Ticket · ${type.label}`)
    .addComponents(type.questions.map((q) => new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(q.id).setLabel(q.label).setStyle(q.style).setRequired(q.required)
        .setMaxLength(q.style === TextInputStyle.Short ? 200 : 1500),
    ))));
}

async function openTicket(i) {
  const key = i.customId.split(':')[2];
  const type = TYPES[key];
  if (!type) return i.reply({ content: 'Tipo di ticket sconosciuto.', flags: MessageFlags.Ephemeral });
  const R = roleMap(i.guild);
  const category = await ticketCategory(i.guild, R);
  const existing = findOpen(i.guild, category.id, i.user.id);
  if (existing) return i.reply({ content: `Hai già un ticket aperto: ${existing}`, flags: MessageFlags.Ephemeral });

  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const name = `${key}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90) || 'ticket';
  const channel = await i.guild.channels.create({
    name, type: ChannelType.GuildText, parent: category.id, topic: `${i.user.id} · ${type.label}`,
    permissionOverwrites: mergeOw([
      ...category.permissionOverwrites.cache.values(),
      { id: i.user.id, allow: [V.ViewChannel, V.SendMessages, V.ReadMessageHistory, V.AttachFiles] },
    ]),
  });
  const fields = type.questions.map((q) => ({ name: q.label, value: i.fields.getTextInputValue(q.id) || '—' }));
  await channel.send({
    content: `<@${i.user.id}>${R.mod ? ` ${R.mod}` : ''}`,
    embeds: [withFooter(baseEmbed(palette.primary)
      .setTitle(`${type.emoji} ${type.label}`)
      .setDescription('Lo staff ti risponde qui. Puoi aggiungere screenshot e dettagli.\n*Staff will reply here.*')
      .addFields(fields.map((f) => ({ ...f, value: f.value.slice(0, 1000) }))))],
    components: [ticketButtons()],
  });
  await i.editReply(`Ticket aperto: ${channel}`);
  logEvent(i.guild, { title: `Ticket aperto · ${type.label}`, color: palette.primary, description: `${channel} da <@${i.user.id}>` });
}

const ticketButtons = (claimedBy) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ticket:claim').setEmoji('🙋')
    .setLabel(claimedBy ? `Preso da ${claimedBy}`.slice(0, 80) : 'Prendi in carico')
    .setStyle(ButtonStyle.Success).setDisabled(!!claimedBy),
  new ButtonBuilder().setCustomId('ticket:close').setLabel('Chiudi ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
);

async function claim(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può prendere in carico un ticket.', flags: MessageFlags.Ephemeral });
  await i.update({ components: [ticketButtons(i.member.displayName)] });
  await i.channel.send({ content: `🙋 <@${i.user.id}> ha preso in carico il ticket.`, allowedMentions: { parse: [] } });
  logEvent(i.guild, { title: 'Ticket preso in carico', color: palette.accent, description: `${i.channel} da <@${i.user.id}>` });
}

// Whole channel as plain text, oldest first (stops at 2000 messages)
async function transcript(channel) {
  const all = [];
  let before;
  while (all.length < 2000) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  all.reverse();
  const lines = all.map((m) => {
    const when = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 16);
    const extra = [
      ...m.embeds.map((e) => `[embed] ${e.title ?? ''} ${e.description ?? ''} ${(e.fields ?? []).map((f) => `${f.name}: ${f.value}`).join(' | ')}`.trim()),
      ...[...m.attachments.values()].map((a) => `[file] ${a.url}`),
    ];
    return `[${when} UTC] ${m.author?.tag ?? 'sconosciuto'}: ${m.content}${extra.length ? `\n    ${extra.join('\n    ')}` : ''}`;
  });
  return `Trascrizione di #${channel.name} (${channel.topic ?? ''})\n${'='.repeat(60)}\n${lines.join('\n')}\n`;
}

async function closeTicket(i) {
  const owner = ticketOwner(i.channel);
  if (!isStaff(i.member) && i.user.id !== owner) {
    return i.reply({ content: 'Solo lo staff o chi ha aperto il ticket può chiuderlo.', flags: MessageFlags.Ephemeral });
  }
  await i.reply('Salvo la trascrizione, chiusura tra 5 secondi...');
  const modlog = channelByKey(i.guild, 'modlog');
  const text = await transcript(i.channel).catch(() => null);
  if (modlog && text) {
    await modlog.send({
      embeds: [withFooter(baseEmbed(palette.muted).setTitle('Ticket chiuso')
        .setDescription(`#${i.channel.name} di ${owner ? `<@${owner}>` : 'sconosciuto'}, chiuso da <@${i.user.id}>`).setTimestamp())],
      files: [new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: `${i.channel.name}.txt` })],
      allowedMentions: { parse: [] },
    }).catch(console.error);
  } else {
    logEvent(i.guild, { title: 'Ticket chiuso', color: palette.muted, description: `${i.channel.name} da <@${i.user.id}> (trascrizione non salvata)` });
  }
  setTimeout(() => i.channel.delete('Ticket closed').catch(() => {}), 5000);
}

async function onInteraction(i) {
  try {
    if (i.isButton() && i.customId === 'ticket:open') return await legacyOpen(i);
    if (i.isStringSelectMenu() && i.customId === 'ticket:category') return await pickType(i);
    if (i.isModalSubmit() && i.customId.startsWith('ticket:modal:')) return await openTicket(i);
    if (i.isButton() && i.customId === 'ticket:claim') return await claim(i);
    if (i.isButton() && i.customId === 'ticket:close') return await closeTicket(i);
  } catch (err) {
    console.error(err);
    if (!i.replied && !i.deferred) await i.reply({ content: 'Qualcosa è andato storto, riprova.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

module.exports = {
  onInteraction, panels, TYPES, ticketOwner,
};
