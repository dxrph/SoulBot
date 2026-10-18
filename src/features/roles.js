const {
  ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap } = require('../util');

const GROUPS = {
  rank: { placeholder: '⚔️ Choose your rank', max: 1 },
  region: { placeholder: '🌍 Choose your region', max: 3 },
  extra: { placeholder: '🐺 Extras', max: 1 },
};

const inGroup = (g) => roles.filter((r) => r.group === g);

const panels = {
  roles: () => ({
    embeds: [new EmbedBuilder()
      .setTitle('🎭 Choose your roles')
      .setDescription('Pick your rank and region from the menus below. Choose nothing to clear a menu.')
      .setColor(0x9b59b6)],
    components: Object.entries(GROUPS).map(([group, g]) => new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`roles:${group}`)
        .setPlaceholder(g.placeholder)
        .setMinValues(0)
        .setMaxValues(Math.min(g.max, inGroup(group).length))
        .addOptions(inGroup(group).map((r) => ({ label: r.name, value: r.key }))),
    )),
  }),
};

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isStringSelectMenu() || !i.customId.startsWith('roles:')) return;
    try {
      const group = i.customId.split(':')[1];
      const R = roleMap(i.guild);
      const all = inGroup(group).map((r) => R[r.key]).filter(Boolean);
      const wanted = i.values.map((k) => R[k]).filter(Boolean);
      const remove = all.filter((r) => i.member.roles.cache.has(r.id) && !wanted.includes(r));
      const add = wanted.filter((r) => !i.member.roles.cache.has(r.id));
      if (remove.length) await i.member.roles.remove(remove);
      if (add.length) await i.member.roles.add(add);
      await i.reply({
        content: wanted.length ? `Updated: ${wanted.map((r) => r.name).join(', ')}` : 'Cleared.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error(err);
      await i.reply({ content: 'Could not update your roles. Ask staff.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
}

module.exports = { init, panels };
