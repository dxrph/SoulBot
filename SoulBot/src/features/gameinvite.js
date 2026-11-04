const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { roleMap, channelByKey, isStaff } = require('../util');

// Game access requests: someone without Deadlock access asks for an invite,
// a member who can invite friends claims the request and sends it through Steam.

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
const STATUS = { open: '🟡 Open', claimed: '🟠 Claimed', done: '🟢 Invite sent', cancelled: '⚪ Cancelled' };

const panels = {
  gameinvite: () => ({
    embeds: [new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎟️ GET INTO THE GAME')
      .setDescription(
        `No access to Deadlock yet? Ask the community for an invite.\n${LINE}\n` +
        '**🙋 Need an invite** · press **Request invite** and leave your Steam profile link or friend code.\n' +
        '**🎁 Can invite friends** · find a request below and press **I\'ll invite them**, then send the invite through Steam.\n' +
        `${LINE}\n` +
        '⚠️ Invites are free. **Never pay for one**, and never share your password or Steam login with anyone.\n\n' +
        '*Non hai ancora accesso al gioco? Premi **Request invite** e lascia il link del tuo profilo Steam. Chi può invitare amici accetterà la tua richiesta.*',
      )],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gi:request').setLabel('Request invite').setEmoji('🎟️').setStyle(ButtonStyle.Primary),
    )],
  }),
};

function card({ requester, steam, note, status, claimer }) {
  const open = status === 'open' || status === 'claimed';
  const e = new EmbedBuilder()
    .setColor({ open: 0xf1c40f, claimed: 0xe67e22, done: 0x2ecc71, cancelled: 0x95a5a6 }[status])
    .setTitle('🎟️ Game invite request')
    .addFields(
      { name: 'Player', value: `<@${requester}>`, inline: true },
      { name: 'Status', value: STATUS[status] + (claimer ? ` by <@${claimer}>` : ''), inline: true },
      { name: 'Steam', value: steam },
    );
  if (note) e.addFields({ name: 'Note', value: note });
  return {
    embeds: [e],
    components: open ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`gi:claim:${requester}`).setLabel("I'll invite them").setEmoji('🎁').setStyle(ButtonStyle.Success).setDisabled(status === 'claimed'),
      new ButtonBuilder().setCustomId(`gi:done:${requester}`).setLabel('Invite sent').setEmoji('✅').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`gi:cancel:${requester}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    )] : [],
  };
}

// The request lives in its message: values come back from the embed fields
function read(message) {
  const f = Object.fromEntries(message.embeds[0].fields.map((x) => [x.name, x.value]));
  return {
    requester: f.Player.match(/\d+/)[0],
    steam: f.Steam,
    note: f.Note ?? null,
    claimer: f.Status.match(/<@(\d+)>/)?.[1] ?? null,
  };
}

// Steam profile link or friend code (6-10 digits)
const validSteam = (s) => /steamcommunity\.com\/(id|profiles)\/\S+/i.test(s) || /^\d{6,10}$/.test(s.replace(/\s/g, ''));

async function openRequest(i) {
  return i.showModal(new ModalBuilder().setCustomId('gi:modal').setTitle('Request a game invite').addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('steam').setLabel('Steam profile link or friend code').setStyle(TextInputStyle.Short)
        .setPlaceholder('https://steamcommunity.com/id/yourname').setMaxLength(100).setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('note').setLabel('Note (optional)').setStyle(TextInputStyle.Paragraph)
        .setMaxLength(200).setRequired(false),
    ),
  ));
}

async function submitRequest(i) {
  const steam = i.fields.getTextInputValue('steam').trim();
  const note = i.fields.getTextInputValue('note').trim() || null;
  if (!validSteam(steam)) {
    return i.reply({ content: '❌ Use your Steam profile link (steamcommunity.com/id/... or /profiles/...) or your friend code.', flags: MessageFlags.Ephemeral });
  }

  const channel = channelByKey(i.guild, 'gameinvite') ?? i.channel;
  // one open request per player
  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const mine = recent && [...recent.values()].find((m) => m.author.id === i.client.user.id
    && m.components.some((row) => row.components.some((c) => c.customId === `gi:claim:${i.user.id}`)));
  if (mine) return i.reply({ content: `You already have an open request: ${mine.url}`, flags: MessageFlags.Ephemeral });

  const msg = await channel.send({ ...card({ requester: i.user.id, steam, note, status: 'open' }), allowedMentions: { parse: [] } });
  await i.reply({ content: `✅ Request posted: ${msg.url}\nSomeone with invites will pick it up. Watch your Steam friend requests.`, flags: MessageFlags.Ephemeral });
}

async function handleButton(i) {
  const [, action, requesterId] = i.customId.split(':');
  const state = read(i.message);
  const staff = isStaff(i.member);

  if (action === 'claim') {
    if (i.user.id === requesterId) return i.reply({ content: 'You cannot claim your own request.', flags: MessageFlags.Ephemeral });
    const isPlayer = i.member.roles.cache.has(roleMap(i.guild).player?.id);
    if (!isPlayer && !staff) return i.reply({ content: 'Verify first to help others.', flags: MessageFlags.Ephemeral });
    if (state.claimer) return i.reply({ content: 'Someone already took this one.', flags: MessageFlags.Ephemeral });
    await i.update({ ...card({ ...state, status: 'claimed', claimer: i.user.id }), allowedMentions: { parse: [] } });
    return i.channel.send({
      content: `🎁 <@${requesterId}> <@${i.user.id}> will send you a game invite. Check your Steam friend requests and in-game invites.`,
      allowedMentions: { users: [requesterId, i.user.id] },
    });
  }

  const allowed = i.user.id === requesterId || i.user.id === state.claimer || staff;
  if (!allowed) return i.reply({ content: 'Only the requester, the person inviting them or staff can do this.', flags: MessageFlags.Ephemeral });
  const status = action === 'done' ? 'done' : 'cancelled';
  return i.update({ ...card({ ...state, status }), allowedMentions: { parse: [] } });
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isButton() && i.customId === 'gi:request') return await openRequest(i);
      if (i.isModalSubmit() && i.customId === 'gi:modal') return await submitRequest(i);
      if (i.isButton() && i.customId.startsWith('gi:')) return await handleButton(i);
    } catch (err) {
      console.error(err);
      if (!i.replied && !i.deferred) await i.reply({ content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
}

module.exports = { init, panels };
