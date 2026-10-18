const {
  EmbedBuilder, SlashCommandBuilder, ChannelType, MessageFlags, PermissionFlagsBits: V,
} = require('discord.js');
const { channelByKey } = require('../util');

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

async function existingThreads(forum) {
  const map = new Map();
  const active = await forum.threads.fetchActive().catch(() => null);
  active?.threads.forEach((t) => map.set(t.name, t));
  const archived = await forum.threads.fetchArchived({ limit: 100 }).catch(() => null);
  archived?.threads.forEach((t) => { if (!map.has(t.name)) map.set(t.name, t); });
  return map;
}

async function ensureTags(forum, names) {
  const have = new Set(forum.availableTags.map((t) => t.name));
  const missing = [...new Set(names)].filter((n) => !have.has(n));
  if (!missing.length) return;
  await forum.setAvailableTags([...forum.availableTags, ...missing.map((name) => ({ name: name.slice(0, 20) }))]).catch(console.error);
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
  await forum.threads.create({ name, message: { embeds }, appliedTags });
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
    await ensureTags(heroesForum, heroes.map(typeName));
    const threads = await existingThreads(heroesForum);
    for (const h of heroes) {
      count(await upsertPost(heroesForum, threads, h.name, heroEmbeds(h, byClass, lang), [typeName(h)]).catch((e) => { console.error(h.name, e.message); return 'skipped'; }));
    }
  }

  if (buildsForum?.type === ChannelType.GuildForum) {
    const typeName = (h) => L[lang].types[h.hero_type] ?? h.hero_type;
    await ensureTags(buildsForum, heroes.map(typeName));
    const threads = await existingThreads(buildsForum);
    for (const h of heroes) {
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
      const report = await syncAll(client);
      await i.editReply(report?.length ? `✅ Done.\n${report.join('\n')}` : '⚠️ No hero/build forums found. Run /add-tools first.');
    } catch (err) {
      console.error(err);
      await i.editReply(`❌ ${err.message}`).catch(() => {});
    }
  });
}

module.exports = { init, commands };
