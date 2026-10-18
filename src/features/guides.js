const {
  EmbedBuilder, SlashCommandBuilder, ChannelType, ChannelFlags, SortOrderType, MessageFlags, PermissionFlagsBits: V,
} = require('discord.js');
const { channelByKey, roleMap } = require('../util');
const { CLASSES } = require('../heroes');

// Hero and build guides: one forum post per hero, filled from the public Deadlock API.
// English and Italian forums use the game's own localization, so no translator is needed.

const API = 'https://api.deadlock-api.com';
const REFRESH_MS = 12 * 60 * 60_000;
const BUILDS_PER_HERO = 3;

const LANGS = {
  en: { api: 'english', buildLang: 'English', heroes: 'heroes_en', builds: 'builds_en' },
  it: { api: 'italian', buildLang: 'Italian', heroes: 'heroes_it', builds: 'builds_it' },
};

const L = {
  en: {
    class: 'Class', complexity: 'Complexity', traits: 'Traits', abilities: 'Abilities', stats: 'Base stats',
    health: 'Health', speed: 'Move speed', stamina: 'Stamina', melee: 'Melee', lore: 'Lore',
    noBuilds: 'No community builds yet.', favorites: 'favorites',
    types: { marksman: 'Marksman', mystic: 'Mystic', brawler: 'Brawler', assassin: 'Assassin' },
  },
  it: {
    class: 'Classe', complexity: 'Complessità', traits: 'Caratteristiche', abilities: 'Abilità', stats: 'Statistiche base',
    health: 'Salute', speed: 'Velocità', stamina: 'Stamina', melee: 'Mischia', lore: 'Storia',
    noBuilds: 'Ancora nessuna build della community.', favorites: 'preferiti',
    types: { marksman: 'Tiratore', mystic: 'Mistico', brawler: 'Lottatore', assassin: 'Assassino' },
  },
};

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
const plain = (s) => (s ?? '').replace(/<[^>]*>/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

// ---- hero cards -----------------------------------------------------------------------------
function heroEmbeds(hero, itemsByClass, lang) {
  const t = L[lang];
  const stat = (k) => hero.starting_stats?.[k]?.value;
  const abilities = ['signature1', 'signature2', 'signature3', 'signature4']
    .map((k, idx) => itemsByClass.get(hero.items?.[k])?.name && `**${idx + 1}.** ${itemsByClass.get(hero.items[k]).name}`)
    .filter(Boolean);
  const color = hero.colors?.style_hex ? parseInt(hero.colors.style_hex.slice(1), 16) : 0xe67e22;

  const card = new EmbedBuilder()
    .setColor(color)
    .setTitle(hero.name)
    .setDescription(clip(`*${hero.description?.role ?? ''}*\n\n${hero.description?.playstyle ?? ''}`, 1800))
    .setThumbnail(hero.images?.icon_hero_card ?? null)
    .addFields(
      { name: t.class, value: t.types[hero.hero_type] ?? hero.hero_type ?? '—', inline: true },
      { name: t.complexity, value: '🟧'.repeat(hero.complexity ?? 1) + '⬛'.repeat(Math.max(0, 4 - (hero.complexity ?? 1))), inline: true },
      { name: t.traits, value: (hero.tags ?? []).join(' · ') || '—', inline: true },
      { name: t.abilities, value: abilities.join('\n') || '—' },
      {
        name: t.stats,
        value: `❤️ ${t.health}: **${stat('max_health') ?? '?'}**  ·  🏃 ${t.speed}: **${stat('max_move_speed') ?? '?'}**  ·  ⚡ ${t.stamina}: **${stat('stamina') ?? '?'}**  ·  🗡️ ${t.melee}: **${stat('light_melee_damage') ?? '?'}**`,
      },
    );

  const embeds = [card];
  const lore = plain(hero.description?.lore);
  if (lore) embeds.push(new EmbedBuilder().setColor(color).setTitle(t.lore).setDescription(clip(lore, 3500)));
  return embeds;
}

// ---- build cards ----------------------------------------------------------------------------
function buildEmbed(entry, itemsById, lang, color) {
  const b = entry.hero_build;
  const fields = [];
  for (const cat of (b.details?.mod_categories ?? []).slice(0, 6)) {
    const names = (cat.mods ?? []).map((m) => itemsById.get(m.ability_id)?.name).filter(Boolean);
    if (names.length) fields.push({ name: clip(cat.name || '—', 100), value: clip(names.join(' › '), 400) });
  }
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(clip(b.name || 'Build', 200))
    .setFooter({ text: `❤️ ${entry.num_favorites} ${L[lang].favorites}` });
  const desc = clip(plain(b.description), 350);
  if (desc) e.setDescription(desc);
  if (fields.length) e.addFields(fields);
  return e;
}

async function topBuilds(heroId, lang) {
  const q = (language) => get(`/v1/builds?hero_id=${heroId}&build_language=${language}&only_latest=true&sort_by=weekly_favorites&sort_direction=desc&limit=${BUILDS_PER_HERO}`);
  let list = await q(LANGS[lang].buildLang).catch(() => []);
  if (lang === 'it' && list.length < BUILDS_PER_HERO) { // not enough Italian builds: top up with the best English ones
    const more = await q('English').catch(() => []);
    list = [...list, ...more.filter((m) => !list.some((x) => x.hero_build.hero_build_id === m.hero_build.hero_build_id))];
  }
  return list.filter((b) => b.hero_build.details?.mod_categories?.length).slice(0, BUILDS_PER_HERO);
}

// ---- forum plumbing -------------------------------------------------------------------------
const signature = (embeds) => JSON.stringify(embeds.map((e) => {
  const j = e.toJSON ? e.toJSON() : e;
  return [j.title, j.description, (j.fields ?? []).map((f) => [f.name, f.value]), j.footer?.text];
}));

// Every post of the forum by name. If Discord fails to answer this throws on purpose:
// an empty list would make the bot recreate all posts as duplicates.
async function existingThreads(forum) {
  const map = new Map();
  (await forum.threads.fetchActive()).threads.forEach((t) => map.set(t.name, t));
  let before;
  for (let page = 0; page < 10; page += 1) {
    const res = await forum.threads.fetchArchived({ limit: 100, before });
    res.threads.forEach((t) => { if (!map.has(t.name)) map.set(t.name, t); });
    if (!res.hasMore || !res.threads.size) break;
    before = res.threads.last();
  }
  return map;
}

// ---- forum setup: permissions, guidelines, tags, default reaction, sort order -----------------
const GUIDE_POST = { en: '📌 Read me first', it: '📌 Leggimi' };

const FORUM_TEXT = {
  heroes: {
    en: {
      topic: 'Hero guides: one post per hero with abilities, base stats and lore.\n' +
        '• Reply inside a post to discuss that hero (tips, matchups, mains).\n' +
        '• Use the class tags to filter heroes. React with ⭐ to mark your favorites.\n' +
        '• Stay on topic: builds go in Build Guides, looking for a team in looking-for-group.\n' +
        '• Be respectful. Posts are created and updated by the bot.',
      title: '📌 READ ME FIRST · HERO GUIDES',
      lines: [
        ['📖 What is this', 'One post per hero with abilities, base stats and lore, straight from the game data. The bot keeps them up to date.'],
        ['💬 How to use it', 'Open a hero and reply to share tips, matchups and tricks. Filter the list with the **class tags** at the top.'],
        ['⭐ Favorites', 'React to a post with ⭐ to show which heroes the community loves.'],
        ['🧭 Stay on topic', 'Replies should be about that hero. Builds go in **Build Guides**, teams in **looking-for-group**.'],
      ],
    },
    it: {
      topic: 'Guide agli eroi: un post per eroe con abilità, statistiche base e storia.\n' +
        '• Rispondi dentro un post per parlare di quell\'eroe (consigli, matchup, main).\n' +
        '• Usa i tag delle classi per filtrare. Reagisci con ⭐ per segnare i tuoi preferiti.\n' +
        '• Resta in tema: le build vanno in Guida Build, la ricerca squadra in looking-for-group.\n' +
        '• Sii rispettoso. I post sono creati e aggiornati dal bot.',
      title: '📌 LEGGIMI · GUIDA AGLI EROI',
      lines: [
        ['📖 Cos\'è', 'Un post per eroe con abilità, statistiche base e storia, presi dai dati del gioco. Il bot li tiene aggiornati.'],
        ['💬 Come si usa', 'Apri un eroe e rispondi per condividere consigli, matchup e trucchi. Filtra la lista con i **tag delle classi** in alto.'],
        ['⭐ Preferiti', 'Reagisci a un post con ⭐ per mostrare quali eroi ama la community.'],
        ['🧭 Resta in tema', 'Le risposte devono riguardare quell\'eroe. Le build vanno in **Guida Build**, i team in **looking-for-group**.'],
      ],
    },
    emoji: '⭐',
  },
  builds: {
    en: {
      topic: 'Build guides: the most loved community builds of the week for every hero, updated every 12 hours.\n' +
        '• Reply inside a post to rate, compare or suggest tweaks to a build.\n' +
        '• Use the class tags to filter heroes. React with 🔥 for builds that work.\n' +
        '• Item sections are named by each build author. Build order inside a section is left to right.\n' +
        '• Be respectful. Posts are created and updated by the bot.',
      title: '📌 READ ME FIRST · BUILD GUIDES',
      lines: [
        ['🛒 What is this', 'For each hero, the top community builds of the week (most favorited in game). Updated automatically every 12 hours.'],
        ['🧱 Reading a build', 'Each section is a phase of the game named by the build author. Items are listed in the order to buy them: `A › B › C`.'],
        ['💬 Discuss', 'Reply to rate a build, compare it with another or suggest changes. Test it in game before judging!'],
        ['🔥 Reactions', 'React with 🔥 to the builds that work for you.'],
      ],
    },
    it: {
      topic: 'Guida alle build: le build della community più amate della settimana per ogni eroe, aggiornate ogni 12 ore.\n' +
        '• Rispondi dentro un post per valutare, confrontare o suggerire modifiche a una build.\n' +
        '• Usa i tag delle classi per filtrare. Reagisci con 🔥 alle build che funzionano.\n' +
        '• Le sezioni di oggetti sono nominate dall\'autore della build. L\'ordine è da sinistra a destra.\n' +
        '• Sii rispettoso. I post sono creati e aggiornati dal bot.',
      title: '📌 LEGGIMI · GUIDA ALLE BUILD',
      lines: [
        ['🛒 Cos\'è', 'Per ogni eroe, le build della community più amate della settimana (più preferite in gioco). Si aggiorna da sola ogni 12 ore.'],
        ['🧱 Leggere una build', 'Ogni sezione è una fase di gioco scelta dall\'autore. Gli oggetti sono nell\'ordine d\'acquisto: `A › B › C`.'],
        ['💬 Discutine', 'Rispondi per valutare una build, confrontarla con un\'altra o suggerire modifiche. Provala in gioco prima di giudicare!'],
        ['🔥 Reazioni', 'Reagisci con 🔥 alle build che funzionano per te.'],
      ],
    },
    emoji: '🔥',
  },
};

// Recommended forum permissions: members read, react and reply inside posts but never start posts
async function setForumPermissions(guild, forum) {
  const R = roleMap(guild);
  const edit = (role, perms) => role && forum.permissionOverwrites.edit(role, perms).catch((e) => console.warn('forum perms', e.message));
  await edit(guild.roles.everyone, { CreatePublicThreads: false, CreatePrivateThreads: false, ManageThreads: false });
  await edit(R.player, {
    ViewChannel: true, ReadMessageHistory: true, SendMessagesInThreads: true, AddReactions: true,
    EmbedLinks: true, AttachFiles: true, UseExternalEmojis: true,
    CreatePublicThreads: false, CreatePrivateThreads: false, ManageThreads: false,
  });
  await edit(R.muted, { SendMessagesInThreads: false, AddReactions: false });
  for (const staff of [R.mod, R.admin, R.owner]) {
    await edit(staff, { CreatePublicThreads: true, SendMessagesInThreads: true, ManageThreads: true, ManageMessages: true });
  }
}

async function setupForum(guild, forum, kind, lang, heroes) {
  const text = FORUM_TEXT[kind][lang];
  await setForumPermissions(guild, forum);

  // Class tags with emoji; only staff and the bot can apply them
  const tagOf = (h) => ({ name: (L[lang].types[h.hero_type] ?? h.hero_type).slice(0, 20), emoji: CLASSES[h.hero_type]?.emoji });
  const wanted = new Map(heroes.map((h) => [tagOf(h).name, tagOf(h)]));
  const have = new Set(forum.availableTags.map((t) => t.name));
  const missing = [...wanted.values()].filter((t) => !have.has(t.name));
  if (missing.length) {
    await forum.setAvailableTags([
      ...forum.availableTags.map((t) => ({ id: t.id, name: t.name, moderated: t.moderated, emoji: t.emoji })),
      ...missing.map((t) => ({ name: t.name, moderated: true, emoji: t.emoji ? { id: null, name: t.emoji } : null })),
    ]).catch(console.error);
  }

  // Guidelines (topic), default reaction and sort order
  if (forum.topic !== text.topic) await forum.setTopic(text.topic).catch(console.error);
  if (forum.defaultReactionEmoji?.name !== FORUM_TEXT[kind].emoji) {
    await forum.setDefaultReactionEmoji({ id: null, name: FORUM_TEXT[kind].emoji }).catch(console.error);
  }
  if (forum.defaultSortOrder !== SortOrderType.CreationDate) await forum.setDefaultSortOrder(SortOrderType.CreationDate).catch(console.error);
}

// The pinned "read me" post, always first in the list
async function ensureGuidePost(forum, threads, kind, lang) {
  const text = FORUM_TEXT[kind][lang];
  const embed = new EmbedBuilder()
    .setColor(kind === 'heroes' ? 0xe67e22 : 0xe74c3c)
    .setTitle(text.title)
    .addFields(text.lines.map(([name, value]) => ({ name, value })));
  const name = GUIDE_POST[lang];
  await upsertPost(forum, threads, name, [embed]);
  const thread = threads.get(name);
  if (thread && !thread.flags.has(ChannelFlags.Pinned)) await thread.pin('Guide post').catch((e) => console.warn('pin', e.message));
}

// Creates the post, or refreshes its first message when the content changed
async function upsertPost(forum, threads, name, embeds, tagNames = []) {
  const thread = threads.get(name);
  if (thread) {
    const first = await thread.fetchStarterMessage().catch(() => null);
    if (!first || first.author.id !== forum.client.user.id) return 'skipped';
    if (signature(first.embeds) === signature(embeds)) return 'same';
    await first.edit({ embeds }).catch(console.error);
    return 'updated';
  }
  const appliedTags = forum.availableTags.filter((t) => tagNames.includes(t.name)).map((t) => t.id);
  threads.set(name, await forum.threads.create({ name, message: { embeds }, appliedTags }));
  return 'created';
}

async function syncLang(guild, lang) {
  const cfg = LANGS[lang];
  const heroesForum = channelByKey(guild, cfg.heroes);
  const buildsForum = channelByKey(guild, cfg.builds);
  if (heroesForum?.type !== ChannelType.GuildForum && buildsForum?.type !== ChannelType.GuildForum) return null;

  const [heroesRaw, items] = await Promise.all([
    get(`/v1/assets/heroes?language=${cfg.api}`),
    get(`/v1/assets/items?language=${cfg.api}`),
  ]);
  const heroes = heroesRaw
    .filter((h) => h.player_selectable && !h.disabled && !h.in_development && !h.needs_testing)
    .sort((a, b) => a.name.localeCompare(b.name));
  const byClass = new Map(items.map((i) => [i.class_name, i]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const stats = { created: 0, updated: 0, same: 0, skipped: 0 };
  const count = (r) => { stats[r] = (stats[r] ?? 0) + 1; };

  if (heroesForum?.type === ChannelType.GuildForum) {
    const typeName = (h) => L[lang].types[h.hero_type] ?? h.hero_type;
    await setupForum(guild, heroesForum, 'heroes', lang, heroes);
    const threads = await existingThreads(heroesForum);
    await ensureGuidePost(heroesForum, threads, 'heroes', lang).catch((e) => console.error('guide post', e.message));
    // newest-first sort: creating Z..A makes the list read A..Z
    for (const h of [...heroes].reverse()) {
      count(await upsertPost(heroesForum, threads, h.name, heroEmbeds(h, byClass, lang), [typeName(h)]).catch((e) => { console.error(h.name, e.message); return 'skipped'; }));
    }
  }

  if (buildsForum?.type === ChannelType.GuildForum) {
    const typeName = (h) => L[lang].types[h.hero_type] ?? h.hero_type;
    await setupForum(guild, buildsForum, 'builds', lang, heroes);
    const threads = await existingThreads(buildsForum);
    await ensureGuidePost(buildsForum, threads, 'builds', lang).catch((e) => console.error('guide post', e.message));
    for (const h of [...heroes].reverse()) {
      try {
        const color = h.colors?.style_hex ? parseInt(h.colors.style_hex.slice(1), 16) : 0xe67e22;
        const list = await topBuilds(h.id, lang);
        const embeds = list.length
          ? list.map((b) => buildEmbed(b, byId, lang, color))
          : [new EmbedBuilder().setColor(color).setTitle(h.name).setDescription(L[lang].noBuilds)];
        count(await upsertPost(buildsForum, threads, h.name, embeds, [typeName(h)]));
      } catch (e) {
        console.error('builds', h.name, e.message);
        count('skipped');
      }
    }
  }
  return stats;
}

let running = false;
async function syncAll(client) {
  if (running) return null;
  running = true;
  const report = [];
  try {
    for (const guild of client.guilds.cache.values()) {
      for (const lang of Object.keys(LANGS)) {
        const s = await syncLang(guild, lang).catch((e) => { console.error('guides', lang, e.message); return null; });
        if (s) report.push(`${lang.toUpperCase()}: ${s.created} new, ${s.updated} updated, ${s.same} unchanged`);
      }
    }
  } finally {
    running = false;
  }
  return report;
}

const commands = [
  new SlashCommandBuilder()
    .setName('sync-guides')
    .setDescription('Fill or refresh the hero and build forums now')
    .setDefaultMemberPermissions(V.Administrator).setDMPermission(false),
].map((c) => c.toJSON());

function init(client) {
  client.once('clientReady', () => {
    const run = () => syncAll(client).catch(console.error);
    setTimeout(run, 45_000);
    setInterval(run, REFRESH_MS).unref();
  });

  client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand() || i.commandName !== 'sync-guides') return;
    try {
      if (running) return await i.reply({ content: 'A sync is already running. Try again in a few minutes.', flags: MessageFlags.Ephemeral });
      await i.reply({ content: '⏳ Syncing heroes and builds (a few minutes the first time)...', flags: MessageFlags.Ephemeral });
      client.emit('patchesCheck');
      const report = await syncAll(client);
      await i.editReply(report?.length ? `✅ Done.\n${report.join('\n')}` : '⚠️ No hero/build forums found. Run /add-tools first.');
    } catch (err) {
      console.error(err);
      await i.editReply(`❌ ${err.message}`).catch(() => {});
    }
  });
}

module.exports = { init, commands };
