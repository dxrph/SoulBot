const { PermissionsBitField, PermissionFlagsBits: V, EmbedBuilder } = require('discord.js');
const { roles, categories } = require('./template');

const specialNames = {};
for (const cat of categories) for (const c of cat.channels) if (c.special) specialNames[c.special] = c.name;

const roleMap = (guild) => {
  const R = {};
  for (const def of roles) R[def.key] = guild.roles.cache.find((r) => r.name === def.name);
  return R;
};

const channelByKey = (guild, key) => guild.channels.cache.find((c) => c.name === specialNames[key]);

const isStaff = (member) => member.permissions.has(V.ManageMessages);

// Merges overwrites with the same id (later entries win) into {id, allow, deny} bitfields
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

// Posts an embed in the mod-log channel (if it exists)
async function logEvent(guild, { title, description, color = 0x95a5a6, fields = [] }) {
  const ch = channelByKey(guild, 'modlog');
  if (!ch) return;
  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
  if (description) embed.setDescription(description.slice(0, 4000));
  if (fields.length) embed.addFields(fields.map((f) => ({ ...f, value: String(f.value).slice(0, 1000) || '—' })));
  await ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { roleMap, channelByKey, isStaff, mergeOw, logEvent, specialNames };
