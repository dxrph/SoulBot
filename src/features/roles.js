const {
  ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap } = require('../util');
const { getHeroes, ensureHeroRoles, byClass, chunk, CLASSES } = require('../heroes');

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
const MAX_MAINS = 5;

const GROUPS = {
  rank: { placeholder: '⚔️ Choose your rank', max: 1, color: 0xf1c40f, title: '⚔️ YOUR RANK',
    text: 'Pick the rank you play at right now. Climbing? Come back and change it.' },
  region: { placeholder: '🌍 Choose your region(s)', max: 3, color: 0x3498db, title: '🌍 YOUR REGION',
    text: 'Find teammates who share your ping and your time zone. You can pick more than one.' },
  extra: { placeholder: '🐺 Toggle party pings', max: 1, color: 0xf39c12, title: '🐺 PARTY PINGS',
    text: 'Pick **Hunting for Party** to be pinged when someone needs a teammate. Pick nothing to turn it off.' },
};

const inGroup = (g) => roles.filter((r) => r.group === g);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');

function groupMessage(group) {
  const g = GROUPS[group];
  const list = group === 'rank'
    ? inGroup('rank').map((r) => r.name).join('\n')
    : inGroup(group).map((r) => `• ${r.name}`).join('\n');
  return {
    embeds: [new EmbedBuilder().setColor(g.color).setTitle(g.title).setDescription(`${g.text}\n${LINE}\n${list}`)],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`roles:${group}`)
        .setPlaceholder(g.placeholder)
        .setMinValues(0)
        .setMaxValues(Math.min(g.max, inGroup(group).length))
        .addOptions(inGroup(group).map((r) => ({ label: r.name, value: r.key }))),
    )],
  };
}

function heroMessages(heroes) {
  const out = [];
  for (const [type, c] of Object.entries(CLASSES)) {
    const list = byClass(heroes, type);
    if (!list.length) continue;
    const chunks = chunk(list);
    chunks.forEach((part, idx) => {
      const lines = part.map((h) => `**${h.name}** · ${clip(h.description?.role, 60)}`).join('\n');
      const e = new EmbedBuilder()
        .setColor(c.color)
        .setTitle(`${c.emoji} ${c.label.toUpperCase()}${chunks.length > 1 ? ` (${idx + 1}/${chunks.length})` : ''}`)
        .setDescription(`${c.blurb}\n${LINE}\n${lines}`);
      out.push({
        embeds: [e],
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`heroes:${type}:${idx}`)
            .setPlaceholder(`${c.emoji} Pick your ${c.label.toLowerCase()} mains (up to ${MAX_MAINS})`)
            .setMinValues(0)
            .setMaxValues(Math.min(MAX_MAINS, part.length))
            .addOptions(part.map((h) => ({ label: h.name, value: h.name, description: clip(h.description?.role, 100) || undefined }))),
        )],
      });
    });
  }
  return out;
}

const panels = {
  roles: async (guild) => {
    const heroes = await ensureHeroRoles(guild); // creates one role per hero if missing
    const intro = {
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🎭 CHOOSE YOUR PATH')
        .setDescription(
          `Shape how the server sees you.\n${LINE}\n` +
          '**1 ·** Pick your **rank**\n**2 ·** Pick your **region**\n**3 ·** Pick your **hero mains**\n' +
          `${LINE}\nEverything is a menu below. Change it any time, nothing is permanent.`,
        )],
    };
    return [intro, groupMessage('rank'), groupMessage('region'), groupMessage('extra'), ...heroMessages(heroes)];
  },
};

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isStringSelectMenu()) return;
    const [kind, a, b] = i.customId.split(':');
    if (kind !== 'roles' && kind !== 'heroes') return;
    try {
      let all; let wanted;
      if (kind === 'roles') {
        const R = roleMap(i.guild);
        all = inGroup(a).map((r) => R[r.key]);
        wanted = i.values.map((k) => R[k]);
      } else {
        const part = chunk(byClass(await getHeroes(), a))[Number(b)] ?? [];
        const find = (name) => i.guild.roles.cache.find((r) => r.name === name);
        all = part.map((h) => find(h.name));
        wanted = i.values.map(find);
      }
      all = all.filter(Boolean);
      wanted = wanted.filter(Boolean);
      const remove = all.filter((r) => i.member.roles.cache.has(r.id) && !wanted.includes(r));
      const add = wanted.filter((r) => !i.member.roles.cache.has(r.id));
      if (remove.length) await i.member.roles.remove(remove);
      if (add.length) await i.member.roles.add(add);
      await i.reply({
        content: wanted.length ? `✅ Updated: ${wanted.map((r) => r.name).join(', ')}` : '✅ Cleared.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error(err);
      await i.reply({ content: 'Could not update your roles. Ask staff.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
}

module.exports = { init, panels };
