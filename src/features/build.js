// /build <eroe>: the top build of a hero, taken from the post with the hero's name in 🛒┃build-guides
// (or 🇮🇹┃guida-build with lingua: italiano). Shows the first build card and a button to the post.
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ChannelType,
} = require('discord.js');
const { settings } = require('../template');
const { channelByKey } = require('../util');
const { guildSlash } = require('../slash');
const { palette, withFooter } = require('../style');
const { getHeroes } = require('../heroes');

const CFG = settings.build;

const commands = [
  guildSlash('build', 'La build più votata di un eroe, dal forum delle build')
    .addStringOption((o) => o.setName('eroe').setDescription('Nome dell\'eroe').setRequired(true).setAutocomplete(true).setMaxLength(50))
    .addStringOption((o) => o.setName('lingua').setDescription('Forum da usare (predefinito: inglese)')
      .addChoices({ name: 'English (build-guides)', value: 'en' }, { name: 'Italiano (guida-build)', value: 'it' })),
].map((c) => c.toJSON());

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

// Best thread for a typed name: exact match, then starts with, then contains
function pickThread(names, typed) {
  const q = norm(typed);
  if (!q) return null;
  return names.find((n) => norm(n) === q) ?? names.find((n) => norm(n).startsWith(q)) ?? names.find((n) => norm(n).includes(q)) ?? null;
}

async function threadsOf(forum) {
  const map = new Map();
  const active = await forum.threads.fetchActive().catch(() => null);
  active?.threads.forEach((t) => { if (t.parentId === forum.id) map.set(t.name, t); });
  let before;
  for (let page = 0; page < 5; page += 1) {
    const res = await forum.threads.fetchArchived({ limit: 100, before }).catch(() => null);
    if (!res) break;
    res.threads.forEach((t) => { if (!map.has(t.name)) map.set(t.name, t); });
    if (!res.hasMore || !res.threads.size) break;
    before = res.threads.last();
  }
  return map;
}

async function build(i) {
  if (!CFG.enabled) return i.reply({ content: '/build è spento.', flags: MessageFlags.Ephemeral });
  const lang = i.options.getString('lingua') ?? 'en';
  const forum = channelByKey(i.guild, lang === 'it' ? 'builds_it' : 'builds_en');
  if (forum?.type !== ChannelType.GuildForum) return i.reply({ content: 'Il forum delle build non c\'è ancora: lo staff deve usare /add-tools e /sync-guides.', flags: MessageFlags.Ephemeral });
  await i.deferReply();
  const threads = await threadsOf(forum);
  const name = pickThread([...threads.keys()].filter((n) => !n.startsWith('📌')), i.options.getString('eroe'));
  if (!name) return i.editReply(`Nessuna build trovata per **${i.options.getString('eroe')}**. Controlla il nome (anche Sukuna sbaglia, a volte).`);
  const thread = threads.get(name);
  const starter = await thread.fetchStarterMessage().catch(() => null);
  const card = starter?.embeds?.[0];
  const embed = card
    ? EmbedBuilder.from(card).setAuthor({ name: `Build · ${name}` }).setURL(thread.url)
    : withFooter(new EmbedBuilder().setColor(palette.primary).setTitle(`Build · ${name}`).setDescription('Apri il post per vedere le build.'));
  const more = (starter?.embeds?.length ?? 0) - 1;
  return i.editReply({
    content: more > 0 ? `La più votata di **${name}**. Nel post ce ne sono altre ${more}.` : undefined,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Apri il post').setEmoji('🛒').setStyle(ButtonStyle.Link).setURL(thread.url),
    )],
  });
}

async function autocomplete(i) {
  const typed = norm(i.options.getFocused() ?? '');
  // never wait for a slow API: autocomplete must answer within 3 seconds
  const heroes = await Promise.race([getHeroes().catch(() => []), new Promise((r) => { setTimeout(() => r([]), 2000); })]);
  const list = heroes.map((h) => h.name).filter((n) => !typed || norm(n).includes(typed)).slice(0, 25);
  return i.respond(list.map((n) => ({ name: n, value: n }))).catch(() => {});
}

async function onInteraction(i) {
  if (i.commandName !== 'build') return undefined;
  try {
    if (i.isAutocomplete()) return await autocomplete(i);
    if (i.isChatInputCommand()) return await build(i);
  } catch (err) {
    console.error(err);
    if (i.deferred) await i.editReply('Non sono riuscito a leggere il forum, riprova tra poco.').catch(() => {});
  }
  return undefined;
}

module.exports = { onInteraction, commands, pickThread };
