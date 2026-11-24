// Small JSON store for role/channel IDs and feature state.
// On Railway the filesystem is ephemeral, so IDs are also refreshed on /add-tools and at startup.
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { guilds: {} };
  }
}

function save(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('store save failed:', err.message);
  }
}

function entry(guildId) {
  const data = load();
  data.guilds[guildId] ??= {
    roles: {},
    channels: {},
    heroRoles: {},
    anime: null,
    lastClipWeek: null,
    decapiFails: 0,
  };
  return { data, g: data.guilds[guildId] };
}

function getRoles(guildId) {
  return entry(guildId).g.roles ?? {};
}

function getChannels(guildId) {
  return entry(guildId).g.channels ?? {};
}

function getHeroRoles(guildId) {
  return entry(guildId).g.heroRoles ?? {};
}

function rememberRoles(guildId, map) {
  const { data, g } = entry(guildId);
  for (const [key, role] of Object.entries(map)) {
    if (role?.id) g.roles[key] = role.id;
  }
  save(data);
}

function rememberChannels(guildId, map) {
  const { data, g } = entry(guildId);
  for (const [key, ch] of Object.entries(map)) {
    if (ch?.id) g.channels[key] = ch.id;
  }
  save(data);
}

function rememberHeroRoles(guildId, map) {
  const { data, g } = entry(guildId);
  g.heroRoles = { ...(g.heroRoles ?? {}), ...map };
  save(data);
}

function getAnime(guildId) {
  return entry(guildId).g.anime ?? null;
}

function setAnime(guildId, anime) {
  const { data, g } = entry(guildId);
  g.anime = anime;
  save(data);
}

function getLastClipWeek(guildId) {
  return entry(guildId).g.lastClipWeek ?? null;
}

function setLastClipWeek(guildId, week) {
  const { data, g } = entry(guildId);
  g.lastClipWeek = week;
  save(data);
}

function decapiFail(guildId, ok) {
  const { data, g } = entry(guildId);
  g.decapiFails = ok ? 0 : (g.decapiFails ?? 0) + 1;
  save(data);
  return g.decapiFails;
}

module.exports = {
  load, getRoles, getChannels, getHeroRoles,
  rememberRoles, rememberChannels, rememberHeroRoles,
  getAnime, setAnime, getLastClipWeek, setLastClipWeek, decapiFail,
};
