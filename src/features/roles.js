const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder, MessageFlags, SlashCommandBuilder,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap } = require('../util');
const { getHeroes, ensureHeroRoles, byClass, chunk, CLASSES } = require('../heroes');
const { diffRoles } = require('../roleDiff');
const { freeRanks } = require('../ranks');

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
const MAX_MAINS = 5;
const HERO_ERROR = 'Hero list unavailable right now, try again in a minute.';

const commands = [
  new SlashCommandBuilder()
    .setName('profilo')
    .setDescription('See and change your rank, region, hero mains and pings')
    .setDMPermission(false),
].map((c) => c.toJSON());

// Menu messages from the previous design; /refresh-panels removes them
const legacyTitles = ['⚔️ YOUR RANK', '🌍 YOUR REGION', '🐺 PARTY PINGS'];
const classPrefixes = Object.values(CLASSES).map((c) => `${c.emoji} ${c.label.toUpperCase()}`);
const isLegacyTitle = (title) => !!title && (legacyTitles.includes(title) || classPrefixes.some((p) => title.startsWith(p)));

const inGroup = (g) => roles.filter((r) => r.group === g);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const holds = (member, role) => !!role && member.roles.cache.has(role.id);

const sectionButtons = () => row(
  new ButtonBuilder().setCustomId('profile:rank').setLabel('Rank').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('profile:region').setLabel('Region').setEmoji('🌍').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('profile:heroes').setLabel('Heroes').setEmoji('🦸').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('profile:ping').setLabel('Pings').setEmoji('🐺').setStyle(ButtonStyle.Secondary),
);

function menu(customId, placeholder, options, min, max) {
  return row(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder)
    .setMinValues(min).setMaxValues(Math.min(max, options.length)).addOptions(options));
}

// ---- sections: private messages opened by the panel buttons and /profilo ------------------------
function groupSection(group, member) {
  const R = roleMap(member.guild);
  const defs = group === 'rank' ? freeRanks : inGroup(group);
  const options = defs.map((r) => ({ label: r.name, value: r.key, default: holds(member, R[r.key]) }));
  const copy = {
    rank: { text: 'Pick the rank you play at right now. **Emissary or higher** needs verification: use `/verifica-rank`.',
      placeholder: '⚔️ Choose your rank', min: 1, max: 1 },
    region: { text: 'Find teammates who share your time zone. You can pick more than one.',
      placeholder: '🌍 Choose your region(s)', min: 0, max: 3 },
    extra: { text: 'Pick **Hunting for Party** to be pinged when someone needs a teammate. Pick nothing to turn it off.',
      placeholder: '🐺 Party pings', min: 0, max: 1 },
  }[group];
  return { content: copy.text, embeds: [], components: [menu(`roles:${group}`, copy.placeholder, options, copy.min, copy.max)] };
}

async function heroesSection() {
  const heroes = await getHeroes();
  const buttons = Object.entries(CLASSES).filter(([type]) => byClass(heroes, type).length).map(([type, c]) =>
    new ButtonBuilder().setCustomId(`profile:class:${type}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Secondary));
  return { content: `Pick a class, then choose up to ${MAX_MAINS} mains in it.`, embeds: [], components: [row(...buttons)] };
}

async function classSection(type, member) {
  const heroes = byClass(await getHeroes(), type);
  const c = CLASSES[type];
  const rows = chunk(heroes).map((part, idx) => menu(`heroes:${type}:${idx}`,
    `${c.emoji} ${c.label} mains (up to ${MAX_MAINS})`,
    part.map((h) => ({
      label: h.name, value: h.name, description: clip(h.description?.role, 100) || undefined,
      default: member.roles.cache.some((r) => r.name === h.name),
    })), 0, MAX_MAINS));
  const back = row(new ButtonBuilder().setCustomId('profile:heroes').setLabel('Back').setEmoji('⬅️').setStyle(ButtonStyle.Secondary));
  return { content: c.blurb, embeds: [], components: [...rows, back] };
}

async function overview(member) {
  const R = roleMap(member.guild);
  const names = (g) => inGroup(g).filter((r) => holds(member, R[r.key])).map((r) => r.name).join(', ') || '—';
  let mains = '—';
  try {
    const heroes = (await getHeroes()).map((h) => h.name);
    mains = member.roles.cache.filter((r) => heroes.includes(r.name)).map((r) => r.name).join(', ') || '—';
  } catch { mains = 'unavailable'; }
  const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('👤 Your profile').setDescription(
    `**⚔️ Rank** · ${names('rank')}\n**🌍 Region** · ${names('region')}\n**🦸 Mains** · ${mains}\n**🐺 Pings** · ${names('extra')}`);
  return { content: '', embeds: [embed], components: [sectionButtons()] };
}

// ---- the panel in #get-roles --------------------------------------------------------------------
const panels = {
  roles: async (guild) => {
    await ensureHeroRoles(guild); // creates one role per hero if missing
    return {
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🎭 CHOOSE YOUR PATH')
        .setDescription(
          `Shape how the server sees you.\n${LINE}\n` +
          'Press a button: **Rank**, **Region**, **Heroes** or **Pings**. Each one opens a private menu only you can see.\n' +
          `${LINE}\nChange it any time, nothing is permanent. You can also type \`/profilo\` anywhere.`,
        )],
      components: [sectionButtons()],
    };
  },
};

// ---- interactions -------------------------------------------------------------------------------
// Acknowledges inside a private message by updating it, from a public one by opening a private reply
async function ack(i) {
  if (i.message?.flags?.has(MessageFlags.Ephemeral)) await i.deferUpdate();
  else await i.deferReply({ flags: MessageFlags.Ephemeral });
}

async function showSection(i, build) {
  await ack(i);
  try {
    await i.editReply(await build());
  } catch (err) {
    console.error(err);
    await i.editReply({ content: HERO_ERROR, embeds: [], components: [] }).catch(() => {});
  }
}

function profileButton(i) {
  const [, section, type] = i.customId.split(':');
  if (section === 'rank') return showSection(i, () => groupSection('rank', i.member));
  if (section === 'region') return showSection(i, () => groupSection('region', i.member));
  if (section === 'ping') return showSection(i, () => groupSection('extra', i.member));
  if (section === 'heroes') return showSection(i, heroesSection);
  if (section === 'class') return showSection(i, () => classSection(type, i.member));
}

async function selectMenu(i) {
  const [kind, a, b] = i.customId.split(':');
  if (kind !== 'roles' && kind !== 'heroes') return;
  await ack(i);
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
    const { add, remove } = diffRoles(all, wanted, (r) => i.member.roles.cache.has(r.id));
    if (remove.length) await i.member.roles.remove(remove);
    if (add.length) await i.member.roles.add(add);
    await i.editReply({ content: wanted.length ? `✅ Updated: ${wanted.map((r) => r.name).join(', ')}` : '✅ Cleared.' });
  } catch (err) {
    console.error(err);
    await i.editReply({ content: 'Could not update your roles. Ask staff.' }).catch(() => {});
  }
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'profilo') {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        return await i.editReply(await overview(i.member));
      }
      if (i.isButton() && i.customId.startsWith('profile:')) return await profileButton(i);
      if (i.isStringSelectMenu()) return await selectMenu(i);
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, panels, commands, isLegacyTitle };
