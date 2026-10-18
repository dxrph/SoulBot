const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, MessageFlags,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap, channelByKey, isStaff } = require('../util');

const ranks = roles.filter((r) => r.group === 'rank');

const commands = [
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Post a looking-for-group card')
    .setDMPermission(false)
    .addStringOption((o) => o.setName('rank').setDescription('Your rank').setRequired(true)
      .addChoices(...ranks.map((r) => ({ name: r.name, value: r.key }))))
    .addStringOption((o) => o.setName('mode').setDescription('Game mode').setRequired(true)
      .addChoices({ name: '🏆 Ranked', value: 'ranked' }, { name: '🎲 Casual', value: 'casual' }))
    .addIntegerOption((o) => o.setName('size').setDescription('Total party size including you (default 6)').setMinValue(2).setMaxValue(6))
    .addStringOption((o) => o.setName('note').setDescription('Hero, playstyle, schedule...').setMaxLength(200))
    .addBooleanOption((o) => o.setName('ping').setDescription('Ping Hunting for Party')),
].map((c) => c.toJSON());

const mentionsOf = (text) => [...text.matchAll(/<@(\d+)>/g)].map((m) => m[1]);

function card({ rank, mode, size, note, players, host }) {
  const full = players.length >= size;
  return {
    embeds: [new EmbedBuilder()
      .setColor(full ? 0x2ecc71 : 0xf39c12)
      .setTitle(`${mode === 'ranked' ? '🏆 Ranked' : '🎲 Casual'} · ${rank}`)
      .setDescription(note || null)
      .addFields({ name: `Party (${players.length}/${size})`, value: players.map((id) => `<@${id}>`).join('\n') })
      .setFooter({ text: full ? 'Party full' : 'Press Join to take a slot' })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lfg:join:${host}`).setLabel('Join').setStyle(ButtonStyle.Success).setDisabled(full),
      new ButtonBuilder().setCustomId(`lfg:leave:${host}`).setLabel('Leave').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`lfg:close:${host}`).setLabel('Close').setStyle(ButtonStyle.Danger),
    )],
  };
}

// State lives in the message itself: rank/mode in the title, size in the field name, players as mentions
function parse(message) {
  const e = message.embeds[0];
  const [modeText, rank] = e.title.split(' · ');
  return {
    mode: modeText.includes('Ranked') ? 'ranked' : 'casual',
    rank,
    note: e.description,
    size: Number(e.fields[0].name.match(/\/(\d+)\)/)[1]),
    players: mentionsOf(e.fields[0].value),
  };
}

async function create(i) {
  const rankDef = ranks.find((r) => r.key === i.options.getString('rank'));
  const mode = i.options.getString('mode');
  const target = channelByKey(i.guild, mode === 'ranked' ? 'lfg_ranked' : 'lfg_casual') ?? i.channel;
  const R = roleMap(i.guild);
  const ping = i.options.getBoolean('ping') && R.lfg;

  const msg = await target.send({
    content: ping ? `${R.lfg}` : undefined,
    allowedMentions: { roles: ping ? [R.lfg.id] : [] },
    ...card({
      rank: rankDef.name, mode, size: i.options.getInteger('size') ?? 6,
      note: i.options.getString('note'), players: [i.user.id], host: i.user.id,
    }),
  });
  await i.reply({ content: `Posted: ${msg.url}`, flags: MessageFlags.Ephemeral });
}

async function button(i) {
  const [, action, host] = i.customId.split(':');
  const state = parse(i.message);

  if (action === 'close') {
    if (i.user.id !== host && !isStaff(i.member)) {
      return i.reply({ content: 'Only the host can close this.', flags: MessageFlags.Ephemeral });
    }
    return i.update({ components: [], embeds: [EmbedBuilder.from(i.message.embeds[0]).setColor(0x95a5a6).setFooter({ text: 'Closed' })] });
  }

  if (action === 'join') {
    if (state.players.includes(i.user.id)) return i.reply({ content: 'You are already in.', flags: MessageFlags.Ephemeral });
    if (state.players.length >= state.size) return i.reply({ content: 'Party is full.', flags: MessageFlags.Ephemeral });
    state.players.push(i.user.id);
  } else {
    if (i.user.id === host) return i.reply({ content: 'You are the host, use Close.', flags: MessageFlags.Ephemeral });
    if (!state.players.includes(i.user.id)) return i.reply({ content: 'You are not in this party.', flags: MessageFlags.Ephemeral });
    state.players = state.players.filter((id) => id !== i.user.id);
  }

  await i.update(card({ ...state, host }));
  if (state.players.length >= state.size) {
    await i.channel.send({
      content: `🎉 Party full! ${state.players.map((id) => `<@${id}>`).join(' ')}`,
      allowedMentions: { users: state.players },
    }).catch(() => {});
  }
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'lfg') return await create(i);
      if (i.isButton() && i.customId.startsWith('lfg:')) return await button(i);
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, commands };
