// Hero list from the public Deadlock API, cached in memory.
const API = 'https://api.deadlock-api.com/v1/assets/heroes?language=english';
const TTL = 6 * 60 * 60_000;
const { roles } = require('./template');
const store = require('./store');

const CLASSES = {
  marksman: { label: 'Tiratori', emoji: '🎯', color: 0xe74c3c, blurb: 'Potenza di fuoco. Vinci gli scontri sparando meglio di tutti.' },
  mystic: { label: 'Mistici', emoji: '🔮', color: 0x7C4DFF, blurb: 'Danno spirit e utilità. Piega lo scontro con le abilità.' },
  brawler: { label: 'Lottatori', emoji: '🛡️', color: 0xe67e22, blurb: 'Resistenti e in prima linea. Tengono il fronte.' },
  assassin: { label: 'Assassini', emoji: '🗡️', color: 0x1abc9c, blurb: 'Veloci e letali. Colpiscono e spariscono.' },
  healer: { label: 'Curatori', emoji: '💚', color: 0x2ECC71, blurb: 'Tengono in vita la squadra e voltano i fight.' },
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
    if (!cache.list) throw err;
    console.error('heroes refresh failed, using cache:', err.message);
  }
  return cache.list;
}

const byClass = (heroes, type) => heroes.filter((h) => h.hero_type === type);
const chunk = (arr, n = 25) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const templateNames = () => {
  const set = new Set();
  for (const def of roles) {
    set.add(def.name);
    for (const old of def.old ?? []) set.add(old);
  }
  return set;
};

async function ensureHeroRoles(guild) {
  const heroes = await getHeroes();
  await guild.roles.fetch();
  const saved = {};
  for (const h of heroes) {
    let role = guild.roles.cache.find((r) => r.name === h.name);
    if (!role) {
      const color = h.colors?.style_hex ? parseInt(h.colors.style_hex.slice(1), 16) : 0x95a5a6;
      role = await guild.roles.create({ name: h.name, color, reason: 'Hero main role' }).catch((e) => {
        console.warn('hero role', h.name, e.message);
        return null;
      });
    }
    if (role) saved[h.name] = role.id;
  }
  store.rememberHeroRoles(guild.id, saved);
  return heroes;
}

// Tracked hero roles (and names we have seen) that are no longer in the live API.
async function orphanHeroRoles(guild) {
  const heroes = new Set((await getHeroes()).map((h) => h.name));
  const reserved = templateNames();
  await guild.roles.fetch();
  const tracked = store.getHeroRoles(guild.id);
  const out = [];
  for (const [name, id] of Object.entries(tracked)) {
    if (heroes.has(name)) continue;
    const role = guild.roles.cache.get(id) || guild.roles.cache.find((r) => r.name === name);
    if (role && !role.managed && role.id !== guild.id && !reserved.has(role.name)) out.push(role);
  }
  return out;
}

module.exports = { getHeroes, ensureHeroRoles, orphanHeroRoles, byClass, chunk, CLASSES };
