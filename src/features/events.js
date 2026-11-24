// /evento-live: Discord scheduled event (external, Twitch link). /giveaway: button to join, random draw.
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits: V,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel,
} = require('discord.js');
const { streamer } = require('../template');
const { isStaff, logEvent } = require('../util');
const { guildSlash } = require('../slash');
const { palette, LINE, withFooter, baseEmbed } = require('../style');
const { parseWhen } = require('../when');

const commands = [
  guildSlash('evento-live', 'Crea un evento Discord per la prossima live (solo staff)')
    .setDefaultMemberPermissions(V.ManageEvents)
    .addStringOption((o) => o.setName('quando').setDescription('Es. 21:30 · domani 21:30 · 27/11 21:30 (ora di Bruxelles)').setRequired(true).setMaxLength(30))
    .addStringOption((o) => o.setName('titolo').setDescription('Titolo dell\'evento (predefinito: Live di ONYZUK4)').setMaxLength(100))
    .addIntegerOption((o) => o.setName('ore').setDescription('Durata in ore (predefinito 3)').setMinValue(1).setMaxValue(24))
    .addStringOption((o) => o.setName('descrizione').setDescription('Cosa si fa in live').setMaxLength(900)),
  guildSlash('giveaway', 'Avvia un giveaway in questo canale (solo staff)')
    .setDefaultMemberPermissions(V.ManageMessages)
    .addStringOption((o) => o.setName('premio').setDescription('Cosa si vince').setRequired(true).setMaxLength(200))
    .addIntegerOption((o) => o.setName('minuti').setDescription('Durata in minuti (predefinito 60, max 7 giorni)').setMinValue(1).setMaxValue(10080))
    .addIntegerOption((o) => o.setName('vincitori').setDescription('Quanti vincitori (predefinito 1)').setMinValue(1).setMaxValue(10)),
].map((c) => c.toJSON());

// ---- /evento-live -----------------------------------------------------------------------------
async function eventoLive(i) {
  if (!isStaff(i.member) && !i.member.permissions.has(V.ManageEvents)) {
    return i.reply({ content: 'Solo lo staff può creare eventi.', flags: MessageFlags.Ephemeral });
  }
  const start = parseWhen(i.options.getString('quando'));
  if (!start) return i.reply({ content: 'Non ho capito quando. Esempi: `21:30`, `domani 21:30`, `27/11 21:30`.', flags: MessageFlags.Ephemeral });
  if (start.getTime() < Date.now() + 60_000) return i.reply({ content: 'L\'evento deve essere nel futuro.', flags: MessageFlags.Ephemeral });
  const hours = i.options.getInteger('ore') ?? 3;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const event = await i.guild.scheduledEvents.create({
    name: i.options.getString('titolo') ?? `Live di ${streamer.name}`,
    description: i.options.getString('descrizione') ?? `Deadlock, anime e chat. Ci vediamo su ${streamer.links.twitch}`,
    scheduledStartTime: start,
    scheduledEndTime: new Date(start.getTime() + hours * 3_600_000),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    entityMetadata: { location: streamer.links.twitch },
    reason: `Creato da ${i.user.tag}`,
  });
  const ts = Math.floor(start.getTime() / 1000);
  await i.editReply(`📅 Evento creato per <t:${ts}:F> (<t:${ts}:R>): ${event.url}\nCondividilo in annunci, così la gente preme "Interessato".`);
  logEvent(i.guild, { title: '📅 Evento live creato', color: palette.primary, description: `${event.name} · <t:${ts}:F> · da <@${i.user.id}>` });
}

// ---- /giveaway (in memory: a bot restart cancels running giveaways) ---------------------------
const giveaways = new Map(); // messageId -> { prize, winners, ends, hostId, entries: Set, timer, channelId }

const gwEmbed = (gw, ended = false, winners = []) => withFooter(baseEmbed(ended ? palette.muted : palette.accent)
  .setTitle(`🎁 Giveaway: ${gw.prize}`.slice(0, 256))
  .setDescription(ended
    ? `${LINE}\n${winners.length ? `Vincitori: ${winners.map((id) => `<@${id}>`).join(', ')}` : 'Nessun partecipante. Il Vuoto Infinito ha vinto.'}\nPartecipanti: **${gw.entries.size}**`
    : `${LINE}\nPremi **Partecipa** per entrare nell'estrazione.\nFine: <t:${Math.floor(gw.ends / 1000)}:R> · Vincitori: **${gw.winners}**\nPartecipanti: **${gw.entries.size}**\nOrganizzato da <@${gw.hostId}>`), 'Giveaway');

const gwButtons = (disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('gw:join').setLabel('Partecipa').setEmoji('🎉').setStyle(ButtonStyle.Success).setDisabled(disabled),
  new ButtonBuilder().setCustomId('gw:end').setLabel('Estrai ora (staff)').setEmoji('🎲').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
);

function draw(entries, n) {
  const pool = [...entries];
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

async function finish(client, messageId) {
  const gw = giveaways.get(messageId);
  if (!gw) return;
  giveaways.delete(messageId);
  clearTimeout(gw.timer);
  const channel = await client.channels.fetch(gw.channelId).catch(() => null);
  const msg = channel && await channel.messages.fetch(messageId).catch(() => null);
  const winners = draw(gw.entries, gw.winners);
  if (msg) await msg.edit({ embeds: [gwEmbed(gw, true, winners)], components: [gwButtons(true)] }).catch(() => {});
  if (channel) {
    await channel.send({
      content: winners.length
        ? `🎉 Complimenti ${winners.map((id) => `<@${id}>`).join(', ')}! Hai vinto **${gw.prize}**. Scrivi allo staff per riscattarlo.`
        : `Nessuno ha partecipato al giveaway **${gw.prize}**. Peccato.`,
      allowedMentions: { users: winners },
      reply: msg ? { messageReference: msg.id, failIfNotExists: false } : undefined,
    }).catch(() => {});
  }
}

async function startGiveaway(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può avviare un giveaway.', flags: MessageFlags.Ephemeral });
  const minutes = i.options.getInteger('minuti') ?? 60;
  const gw = {
    prize: i.options.getString('premio'),
    winners: i.options.getInteger('vincitori') ?? 1,
    ends: Date.now() + minutes * 60_000,
    hostId: i.user.id,
    entries: new Set(),
    channelId: i.channelId,
  };
  const msg = await i.channel.send({ embeds: [gwEmbed(gw)], components: [gwButtons()] });
  giveaways.set(msg.id, gw);
  gw.timer = setTimeout(() => finish(i.client, msg.id).catch(console.error), minutes * 60_000);
  await i.reply({ content: `Giveaway avviato. Attenzione: un riavvio del bot (deploy) lo annulla.`, flags: MessageFlags.Ephemeral });
}

async function join(i) {
  const gw = giveaways.get(i.message.id);
  if (!gw) return i.reply({ content: 'Questo giveaway non è più attivo (finito o annullato da un riavvio del bot).', flags: MessageFlags.Ephemeral });
  if (gw.entries.has(i.user.id)) {
    gw.entries.delete(i.user.id);
    await i.update({ embeds: [gwEmbed(gw)] });
    return i.followUp({ content: 'Sei uscito dal giveaway.', flags: MessageFlags.Ephemeral });
  }
  gw.entries.add(i.user.id);
  await i.update({ embeds: [gwEmbed(gw)] });
  return i.followUp({ content: 'Sei dentro! Premi di nuovo per uscire.', flags: MessageFlags.Ephemeral });
}

async function endNow(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può estrarre.', flags: MessageFlags.Ephemeral });
  if (!giveaways.has(i.message.id)) return i.reply({ content: 'Questo giveaway non è più attivo.', flags: MessageFlags.Ephemeral });
  await i.deferUpdate();
  return finish(i.client, i.message.id);
}

async function onInteraction(i) {
  try {
    if (i.isChatInputCommand() && i.commandName === 'evento-live') return await eventoLive(i);
    if (i.isChatInputCommand() && i.commandName === 'giveaway') return await startGiveaway(i);
    if (i.isButton() && i.customId === 'gw:join') return await join(i);
    if (i.isButton() && i.customId === 'gw:end') return await endNow(i);
  } catch (err) {
    console.error(err);
    const content = `Non ci sono riuscito: ${err.message}`;
    if (i.deferred || i.replied) await i.editReply(content).catch(() => {});
    else await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

module.exports = { onInteraction, commands, draw };
