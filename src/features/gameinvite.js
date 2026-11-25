const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { roleMap, channelByKey, isStaff } = require('../util');
const { palette, LINE, withFooter, baseEmbed } = require('../style');

const STATUS = { open: 'Aperto', claimed: 'Preso in carico', done: 'Invito inviato', cancelled: 'Annullato' };

const panels = {
  gameinvite: () => ({
    embeds: [withFooter(new EmbedBuilder()
      .setColor(palette.warn)
      .setTitle('Entra nel gioco')
      .setDescription(
        `Non hai ancora accesso a Deadlock? Chiedi un invito alla community.\n${LINE}\n` +
        '**Hai bisogno di un invito** · premi **Chiedi invito** e lascia il link del tuo profilo Steam o il codice amico.\n' +
        '**Puoi invitare amici** · trova una richiesta qui sotto e premi **Li invito io**, poi manda l\'invito da Steam.\n' +
        `${LINE}\n` +
        '⚠️ Gli inviti sono gratis. **Non pagare mai** e non condividere password o login Steam.\n\n' +
        '*Need a Deadlock invite? Press the button and leave your Steam profile link.*',
      ))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gi:request').setLabel('Chiedi invito').setEmoji('🎟️').setStyle(ButtonStyle.Primary),
    )],
  }),
};

function card({ requester, steam, note, status, claimer }) {
  const open = status === 'open' || status === 'claimed';
  const e = withFooter(baseEmbed({ open: palette.warn, claimed: 0xe67e22, done: palette.ok, cancelled: palette.muted }[status])
    .setTitle('Richiesta invito al gioco')
    .addFields(
      { name: 'Giocatore', value: `<@${requester}>`, inline: true },
      { name: 'Stato', value: STATUS[status] + (claimer ? ` da <@${claimer}>` : ''), inline: true },
      { name: 'Steam', value: steam },
    ));
  if (note) e.addFields({ name: 'Nota', value: note });
  return {
    embeds: [e],
    components: open ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`gi:claim:${requester}`).setLabel('Li invito io').setEmoji('🎁').setStyle(ButtonStyle.Success).setDisabled(status === 'claimed'),
      new ButtonBuilder().setCustomId(`gi:done:${requester}`).setLabel('Invito inviato').setEmoji('✅').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`gi:cancel:${requester}`).setLabel('Annulla').setStyle(ButtonStyle.Secondary),
    )] : [],
  };
}

function read(message) {
  const f = Object.fromEntries(message.embeds[0].fields.map((x) => [x.name, x.value]));
  return {
    requester: (f.Giocatore || f.Player).match(/\d+/)[0],
    steam: f.Steam,
    note: f.Nota ?? f.Note ?? null,
    claimer: (f.Stato || f.Status).match(/<@(\d+)>/)?.[1] ?? null,
  };
}

const validSteam = (s) => /steamcommunity\.com\/(id|profiles)\/\S+/i.test(s) || /^\d{6,10}$/.test(s.replace(/\s/g, ''));

async function openRequest(i) {
  return i.showModal(new ModalBuilder().setCustomId('gi:modal').setTitle('Chiedi un invito al gioco').addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('steam').setLabel('Link Steam o codice amico').setStyle(TextInputStyle.Short)
        .setPlaceholder('https://steamcommunity.com/id/tuonome').setMaxLength(100).setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('note').setLabel('Nota (facoltativa)').setStyle(TextInputStyle.Paragraph)
        .setMaxLength(200).setRequired(false),
    ),
  ));
}

async function submitRequest(i) {
  const steam = i.fields.getTextInputValue('steam').trim();
  const note = i.fields.getTextInputValue('note').trim() || null;
  if (!validSteam(steam)) {
    return i.reply({ content: 'Usa il link del profilo Steam (steamcommunity.com/id/... o /profiles/...) o il codice amico.', flags: MessageFlags.Ephemeral });
  }

  const channel = channelByKey(i.guild, 'gameinvite') ?? i.channel;
  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const mine = recent && [...recent.values()].find((m) => m.author.id === i.client.user.id
    && m.components.some((row) => row.components.some((c) => c.customId === `gi:claim:${i.user.id}`)));
  if (mine) return i.reply({ content: `Hai già una richiesta aperta: ${mine.url}`, flags: MessageFlags.Ephemeral });

  const msg = await channel.send({ ...card({ requester: i.user.id, steam, note, status: 'open' }), allowedMentions: { parse: [] } });
  await i.reply({ content: `Richiesta pubblicata: ${msg.url}\nQualcuno con gli inviti la prenderà in carico. Controlla le richieste di amicizia su Steam.`, flags: MessageFlags.Ephemeral });
}

async function handleButton(i) {
  const [, action, requesterId] = i.customId.split(':');
  const state = read(i.message);
  const staff = isStaff(i.member);

  if (action === 'claim') {
    if (i.user.id === requesterId) return i.reply({ content: 'Non puoi prendere in carico la tua richiesta.', flags: MessageFlags.Ephemeral });
    const isPlayer = i.member.roles.cache.has(roleMap(i.guild).player?.id);
    if (!isPlayer && !staff) return i.reply({ content: 'Prima verifica il tuo account per aiutare gli altri.', flags: MessageFlags.Ephemeral });
    if (state.claimer) return i.reply({ content: 'Qualcun altro l\'ha già presa in carico.', flags: MessageFlags.Ephemeral });
    await i.update({ ...card({ ...state, status: 'claimed', claimer: i.user.id }), allowedMentions: { parse: [] } });
    return i.channel.send({
      content: `<@${requesterId}> <@${i.user.id}> ti manderà un invito. Controlla le richieste su Steam e gli inviti in gioco.`,
      allowedMentions: { users: [requesterId, i.user.id] },
    });
  }

  const allowed = i.user.id === requesterId || i.user.id === state.claimer || staff;
  if (!allowed) return i.reply({ content: 'Solo chi ha chiesto, chi invita o lo staff può farlo.', flags: MessageFlags.Ephemeral });
  const status = action === 'done' ? 'done' : 'cancelled';
  return i.update({ ...card({ ...state, status }), allowedMentions: { parse: [] } });
}

async function onInteraction(i) {
  try {
    if (i.isButton() && i.customId === 'gi:request') return await openRequest(i);
    if (i.isModalSubmit() && i.customId === 'gi:modal') return await submitRequest(i);
    if (i.isButton() && i.customId.startsWith('gi:')) return await handleButton(i);
  } catch (err) {
    console.error(err);
    if (!i.replied && !i.deferred) await i.reply({ content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

module.exports = { onInteraction, panels };
