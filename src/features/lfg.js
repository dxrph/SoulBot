const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, MessageFlags, ModalBuilder,
  TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap, channelByKey, isStaff } = require('../util');

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
const ranks = roles.filter((r) => r.group === 'rank');
const plainName = (r) => r.name.replace(/[^A-Za-z]/g, '').toLowerCase();
const LFG_KEYS = ['lfg', 'lfg_ranked', 'lfg_casual']; // channels where typed requests become cards

const commands = [
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Post a looking-for-group card')
    .setDMPermission(false)
    .addStringOption((o) => o.setName('mode').setDescription('Game mode').setRequired(true)
      .addChoices({ name: '🏆 Ranked', value: 'ranked' }, { name: '🎲 Casual', value: 'casual' }))
    .addStringOption((o) => o.setName('rank').setDescription('Your rank (default: your rank role)')
      .addChoices(...ranks.map((r) => ({ name: r.name, value: r.key }))))
    .addIntegerOption((o) => o.setName('size').setDescription('Total party size including you (default 6)').setMinValue(2).setMaxValue(6))
    .addStringOption((o) => o.setName('note').setDescription('Hero, playstyle, schedule...').setMaxLength(200))
    .addBooleanOption((o) => o.setName('ping').setDescription('Ping Hunting for Party')),
].map((c) => c.toJSON());

// ---- the party card -------------------------------------------------------------------------
const mentionsOf = (text) => [...text.matchAll(/<@(\d+)>/g)].map((m) => m[1]);

function card({ rank, mode, size, note, players, host }) {
  const full = players.length >= size;
  const slots = Array.from({ length: size }, (_, idx) => (players[idx] ? `<@${players[idx]}>` : '▫️ *open slot*')).join('\n');
  return {
    embeds: [new EmbedBuilder()
      .setColor(full ? 0x2ecc71 : mode === 'ranked' ? 0xe74c3c : 0xf39c12)
      .setTitle(`${mode === 'ranked' ? '🏆 Ranked' : '🎲 Casual'} · ${rank}`)
      .setDescription(note ? `> ${note}` : null)
      .addFields({ name: `Party (${players.length}/${size})`, value: slots })
      .setFooter({ text: full ? '✅ Party full' : 'Press Join to take a slot' })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lfg:join:${host}`).setLabel('Join').setEmoji('🎮').setStyle(ButtonStyle.Success).setDisabled(full),
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
    note: e.description?.replace(/^> /, '') ?? null,
    size: Number(e.fields[0].name.match(/\/(\d+)\)/)[1]),
    players: mentionsOf(e.fields[0].value),
  };
}

const rankLabel = (key) => ranks.find((r) => r.key === key)?.name ?? 'Any rank';
const memberRank = (member) => {
  const R = roleMap(member.guild);
  return ranks.find((r) => R[r.key] && member.roles.cache.has(R[r.key].id))?.key ?? null;
};

// Posts a card for a user. `channel` overrides the default channel of the mode
async function postCard({ guild, user, rank, mode, size = 6, note, ping, channel }) {
  const target = channel ?? channelByKey(guild, mode === 'ranked' ? 'lfg_ranked' : 'lfg_casual');
  if (!target) throw new Error('LFG channel not found. Run /add-tools.');
  const R = roleMap(guild);
  const pingRole = ping && R.lfg;
  return target.send({
    content: pingRole ? `${R.lfg}` : undefined,
    allowedMentions: { roles: pingRole ? [R.lfg.id] : [] },
    ...card({ rank: rankLabel(rank), mode, size, note, players: [user.id], host: user.id }),
  });
}

async function slashLfg(i) {
  const msg = await postCard({
    guild: i.guild, user: i.user,
    rank: i.options.getString('rank') ?? memberRank(i.member),
    mode: i.options.getString('mode'),
    size: i.options.getInteger('size') ?? 6,
    note: i.options.getString('note'),
    ping: i.options.getBoolean('ping'),
  });
  await i.reply({ content: `Posted: ${msg.url}`, flags: MessageFlags.Ephemeral });
}

async function partyButton(i) {
  const [, action, host] = i.customId.split(':');
  const state = parse(i.message);

  if (action === 'close') {
    if (i.user.id !== host && !isStaff(i.member)) {
      return i.reply({ content: 'Only the host can close this.', flags: MessageFlags.Ephemeral });
    }
    return i.update({ components: [], embeds: [EmbedBuilder.from(i.message.embeds[0]).setColor(0x95a5a6).setFooter({ text: '🔒 Closed' })] });
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

// ---- way 1: write your request in the channel -----------------------------------------------
// "ranked archon need 2 chill, evenings" -> mode, rank and size are read from the text
function parseRequest(text, member, channelKey) {
  const t = text.toLowerCase();
  let mode = channelKey === 'lfg_ranked' ? 'ranked' : 'casual';
  if (/\branked?\b/.test(t)) mode = 'ranked';
  else if (/\b(casual|normals?|fun)\b/.test(t)) mode = 'casual';

  const rank = ranks.find((r) => new RegExp(`\\b${plainName(r)}\\b`).test(t))?.key ?? memberRank(member);

  let size = 6;
  const need = t.match(/\bneed\s+(\d)\b/);
  if (/\bduo\b/.test(t)) size = 2;
  else if (/\btrio\b/.test(t)) size = 3;
  else if (need) size = Math.min(6, Number(need[1]) + 1);
  return { mode, rank, size: Math.max(2, size), note: text.trim().slice(0, 200) };
}

// ---- way 2: the guided UI -------------------------------------------------------------------
const drafts = new Map(); // userId -> { mode, rank, size, note, ping, at }
const DRAFT_TTL = 15 * 60_000;

const panels = {
  lfg: () => ({
    embeds: [new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('🔎 FIND YOUR PARTY')
      .setDescription(
        `Two ways to ask for teammates.\n${LINE}\n` +
        '**🧭 Guided** · press the button and pick mode, rank and size from menus.\n\n' +
        '**✍️ Just write** · type your request here and the bot turns it into a card.\n' +
        '> `ranked archon need 2, evenings EU`\n' +
        '> `casual duo chill, learning Haze`\n' +
        `${LINE}\nStart a message with \`//\` to chat without making a card.`,
      )],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lfgui:start').setLabel('Find a party').setEmoji('🔎').setStyle(ButtonStyle.Primary),
    )],
  }),
};

function renderDraft(d) {
  const size = { 2: 'Duo (2)', 3: 'Trio (3)', 4: 'Squad (4)', 5: 'Five-stack (5)', 6: 'Full party (6)' };
  return {
    embeds: [new EmbedBuilder()
      .setColor(d.mode === 'ranked' ? 0xe74c3c : 0xf39c12)
      .setTitle('🔎 BUILD YOUR REQUEST')
      .setDescription(
        `${LINE}\n` +
        `**Mode** · ${d.mode === 'ranked' ? '🏆 Ranked' : '🎲 Casual'}\n` +
        `**Rank** · ${rankLabel(d.rank)}\n` +
        `**Party** · ${size[d.size]}\n` +
        `**Note** · ${d.note || '*none*'}\n` +
        `**Ping** · ${d.ping ? '🔔 Hunting for Party' : 'off'}\n${LINE}`,
      )],
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lfgui:mode').setPlaceholder('Mode').addOptions(
        { label: 'Ranked', value: 'ranked', emoji: '🏆', default: d.mode === 'ranked' },
        { label: 'Casual', value: 'casual', emoji: '🎲', default: d.mode === 'casual' },
      )),
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lfgui:rank').setPlaceholder('Rank').addOptions(
        { label: 'Any rank', value: 'any', default: !d.rank },
        ...ranks.map((r) => ({ label: r.name, value: r.key, default: d.rank === r.key })),
      )),
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lfgui:size').setPlaceholder('Party size').addOptions(
        ...Object.entries(size).map(([n, label]) => ({ label, value: n, default: d.size === Number(n) })),
      )),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lfgui:note').setLabel('Add note').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lfgui:ping').setLabel(d.ping ? 'Ping: on' : 'Ping: off').setEmoji('🔔').setStyle(d.ping ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lfgui:post').setLabel('Post request').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('lfgui:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

async function uiInteraction(i) {
  if (i.customId === 'lfgui:start') {
    drafts.set(i.user.id, { mode: 'casual', rank: memberRank(i.member), size: 6, note: '', ping: false, channelId: i.channelId, at: Date.now() });
    return i.reply({ ...renderDraft(drafts.get(i.user.id)), flags: MessageFlags.Ephemeral });
  }

  const d = drafts.get(i.user.id);
  if (!d || Date.now() - d.at > DRAFT_TTL) {
    drafts.delete(i.user.id);
    return i.reply({ content: 'This request expired. Press **Find a party** again.', flags: MessageFlags.Ephemeral });
  }
  d.at = Date.now();

  switch (i.customId) {
    case 'lfgui:mode': d.mode = i.values[0]; break;
    case 'lfgui:rank': d.rank = i.values[0] === 'any' ? null : i.values[0]; break;
    case 'lfgui:size': d.size = Number(i.values[0]); break;
    case 'lfgui:ping': d.ping = !d.ping; break;
    case 'lfgui:note':
      return i.showModal(new ModalBuilder().setCustomId('lfgui:notemodal').setTitle('Add a note').addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('note').setLabel('Hero, playstyle, schedule...').setStyle(TextInputStyle.Paragraph)
            .setMaxLength(200).setRequired(false).setValue(d.note || ''),
        ),
      ));
    case 'lfgui:notemodal':
      d.note = i.fields.getTextInputValue('note').trim();
      break;
    case 'lfgui:cancel':
      drafts.delete(i.user.id);
      return i.update({ content: 'Cancelled.', embeds: [], components: [] });
    case 'lfgui:post': {
      drafts.delete(i.user.id);
      const msg = await postCard({ guild: i.guild, user: i.user, ...d });
      return i.update({ content: `✅ Posted: ${msg.url}`, embeds: [], components: [] });
    }
    default: return undefined;
  }
  return i.isFromMessage() ? i.update(renderDraft(d)) : i.reply({ ...renderDraft(d), flags: MessageFlags.Ephemeral });
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'lfg') return await slashLfg(i);
      if (i.isButton() && i.customId.startsWith('lfg:')) return await partyButton(i);
      if ((i.isButton() || i.isStringSelectMenu() || i.isModalSubmit()) && i.customId.startsWith('lfgui:')) return await uiInteraction(i);
    } catch (err) {
      console.error(err);
      if (!i.replied && !i.deferred) await i.reply({ content: `❌ ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });

  client.on('messageCreate', async (m) => {
    try {
      if (!m.guild || m.author.bot || !m.member || m.reference || m.attachments.size) return;
      const key = LFG_KEYS.find((k) => channelByKey(m.guild, k)?.id === m.channelId);
      if (!key || m.content.trim().length < 4 || m.content.startsWith('//')) return;

      const req = parseRequest(m.content, m.member, key);
      await postCard({ guild: m.guild, user: m.author, ...req, channel: m.channel });
      await m.delete().catch(() => {});
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, commands, panels };
