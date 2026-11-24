const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder,
  TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
} = require('discord.js');
const { roleMap, channelByKey, isStaff } = require('../util');
const { parseRequest, ranks } = require('../lfgParse');
const { guildSlash } = require('../slash');
const { palette, LINE, withFooter, baseEmbed } = require('../style');

const LFG_KEYS = ['lfg', 'lfg_ranked', 'lfg_casual'];

const commands = [
  guildSlash('lfg', 'Pubblica una card per cercare squadra')
    .addStringOption((o) => o.setName('mode').setDescription('Modalità').setRequired(true)
      .addChoices({ name: 'Ranked', value: 'ranked' }, { name: 'Casual', value: 'casual' }))
    .addStringOption((o) => o.setName('rank').setDescription('Il tuo rank (predefinito: il tuo ruolo rank)')
      .addChoices(...ranks.map((r) => ({ name: r.name, value: r.key }))))
    .addIntegerOption((o) => o.setName('size').setDescription('Dimensione del party incluso te (predefinito 6)').setMinValue(2).setMaxValue(6))
    .addStringOption((o) => o.setName('note').setDescription('Eroe, stile, orario...').setMaxLength(200))
    .addBooleanOption((o) => o.setName('ping').setDescription('Menziona Hunters')),
].map((c) => c.toJSON());

const mentionsOf = (text) => [...text.matchAll(/<@(\d+)>/g)].map((m) => m[1]);

function card({ rank, mode, size, note, players, host }) {
  const full = players.length >= size;
  const slots = Array.from({ length: size }, (_, idx) => (players[idx] ? `<@${players[idx]}>` : '· *posto libero*')).join('\n');
  return {
    embeds: [withFooter(baseEmbed(full ? palette.ok : mode === 'ranked' ? palette.live : palette.warn)
      .setTitle(`${mode === 'ranked' ? 'Ranked' : 'Casual'} · ${rank}`)
      .setDescription(note ? `> ${note}` : null)
      .addFields({ name: `Party (${players.length}/${size})`, value: slots }),
      full ? 'Party al completo' : 'Premi Unisciti per prendere un posto')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lfg:join:${host}`).setLabel('Unisciti').setEmoji('🎮').setStyle(ButtonStyle.Success).setDisabled(full),
      new ButtonBuilder().setCustomId(`lfg:leave:${host}`).setLabel('Esci').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`lfg:close:${host}`).setLabel('Chiudi').setStyle(ButtonStyle.Danger),
    )],
  };
}

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

const rankLabel = (key) => ranks.find((r) => r.key === key)?.name ?? 'Qualsiasi rank';
const memberRank = (member) => {
  const R = roleMap(member.guild);
  return ranks.find((r) => R[r.key] && member.roles.cache.has(R[r.key].id))?.key ?? null;
};

async function postCard({ guild, user, rank, mode, size = 6, note, ping, channel }) {
  const target = channel ?? channelByKey(guild, mode === 'ranked' ? 'lfg_ranked' : 'lfg_casual');
  if (!target) throw new Error('Canale LFG non trovato. Usa /add-tools.');
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
  await i.reply({ content: `Pubblicata: ${msg.url}`, flags: MessageFlags.Ephemeral });
}

async function partyButton(i) {
  const [, action, host] = i.customId.split(':');
  const state = parse(i.message);

  if (action === 'close') {
    if (i.user.id !== host && !isStaff(i.member)) {
      return i.reply({ content: 'Solo chi ha aperto la card può chiuderla.', flags: MessageFlags.Ephemeral });
    }
    return i.update({
      components: [],
      embeds: [withFooter(EmbedBuilder.from(i.message.embeds[0]).setColor(palette.muted), 'Chiusa')],
    });
  }

  if (action === 'join') {
    if (state.players.includes(i.user.id)) return i.reply({ content: 'Sei già nel party.', flags: MessageFlags.Ephemeral });
    if (state.players.length >= state.size) return i.reply({ content: 'Il party è pieno.', flags: MessageFlags.Ephemeral });
    state.players.push(i.user.id);
  } else {
    if (i.user.id === host) return i.reply({ content: 'Sei il caposquadra, usa Chiudi.', flags: MessageFlags.Ephemeral });
    if (!state.players.includes(i.user.id)) return i.reply({ content: 'Non sei in questo party.', flags: MessageFlags.Ephemeral });
    state.players = state.players.filter((id) => id !== i.user.id);
  }

  await i.update(card({ ...state, host }));
  if (state.players.length >= state.size) {
    await i.channel.send({
      content: `Party al completo! ${state.players.map((id) => `<@${id}>`).join(' ')}`,
      allowedMentions: { users: state.players },
    }).catch(() => {});
  }
}

const drafts = new Map();
const DRAFT_TTL = 15 * 60_000;

const panels = {
  lfg: () => ({
    embeds: [withFooter(baseEmbed(palette.warn)
      .setTitle('Trova la tua squadra')
      .setDescription(
        `Due modi per cercare compagni.\n${LINE}\n` +
        '**Guidato** · premi il pulsante e scegli modalità, rank e dimensione dai menu.\n\n' +
        '**Scrivi e basta** · manda la richiesta qui e il bot la trasforma in una card.\n' +
        '> `cerco 2 ranked archon, sere EU`\n' +
        '> `ranked archon need 2, evenings EU`\n' +
        '> `casual duo, sto imparando Haze`\n' +
        `${LINE}\nInizia il messaggio con \`//\` per chiacchierare senza creare una card.`,
      ))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lfgui:start').setLabel('Cerca squadra').setEmoji('🔎').setStyle(ButtonStyle.Primary),
    )],
  }),
};

function renderDraft(d) {
  const size = { 2: 'Duo (2)', 3: 'Trio (3)', 4: 'Squad (4)', 5: 'Cinque (5)', 6: 'Party intero (6)' };
  return {
    embeds: [withFooter(baseEmbed(d.mode === 'ranked' ? palette.live : palette.warn)
      .setTitle('Prepara la richiesta')
      .setDescription(
        `${LINE}\n` +
        `**Modalità** · ${d.mode === 'ranked' ? 'Ranked' : 'Casual'}\n` +
        `**Rank** · ${rankLabel(d.rank)}\n` +
        `**Party** · ${size[d.size]}\n` +
        `**Nota** · ${d.note || '*nessuna*'}\n` +
        `**Ping** · ${d.ping ? 'Hunters' : 'off'}\n${LINE}`,
      ))],
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lfgui:mode').setPlaceholder('Modalità').addOptions(
        { label: 'Ranked', value: 'ranked', emoji: '🏆', default: d.mode === 'ranked' },
        { label: 'Casual', value: 'casual', emoji: '🎲', default: d.mode === 'casual' },
      )),
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lfgui:rank').setPlaceholder('Rank').addOptions(
        { label: 'Qualsiasi rank', value: 'any', default: !d.rank },
        ...ranks.map((r) => ({ label: r.name, value: r.key, default: d.rank === r.key })),
      )),
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('lfgui:size').setPlaceholder('Dimensione party').addOptions(
        ...Object.entries(size).map(([n, label]) => ({ label, value: n, default: d.size === Number(n) })),
      )),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lfgui:note').setLabel('Aggiungi nota').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lfgui:ping').setLabel(d.ping ? 'Ping: on' : 'Ping: off').setEmoji('🔔').setStyle(d.ping ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lfgui:post').setLabel('Pubblica').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('lfgui:cancel').setLabel('Annulla').setStyle(ButtonStyle.Danger),
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
    return i.reply({ content: 'Questa richiesta è scaduta. Premi di nuovo **Cerca squadra**.', flags: MessageFlags.Ephemeral });
  }
  d.at = Date.now();

  switch (i.customId) {
    case 'lfgui:mode': d.mode = i.values[0]; break;
    case 'lfgui:rank': d.rank = i.values[0] === 'any' ? null : i.values[0]; break;
    case 'lfgui:size': d.size = Number(i.values[0]); break;
    case 'lfgui:ping': d.ping = !d.ping; break;
    case 'lfgui:note':
      return i.showModal(new ModalBuilder().setCustomId('lfgui:notemodal').setTitle('Aggiungi una nota').addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('note').setLabel('Eroe, stile, orario...').setStyle(TextInputStyle.Paragraph)
            .setMaxLength(200).setRequired(false).setValue(d.note || ''),
        ),
      ));
    case 'lfgui:notemodal':
      d.note = i.fields.getTextInputValue('note').trim();
      break;
    case 'lfgui:cancel':
      drafts.delete(i.user.id);
      return i.update({ content: 'Annullata.', embeds: [], components: [] });
    case 'lfgui:post': {
      drafts.delete(i.user.id);
      const msg = await postCard({ guild: i.guild, user: i.user, ...d });
      return i.update({ content: `Pubblicata: ${msg.url}`, embeds: [], components: [] });
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

      const req = parseRequest(m.content, memberRank(m.member), key);
      await postCard({ guild: m.guild, user: m.author, ...req, channel: m.channel });
      await m.delete().catch(() => {});
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, commands, panels };
