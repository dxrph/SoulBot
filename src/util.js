const { PermissionsBitField, PermissionFlagsBits: V, EmbedBuilder } = require('discord.js');
const { roles, categories } = require('./template');
const store = require('./store');
const { withFooter, palette } = require('./style');

const specialNames = {};
const specialOld = {};
for (const cat of categories) {
  for (const c of cat.channels) {
    if (c.special) {
      specialNames[c.special] = c.name;
      if (c.old) specialOld[c.special] = c.old;
    }
  }
}

function findRole(guild, def, savedId) {
  if (savedId) {
    const byId = guild.roles.cache.get(savedId);
    if (byId) return byId;
  }
  return guild.roles.cache.find((r) => r.name === def.name)
    || (def.old && guild.roles.cache.find((r) => def.old.includes(r.name)))
    || null;
}

const roleMap = (guild) => {
  const saved = store.getRoles(guild.id);
  const R = {};
  for (const def of roles) {
    const role = findRole(guild, def, saved[def.key]);
    if (role) R[def.key] = role;
  }
  return R;
};

const channelByKey = (guild, key) => {
  const saved = store.getChannels(guild.id);
  if (saved[key]) {
    const byId = guild.channels.cache.get(saved[key]);
    if (byId) return byId;
  }
  return guild.channels.cache.find((c) => c.name === specialNames[key])
    || guild.channels.cache.find((c) => (specialOld[key] ?? []).includes(c.name))
    || null;
};

function remember(guild) {
  const R = roleMap(guild);
  store.rememberRoles(guild.id, R);
  const channels = {};
  for (const key of Object.keys(specialNames)) {
    const ch = channelByKey(guild, key);
    if (ch) channels[key] = ch;
  }
  store.rememberChannels(guild.id, channels);
  return R;
}

const isStaff = (member) => member.permissions.has(V.ManageMessages);

function mergeOw(list) {
  const map = new Map();
  for (const o of list) {
    const allow = new PermissionsBitField(o.allow ?? 0n).bitfield;
    const deny = new PermissionsBitField(o.deny ?? 0n).bitfield;
    const prev = map.get(o.id) ?? { id: o.id, allow: 0n, deny: 0n };
    map.set(o.id, { id: o.id, allow: (prev.allow | allow) & ~deny, deny: (prev.deny | deny) & ~allow });
  }
  return [...map.values()];
}

async function logEvent(guild, { title, description, color = palette.muted, fields = [], components = [] }) {
  const ch = channelByKey(guild, 'modlog');
  if (!ch) return;
  const embed = withFooter(new EmbedBuilder().setTitle(title).setColor(color).setTimestamp());
  if (description) embed.setDescription(description.slice(0, 4000));
  if (fields.length) embed.addFields(fields.map((f) => ({ ...f, value: String(f.value).slice(0, 1000) || '—' })));
  await ch.send({ embeds: [embed], components }).catch(() => {});
}

module.exports = { roleMap, channelByKey, remember, isStaff, mergeOw, logEvent, specialNames };
