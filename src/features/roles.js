const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');
const { roles } = require('../template');
const { roleMap, isStaff } = require('../util');
const { getHeroes, ensureHeroRoles, orphanHeroRoles, byClass, chunk, CLASSES } = require('../heroes');
const { diffRoles } = require('../roleDiff');
const { freeRanks, verifiedRanks } = require('../ranks');
const { guildSlash } = require('../slash');
const { palette, LINE, withFooter, baseEmbed } = require('../style');

const MAX_MAINS = 5;
const HERO_ERROR = 'La lista eroi non è disponibile, riprova tra un minuto.';
const PANEL_TITLE = 'Il tuo dominio';
const REGION_GONE = 'La scelta del server di gioco non c\'è più. Se hai già un ruolo regione lo tieni, finché lo staff non decide altrimenti.';

const commands = [
  guildSlash('profilo', 'Vedi e cambia rank, eroi main, notifiche e interessi'),
  guildSlash('pulisci-eroi', 'Elenca e rimuove i ruoli eroe non più usati dal gioco')
    .setDefaultMemberPermissions(require('discord.js').PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

const legacyTitles = [
  '⚔️ YOUR RANK', '🌍 YOUR REGION', '🐺 PARTY PINGS',
  '🎭 CHOOSE YOUR PATH', 'Scegli il tuo percorso',
];
const classPrefixes = Object.values(CLASSES).map((c) => `${c.emoji} ${c.label.toUpperCase()}`);
const isLegacyTitle = (title) => !!title && (legacyTitles.includes(title) || classPrefixes.some((p) => title.startsWith(p)));

const inGroup = (g) => roles.filter((r) => r.group === g);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const holds = (member, role) => !!role && member.roles.cache.has(role.id);

const RANK_BLURB = {
  initiate: 'Il punto di partenza. Tutti siamo stati qui.',
  seeker: 'Stai imparando le regole del gioco.',
  acolyte: 'Le basi ci sono.',
  sentinel: 'Tieni il ritmo della partita.',
  mystic: 'Cominci a farti notare.',
  ritualist: 'L’ultimo rank che prendi da solo.',
};

const EXTRA_BLURB = {
  live: 'Ping quando ONYZUK4 va in live. Non te lo perdi.',
  lfg: 'Ping quando qualcuno cerca compagni.',
};

const INTEREST_BLURB = {
  anime_jjk: 'Il Dominio, ovviamente.',
  anime_naruto: 'Believe it. I nomi dello staff già lo dicono.',
  anime_onepiece: 'Re dei pirati? Si parte da qui.',
  anime_bleach: 'Bankai opzionale, opinioni obbligatorie.',
  anime_hxh: 'All in. O almeno fai finta.',
  anime_csm: 'Per chi preferisce il caos al buon senso.',
  anime_aot: 'Tatakae. Poi ne parliamo in chat.',
  anime_db: 'Oltre le 9000, come minimo.',
  anime_opm: 'Un pugno, e si fa sul serio.',
  anime_dn: 'Scrivi il nome, ma non in generale.',
};

const INTEREST_EMOJI = {
  anime_jjk: 'gojo_grin',
  anime_naruto: 'naruto_grin',
  anime_onepiece: 'luffy_grin',
  anime_bleach: 'ichigo_smirk',
  anime_hxh: 'killua_smile',
  anime_csm: 'denji_grin',
  anime_aot: 'eren_grimace',
  anime_db: 'goku_cool',
  anime_opm: 'saitama_deadpan',
  anime_dn: 'ryuk_laugh',
};

function slugHero(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function guildEmoji(guild, ...names) {
  const cache = guild?.emojis?.cache;
  if (!cache) return undefined;
  for (const name of names) {
    if (!name) continue;
    const e = cache.find((x) => x.name === name);
    if (e) return { id: e.id, name: e.name };
  }
  return undefined;
}

function emojiTag(guild, ...names) {
  const e = guildEmoji(guild, ...names);
  return e ? `<:${e.name}:${e.id}>` : '';
}

function rankEmoji(guild, key) {
  return guildEmoji(guild, `dl_${key}`, `rank_${key}`);
}

function heroEmoji(guild, name) {
  const s = slugHero(name);
  return guildEmoji(guild, `hero_${s}`, `hero_${s.replace(/_and_/g, '_')}`);
}

function formatRoleChange(add, remove) {
  if (!add.length && !remove.length) {
    return 'Nessun cambiamento: eri già a posto, come un vero egoista.';
  }
  const lines = [];
  if (add.length) lines.push(`**Aggiunto** · ${add.map((r) => r.name).join(', ')}`);
  if (remove.length) lines.push(`**Tolto** · ${remove.map((r) => r.name).join(', ')}`);
  return lines.join('\n');
}

function sectionRow() {
  return row(
    new ButtonBuilder().setCustomId('profile:rank').setLabel('Rank').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('profile:heroes').setLabel('Eroi').setEmoji('🦸').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('profile:ping').setLabel('Notifiche').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('profile:interest').setLabel('Interessi').setEmoji('🎬').setStyle(ButtonStyle.Secondary),
  );
}

function utilityRow(withMine) {
  const buttons = [];
  if (withMine) {
    buttons.push(new ButtonBuilder().setCustomId('profile:me').setLabel('I miei ruoli').setEmoji('📋').setStyle(ButtonStyle.Success));
  }
  buttons.push(new ButtonBuilder().setCustomId('profile:reset').setLabel('Resetta').setEmoji('♻️').setStyle(ButtonStyle.Danger));
  return row(...buttons);
}

function navRow() {
  return row(new ButtonBuilder().setCustomId('profile:me').setLabel('I miei ruoli').setEmoji('⬅️').setStyle(ButtonStyle.Secondary));
}

function menu(customId, placeholder, options, min, max) {
  return row(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder)
    .setMinValues(min).setMaxValues(Math.min(max, options.length)).addOptions(options));
}

function optionOf(def, member, R, guild, blurb, emoji) {
  const opt = {
    label: def.name,
    value: def.key,
    default: holds(member, R[def.key]),
  };
  const description = clip(blurb, 100);
  if (description) opt.description = description;
  if (emoji) opt.emoji = emoji;
  return opt;
}

function groupSection(group, member) {
  const R = roleMap(member.guild);
  const defs = (group === 'rank' ? freeRanks : inGroup(group)).filter((d) => R[d.key]);
  const copy = {
    rank: {
      text: 'Scegli il rank a cui giochi **adesso**. Da **Emissary** in su serve `/verifica-rank`: niente flex a caso.',
      placeholder: 'Il tuo rank attuale',
      min: 1,
      max: 1,
      blurb: RANK_BLURB,
    },
    extra: {
      text: '**Scouter** quando vado in live, **Hunters** quando qualcuno cerca compagni. Togli tutto se vuoi silenzio.',
      placeholder: 'Cosa vuoi che ti avvisi',
      min: 0,
      max: 2,
      blurb: EXTRA_BLURB,
    },
    interest: {
      text: 'Scegli gli anime che ti piacciono. Puoi prenderne più di uno, niente giudizio — quasi.',
      placeholder: 'I tuoi interessi',
      min: 0,
      max: 25,
      blurb: INTEREST_BLURB,
    },
  }[group];

  if (!defs.length) {
    return {
      content: group === 'interest'
        ? 'I ruoli interesse non sono ancora sul server. Lo staff deve lanciare **/add-tools**.'
        : 'Non trovo i ruoli di questa sezione. Lo staff deve lanciare **/add-tools**.',
      embeds: [],
      components: [navRow()],
    };
  }

  const options = defs.map((d) => optionOf(
    d,
    member,
    R,
    member.guild,
    copy.blurb[d.key],
    group === 'rank' ? rankEmoji(member.guild, d.key) : guildEmoji(member.guild, INTEREST_EMOJI[d.key]),
  ));
  return {
    content: copy.text,
    embeds: [],
    components: [menu(`roles:${group}`, copy.placeholder, options, copy.min, Math.min(copy.max, options.length)), navRow()],
  };
}

async function heroesSection(guild) {
  const heroes = await getHeroes();
  await ensureHeroRoles(guild).catch(() => {});
  const buttons = Object.entries(CLASSES).filter(([type]) => byClass(heroes, type).length).map(([type, c]) =>
    new ButtonBuilder().setCustomId(`profile:class:${type}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Secondary));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(row(...buttons.slice(i, i + 5)));
  rows.push(navRow());
  return {
    content: `Scegli una classe, poi fino a **${MAX_MAINS} main** in quella classe. I tuoi, non tutta la roster.`,
    embeds: [],
    components: rows,
  };
}

async function classSection(type, member) {
  const heroes = byClass(await getHeroes(), type);
  const c = CLASSES[type];
  const rows = chunk(heroes).map((part, idx) => menu(
    `heroes:${type}:${idx}`,
    `${c.label} (fino a ${MAX_MAINS})`,
    part.map((h) => {
      const opt = {
        label: h.name,
        value: h.name,
        default: member.roles.cache.some((r) => r.name === h.name),
      };
      const description = clip(h.description?.role, 100);
      if (description) opt.description = description;
      const emoji = heroEmoji(member.guild, h.name);
      if (emoji) opt.emoji = emoji;
      return opt;
    }),
    0,
    MAX_MAINS,
  ));
  rows.push(navRow());
  return { content: c.blurb, embeds: [], components: rows };
}

function namesIn(member, group, R) {
  return inGroup(group).filter((r) => holds(member, R[r.key])).map((r) => r.name).join(', ') || '—';
}

async function overview(member) {
  const R = roleMap(member.guild);
  let mains = '—';
  try {
    const heroes = (await getHeroes()).map((h) => h.name);
    mains = member.roles.cache.filter((r) => heroes.includes(r.name)).map((r) => r.name).join(', ') || '—';
  } catch { mains = 'non disponibile'; }
  const verified = verifiedRanks.filter((r) => holds(member, R[r.key])).map((r) => r.name);
  const free = freeRanks.filter((r) => holds(member, R[r.key])).map((r) => r.name);
  const rank = [...verified, ...free].join(', ') || '—';
  const embed = withFooter(baseEmbed(palette.accent).setTitle('I tuoi ruoli').setDescription(
    `**Rank** · ${rank}\n**Main** · ${mains}\n**Notifiche** · ${namesIn(member, 'extra', R)}\n**Interessi** · ${namesIn(member, 'interest', R)}\n${LINE}\nCambia quello che vuoi, niente è permanente. I rank verificati si toccano solo con \`/verifica-rank\`.`));
  return { content: '', embeds: [embed], components: [sectionRow(), utilityRow(false)] };
}

function rolesPanelPayload(guild) {
  const tagRank = (key) => emojiTag(guild, `dl_${key}`, `rank_${key}`);
  const listed = (list) => list.map((r) => {
    const tag = tagRank(r.key);
    return tag ? `${tag} ${r.name}` : r.name;
  }).join(' · ');
  const embed = withFooter(baseEmbed(palette.accent)
    .setTitle(PANEL_TITLE)
    .setDescription(`Qui non si improvvisa: scegli come Soulside ti vede.\n${LINE}`)
    .addFields(
      {
        name: '⚔️ Rank Deadlock',
        value: `Il rank a cui giochi adesso.\n${listed(freeRanks)}\nDa **Emissary** in su non si sceglie da soli: usa \`/verifica-rank\`.\n${listed(verifiedRanks)}`,
      },
      { name: '🦸 Eroi main', value: 'Fino a **5**, per classe. I tuoi main, non tutta la roster.' },
      { name: '🔔 Notifiche', value: '**Scouter** quando vado in live. **Hunters** quando qualcuno cerca compagni.' },
      { name: '🎬 Interessi', value: 'L\'anime che ti meriti — o che fai finta di aver finito.' },
      { name: '\u200b', value: `${LINE}\nPremi un pulsante: il menu lo vedi **solo tu**. Puoi cambiare quando vuoi, o scrivere \`/profilo\`.` },
    ));
  return { embeds: [embed], components: [sectionRow(), utilityRow(true)] };
}

const panels = {
  roles: async (guild) => {
    await ensureHeroRoles(guild).catch(() => {});
    return rolesPanelPayload(guild);
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

function resetConfirm() {
  return {
    content: 'Tolgo i ruoli che ti sei scelto tu: rank libero, eroi, notifiche e interessi. I rank verificati (Emissary in su) restano, e anche un eventuale ruolo regione. Confermi?',
    embeds: [],
    components: [row(
      new ButtonBuilder().setCustomId('profile:reset-yes').setLabel('Conferma reset').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('profile:reset-no').setLabel('Annulla').setStyle(ButtonStyle.Secondary),
    )],
  };
}

async function collectReset(member) {
  const R = roleMap(member.guild);
  const remove = [];
  for (const def of [...freeRanks, ...inGroup('extra'), ...inGroup('interest')]) {
    const role = R[def.key];
    if (holds(member, role)) remove.push(role);
  }
  try {
    const heroes = (await getHeroes()).map((h) => h.name);
    for (const role of member.roles.cache.values()) {
      if (heroes.includes(role.name) && !remove.some((r) => r.id === role.id)) remove.push(role);
    }
  } catch { /* keep the roles we already collected */ }
  return remove;
}

async function profileButton(i) {
  const [, section, type] = i.customId.split(':');
  if (section === 'rank') return showSection(i, () => groupSection('rank', i.member));
  if (section === 'region') return showSection(i, () => ({ content: REGION_GONE, embeds: [], components: [navRow()] }));
  if (section === 'ping') return showSection(i, () => groupSection('extra', i.member));
  if (section === 'interest') return showSection(i, () => groupSection('interest', i.member));
  if (section === 'heroes') return showSection(i, () => heroesSection(i.guild));
  if (section === 'class') return showSection(i, () => classSection(type, i.member));
  if (section === 'me') return showSection(i, () => overview(i.member));
  if (section === 'reset' && type === 'yes') {
    await ack(i);
    try {
      const remove = await collectReset(i.member);
      if (remove.length) await i.member.roles.remove(remove);
      const view = await overview(i.member);
      const content = remove.length
        ? formatRoleChange([], remove)
        : 'Non c\'era niente da togliere. Pulito come un Dominio appena aperto.';
      return await i.editReply({ ...view, content });
    } catch (err) {
      console.error(err);
      return i.editReply({ content: 'Non ho potuto togliere i ruoli. Chiedi allo staff.', embeds: [], components: [navRow()] }).catch(() => {});
    }
  }
  if (section === 'reset' && type === 'no') return showSection(i, () => overview(i.member));
  if (section === 'reset') return showSection(i, () => resetConfirm());
}

async function selectMenu(i) {
  const [kind, a, b] = i.customId.split(':');
  if (kind !== 'roles' && kind !== 'heroes') return;
  await ack(i);
  try {
    if (kind === 'roles' && a === 'region') {
      return await i.editReply({ content: REGION_GONE, embeds: [], components: [navRow()] });
    }
    let all; let wanted;
    if (kind === 'roles') {
      const R = roleMap(i.guild);
      const defs = a === 'rank' ? freeRanks : inGroup(a);
      all = defs.map((r) => R[r.key]);
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
    const view = await overview(i.member);
    await i.editReply({ ...view, content: formatRoleChange(add, remove) });
  } catch (err) {
    console.error(err);
    await i.editReply({ content: 'Non ho potuto aggiornare i ruoli. Chiedi allo staff.', embeds: [], components: [navRow()] }).catch(() => {});
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
    content: `Ho trovato **${orphans.length}** ruoli eroe che non sono più nel gioco.\n${list}\n\nPremi conferma per eliminarli. I ruoli del template non vengono toccati.`,
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

module.exports = {
  onInteraction,
  panels,
  commands,
  isLegacyTitle,
  PANEL_TITLE,
  formatRoleChange,
  slugHero,
  rolesPanelPayload,
  REGION_GONE,
};
