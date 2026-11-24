const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap } = require('../util');
const { getHeroes, ensureHeroRoles, orphanHeroRoles, byClass, chunk, CLASSES } = require('../heroes');
const { diffRoles } = require('../roleDiff');
const { freeRanks } = require('../ranks');
const { guildSlash } = require('../slash');
const { isStaff } = require('../util');
const { palette, LINE, withFooter, baseEmbed } = require('../style');

const MAX_MAINS = 5;
const HERO_ERROR = 'La lista eroi non è disponibile, riprova tra un minuto.';

const commands = [
  guildSlash('profilo', 'Vedi e cambia rank, regione, eroi main e notifiche'),
  guildSlash('pulisci-eroi', 'Elenca e rimuove i ruoli eroe non più usati dal gioco')
    .setDefaultMemberPermissions(require('discord.js').PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

const legacyTitles = ['⚔️ YOUR RANK', '🌍 YOUR REGION', '🐺 PARTY PINGS', '🎭 CHOOSE YOUR PATH', 'Scegli il tuo percorso'];
const classPrefixes = Object.values(CLASSES).map((c) => `${c.emoji} ${c.label.toUpperCase()}`);
const isLegacyTitle = (title) => !!title && (legacyTitles.includes(title) || classPrefixes.some((p) => title.startsWith(p)));

const inGroup = (g) => roles.filter((r) => r.group === g);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const holds = (member, role) => !!role && member.roles.cache.has(role.id);

const sectionButtons = () => row(
  new ButtonBuilder().setCustomId('profile:rank').setLabel('Rank').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('profile:region').setLabel('Regione').setEmoji('🌍').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('profile:heroes').setLabel('Eroi').setEmoji('🦸').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('profile:ping').setLabel('Notifiche').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
);

function menu(customId, placeholder, options, min, max) {
  return row(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder)
    .setMinValues(min).setMaxValues(Math.min(max, options.length)).addOptions(options));
}

function groupSection(group, member) {
  const R = roleMap(member.guild);
  const defs = group === 'rank' ? freeRanks : inGroup(group);
  const options = defs.map((r) => ({ label: r.name, value: r.key, default: holds(member, R[r.key]) }));
  const copy = {
    rank: { text: 'Scegli il rank a cui giochi adesso. **Da Emissary in su** serve la verifica: usa `/verifica-rank`.',
      placeholder: 'Scegli il tuo rank', min: 1, max: 1 },
    region: { text: 'Trova compagni nel tuo fuso orario. Puoi sceglierne più di uno.',
      placeholder: 'Scegli la tua regione', min: 0, max: 3 },
    extra: { text: 'Scegli **Scouter** per il ping quando vado in live, **Hunters** per il ping quando qualcuno cerca compagni. Togli tutto per disattivarli.',
      placeholder: 'Notifiche', min: 0, max: 2 },
  }[group];
  return { content: copy.text, embeds: [], components: [menu(`roles:${group}`, copy.placeholder, options, copy.min, copy.max)] };
}

async function heroesSection() {
  const heroes = await getHeroes();
  const buttons = Object.entries(CLASSES).filter(([type]) => byClass(heroes, type).length).map(([type, c]) =>
    new ButtonBuilder().setCustomId(`profile:class:${type}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Secondary));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(row(...buttons.slice(i, i + 5)));
  return { content: `Scegli una classe, poi fino a ${MAX_MAINS} main in quella classe.\n*Pick a class, then up to ${MAX_MAINS} mains.*`, embeds: [], components: rows };
}

async function classSection(type, member) {
  const heroes = byClass(await getHeroes(), type);
  const c = CLASSES[type];
  const rows = chunk(heroes).map((part, idx) => menu(`heroes:${type}:${idx}`,
    `${c.label} (fino a ${MAX_MAINS})`,
    part.map((h) => ({
      label: h.name, value: h.name, description: clip(h.description?.role, 100) || undefined,
      default: member.roles.cache.some((r) => r.name === h.name),
    })), 0, MAX_MAINS));
  const back = row(new ButtonBuilder().setCustomId('profile:heroes').setLabel('Indietro').setEmoji('⬅️').setStyle(ButtonStyle.Secondary));
  return { content: c.blurb, embeds: [], components: [...rows, back] };
}

async function overview(member) {
  const R = roleMap(member.guild);
  const names = (g) => inGroup(g).filter((r) => holds(member, R[r.key])).map((r) => r.name).join(', ') || '—';
  let mains = '—';
  try {
    const heroes = (await getHeroes()).map((h) => h.name);
    mains = member.roles.cache.filter((r) => heroes.includes(r.name)).map((r) => r.name).join(', ') || '—';
  } catch { mains = 'non disponibile'; }
  const embed = withFooter(baseEmbed(palette.accent).setTitle('Il tuo profilo').setDescription(
    `**Rank** · ${names('rank')}\n**Regione** · ${names('region')}\n**Main** · ${mains}\n**Notifiche** · ${names('extra')}`));
  return { content: '', embeds: [embed], components: [sectionButtons()] };
}

const panels = {
  roles: async (guild) => {
    await ensureHeroRoles(guild);
    return {
      embeds: [withFooter(baseEmbed(palette.accent)
        .setTitle('Scegli il tuo percorso')
        .setDescription(
          `Così il server ti vede.\n${LINE}\n` +
          'Premi un pulsante: **Rank**, **Regione**, **Eroi** o **Notifiche**. Si apre un menu privato, visibile solo a te.\n' +
          `${LINE}\nIn **Notifiche** attivi il ping quando vado in live (ruolo Scouter).\n` +
          'Puoi cambiare quando vuoi, niente è permanente. Puoi anche scrivere `/profilo` ovunque.\n' +
          '*Pick rank, region, heroes and live pings. You can change them any time.*',
        ))],
      components: [sectionButtons()],
    };
  },
};

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
    await i.editReply({ content: wanted.length ? `Aggiornato: ${wanted.map((r) => r.name).join(', ')}` : 'Tolto.' });
  } catch (err) {
    console.error(err);
    await i.editReply({ content: 'Non ho potuto aggiornare i ruoli. Chiedi allo staff.' }).catch(() => {});
  }
}

async function cleanupHeroes(i) {
  if (i.user.id !== i.guild.ownerId && !isStaff(i.member)) {
    return i.reply({ content: 'Solo lo staff può usare questo comando.', flags: MessageFlags.Ephemeral });
  }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const orphans = await orphanHeroRoles(i.guild);
  if (!orphans.length) return i.editReply('Nessun ruolo eroe orfano da pulire.');
  const list = orphans.map((r) => `• ${r.name} (<@&${r.id}>)`).join('\n').slice(0, 1800);
  await i.editReply({
    content: `Ho trovato **${orphans.length}** ruoli eroe che non sono più nel gioco.\n${list}\n\nPremi conferma per eliminarli. I 25 ruoli del template non vengono toccati.`,
    components: [row(
      new ButtonBuilder().setCustomId('heroes:purge').setLabel('Elimina questi ruoli').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('heroes:purge-no').setLabel('Annulla').setStyle(ButtonStyle.Secondary),
    )],
  });
}

async function confirmPurge(i, yes) {
  if (i.user.id !== i.guild.ownerId && !isStaff(i.member)) {
    return i.reply({ content: 'Solo lo staff può confermare.', flags: MessageFlags.Ephemeral });
  }
  if (!yes) return i.update({ content: 'Annullato.', components: [] });
  await i.deferUpdate();
  const orphans = await orphanHeroRoles(i.guild);
  let ok = 0;
  for (const r of orphans) {
    await r.delete('Hero no longer in the game').catch(() => {});
    ok += 1;
  }
  await i.editReply({ content: `Rimossi ${ok} ruoli eroe orfani.`, components: [] });
}

async function onInteraction(i) {
  try {
    if (i.isChatInputCommand() && i.commandName === 'profilo') {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      return await i.editReply(await overview(i.member));
    }
    if (i.isChatInputCommand() && i.commandName === 'pulisci-eroi') return await cleanupHeroes(i);
    if (i.isButton() && i.customId === 'heroes:purge') return await confirmPurge(i, true);
    if (i.isButton() && i.customId === 'heroes:purge-no') return await confirmPurge(i, false);
    if (i.isButton() && i.customId.startsWith('profile:')) return await profileButton(i);
    if (i.isStringSelectMenu()) return await selectMenu(i);
  } catch (err) {
    console.error(err);
  }
}

module.exports = { onInteraction, panels, commands, isLegacyTitle };
