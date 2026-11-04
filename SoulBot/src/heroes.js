// Hero list from the public Deadlock API, cached in memory.
const API = 'https://api.deadlock-api.com/v1/assets/heroes?language=english';
const TTL = 6 * 60 * 60_000;

const CLASSES = {
  marksman: { label: 'Marksmen', emoji: '🎯', color: 0xe74c3c, blurb: 'Raw gun power. Win fights by out-shooting everyone.' },
  mystic: { label: 'Mystics', emoji: '🔮', color: 0x9b59b6, blurb: 'Spirit damage and utility. Bend the fight with abilities.' },
  brawler: { label: 'Brawlers', emoji: '🛡️', color: 0xe67e22, blurb: 'Tough and in your face. Hold the front line.' },
  assassin: { label: 'Assassins', emoji: '🗡️', color: 0x1abc9c, blurb: 'Fast and lethal. Pick off targets and vanish.' },
};

let cache = { at: 0, list: null };

async function getHeroes() {
  if (cache.list && Date.now() - cache.at < TTL) return cache.list;
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`heroes API ${res.status}`);
    const list = (await res.json())
      .filter((h) => h.player_selectable && !h.disabled && !h.in_development && !h.needs_testing)
      .sort((a, b) => a.name.localeCompare(b.name));
    cache = { at: Date.now(), list };
  } catch (err) {
    if (!cache.list) throw err; // nothing cached: let the caller handle it
    console.error('heroes refresh failed, using cache:', err.message);
  }
  return cache.list;
}

// Heroes of one class, split in chunks of 25 (the select menu limit)
const byClass = (heroes, type) => heroes.filter((h) => h.hero_type === type);
const chunk = (arr, n = 25) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// One role per hero ("mains"), created on demand
async function ensureHeroRoles(guild) {
  const heroes = await getHeroes();
  await guild.roles.fetch();
  for (const h of heroes) {
    if (guild.roles.cache.some((r) => r.name === h.name)) continue;
    const color = h.colors?.style_hex ? parseInt(h.colors.style_hex.slice(1), 16) : 0x95a5a6;
    await guild.roles.create({ name: h.name, color, reason: 'Hero main role' }).catch((e) => console.warn('hero role', h.name, e.message));
  }
  return heroes;
}

module.exports = { getHeroes, ensureHeroRoles, byClass, chunk, CLASSES };
