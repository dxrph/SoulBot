const {
  PermissionFlagsBits: V, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { roles, categories } = require('./template');
const { roleMap, channelByKey, mergeOw, specialNames, remember } = require('./util');
const { panels, isLegacyTitle } = require('./features');
const { EVERYONE_PERMS, ensureEveryoneCanStream, ensureEveryoneNoMassPing } = require('./permissions');
const { guildSlash } = require('./slash');

const pending = new Map();

const commands = [
  guildSlash('setup-server', 'ATTENZIONE: cancella tutto e ricostruisce il server ONYZUK4')
    .setDefaultMemberPermissions(V.Administrator),
  guildSlash('add-tools', 'Aggiorna il server al layout nuovo: rinomina, aggiunge, non cancella niente')
    .setDefaultMemberPermissions(V.Administrator),
  guildSlash('refresh-panels', 'Ripubblica i pannelli (verifica, ruoli, regole, live, social, LFG) con il design nuovo')
    .setDefaultMemberPermissions(V.Administrator),
].map((c) => c.toJSON());

// Called by the single interactionCreate dispatcher in index.js
async function onInteraction(i) {
  try {
    if (i.isChatInputCommand() && i.commandName === 'setup-server') return await askConfirm(i);
    if (i.isChatInputCommand() && i.commandName === 'add-tools') return await addTools(i);
    if (i.isChatInputCommand() && i.commandName === 'refresh-panels') return await refresh(i);
    if (i.isButton() && i.customId.startsWith('setup:')) return await handleWipeButton(i);
  } catch (err) {
    console.error(err);
  }
}

const ownerOnly = (i) => i.reply({ content: 'Solo il proprietario del server può usare questo comando.', flags: MessageFlags.Ephemeral });

async function askConfirm(i) {
  if (i.user.id !== i.guild.ownerId) return ownerOnly(i);
  pending.set(i.guildId, i.user.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:yes').setLabel('Sì, cancella tutto').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('setup:no').setLabel('Annulla').setStyle(ButtonStyle.Secondary),
  );
  await i.reply({
    content:
      '⚠️ **Pericolo.** Questo comando cancella **TUTTI i canali e i ruoli** (sotto il ruolo del bot) e ricostruisce il layout ONYZUK4. Non si può annullare.\n\n' +
      'Per un aggiornamento (nuovi nomi ruolo, pannelli, funzioni) usa **`/add-tools`** e poi **`/refresh-panels`**: non cancella niente e i membri tengono i ruoli.\n\n' +
      'Usa `/setup-server` solo su un server vuoto o se vuoi davvero ripartire da zero.',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleWipeButton(i) {
  if (pending.get(i.guildId) !== i.user.id) {
    return i.reply({ content: 'Non puoi usare questo pulsante.', flags: MessageFlags.Ephemeral });
  }
  pending.delete(i.guildId);
  if (i.customId === 'setup:no') return i.update({ content: 'Annullato.', components: [] });

  await i.update({ content: 'Setup in corso...', components: [] });
  try {
    await wipe(i.guild);
    const failed = await build(i.guild);
    remember(i.guild);
    await i.editReply({ content: `Fatto. Assegnati ${roles.find((r) => r.key === 'owner').name} e ${roles.find((r) => r.key === 'player').name} per vedere tutto.` +
      (failed.length ? `\n⚠️ Forum non creati (${failed.join(', ')}): attiva **Community** nelle impostazioni, poi usa /add-tools.` : '') });
  } catch (err) {
    console.error(err);
    await i.editReply({ content: `Setup non riuscito: ${err.message}` }).catch(() => {});
  }
}

async function addTools(i) {
  if (i.user.id !== i.guild.ownerId) return ownerOnly(i);
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await i.guild.roles.fetch();
    await i.guild.channels.fetch();
    const renamed = await renameLegacy(i.guild);
    const R = await ensureRoles(i.guild);
    const streamFixed = await ensureEveryoneCanStream(i.guild);
    const pingFixed = await ensureEveryoneNoMassPing(i.guild);
    const failed = await buildCategories(i.guild, R, false);
    await orderCategories(i.guild);
    remember(i.guild);
    await ensurePanels(i.guild);
    i.client.emit('patchesCheck');
    i.client.emit('statsCheck');
    await i.editReply(failed.length
      ? `Fatto, ma questi forum non sono stati creati: ${failed.join(', ')}. Attiva **Community** nelle impostazioni, poi rilancia /add-tools.`
      : `Server aggiornato${renamed ? ` (${renamed} rinominati)` : ''}.${streamFixed ? ' Condivisione schermo attiva per tutti.' : ''}${pingFixed ? ' Tolto @everyone al ruolo everyone.' : ''} Usa /refresh-panels per ripubblicare i pannelli e /sync-guides per i forum eroi e build.`);
  } catch (err) {
    console.error(err);
    await i.editReply(`Non riuscito: ${err.message}`);
  }
}

async function refresh(i) {
  if (i.user.id !== i.guild.ownerId) return ownerOnly(i);
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await i.guild.channels.fetch();
    remember(i.guild);
    await refreshPanels(i.guild);
    await i.editReply('Pannelli ripubblicati.');
  } catch (err) {
    console.error(err);
    await i.editReply(`Non riuscito: ${err.message}`);
  }
}

async function wipe(guild) {
  await guild.channels.fetch();
  for (const ch of guild.channels.cache.values()) {
    await ch.delete('Server reset').catch((e) => console.warn('channel', ch.name, e.message));
  }
  await guild.roles.fetch();
  const me = guild.members.me;
  for (const r of guild.roles.cache.values()) {
    if (r.id === guild.id || r.managed || r.position >= me.roles.highest.position) continue;
    await r.delete('Server reset').catch((e) => console.warn('role', r.name, e.message));
  }
}

async function build(guild) {
  const R = {};
  for (const def of roles) {
    const perms = def.admin ? [V.Administrator] : (def.perms ?? []).map((p) => V[p]);
    R[def.key] = await guild.roles.create({
      name: def.name, color: def.color, hoist: !!def.hoist, permissions: perms,
    });
  }
  const top = guild.members.me.roles.highest.position - 1;
  await guild.roles.setPositions(roles.map((d, idx) => ({ role: R[d.key].id, position: Math.max(1, top - idx) }))).catch(() => {});

  await guild.roles.everyone.setPermissions(EVERYONE_PERMS);

  const failed = await buildCategories(guild, R, false);
  remember(guild);
  await ensurePanels(guild);
  return failed;
}

async function buildCategories(guild, R, onlySpecial) {
  const failedForums = [];

  for (const cat of categories) {
    if (onlySpecial && !cat.channels.some((ch) => ch.special) && !cat.name.includes('TICKETS')) continue;

    const catOw = categoryOw(guild, R, cat);

    let category = guild.channels.cache.find((ch) => ch.type === ChannelType.GuildCategory && ch.name === cat.name);
    category ??= await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: mergeOw(catOw) });

    for (const ch of cat.channels) {
      if (onlySpecial && !ch.special) continue;
      if (guild.channels.cache.some((x) => x.name === ch.name)) continue;
      if (ch.limit && guild.channels.cache.some((x) => x.name.startsWith(ch.name.replace(/\d+ \(\d+\)$/, '')))) continue;
      if (ch.stat && guild.channels.cache.some((x) => x.name.startsWith(ch.name))) continue; // counter already there (renamed "Name: N")

      const isVoice = ch.type === 'voice';
      const isForum = ch.type === 'forum';
      const ow = channelOw(guild, R, cat, ch);
      try {
        await guild.channels.create({
          name: ch.name,
          type: isVoice ? ChannelType.GuildVoice : isForum ? ChannelType.GuildForum : ChannelType.GuildText,
          parent: category.id,
          userLimit: ch.limit,
          permissionOverwrites: mergeOw(ow),
        });
      } catch (err) {
        if (!isForum) throw err;
        failedForums.push(ch.name);
      }
    }
  }
  return failedForums;
}

function categoryOw(guild, R, cat) {
  const everyone = guild.roles.everyone;
  const ow = [];
  if (cat.vis === 'member' || cat.vis === 'staff') ow.push({ id: everyone.id, deny: [V.ViewChannel] });
  if (cat.vis === 'member') ow.push({ id: R.player.id, allow: [V.ViewChannel] });
  for (const s of [R.owner, R.admin, R.mod]) ow.push({ id: s.id, allow: [V.ViewChannel, V.SendMessages, V.Connect, V.ManageMessages] });
  if (cat.coach) ow.push({ id: R.coach.id, allow: [V.ViewChannel, V.MoveMembers, V.MuteMembers] });
  ow.push({ id: R.muted.id, deny: [V.SendMessages, V.Speak, V.AddReactions] });
  return ow;
}

function channelOw(guild, R, cat, ch) {
  const everyone = guild.roles.everyone;
  const staff = [R.owner, R.admin, R.mod];
  const ow = categoryOw(guild, R, cat);
  if (ch.readOnly) {
    ow.push({ id: everyone.id, deny: [V.SendMessages, V.AddReactions] });
    ow.push({ id: R.player.id, deny: [V.SendMessages] });
    for (const s of staff) ow.push({ id: s.id, allow: [V.SendMessages] });
  }
  if (ch.locked) {
    // counter channels: visible to all, nobody joins (admins bypass overwrites anyway)
    for (const r of [everyone, R.player, ...staff]) ow.push({ id: r.id, deny: [V.Connect] });
  }
  if (ch.noPosts) {
    ow.push({ id: everyone.id, deny: [V.CreatePublicThreads, V.CreatePrivateThreads] });
    ow.push({ id: R.player.id, deny: [V.CreatePublicThreads, V.CreatePrivateThreads] });
    for (const s of staff) ow.push({ id: s.id, allow: [V.CreatePublicThreads] });
  }
  return mergeOw(ow);
}

async function renameLegacy(guild) {
  let count = 0;
  const has = (list, name) => list.some((x) => x.name === name);
  for (const def of roles) {
    if (!def.old || has([...guild.roles.cache.values()], def.name)) continue;
    const found = guild.roles.cache.find((r) => def.old.includes(r.name));
    if (found) { await found.edit({ name: def.name, color: def.color }).catch(console.warn); count += 1; }
  }
  const R = roleMap(guild);
  const ready = R.player && R.owner && R.admin && R.mod && R.coach && R.muted;
  for (const cat of categories) {
    let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name);
    if (!category && cat.old) {
      category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && cat.old.includes(c.name));
      if (category) { await category.setName(cat.name).catch(console.warn); count += 1; }
    }
    for (const ch of cat.channels) {
      if (!ch.old || guild.channels.cache.some((x) => x.name === ch.name)) continue;
      const found = guild.channels.cache.find((x) => ch.old.includes(x.name));
      if (!found) continue;
      const moved = category && found.parentId !== category.id;
      await found.edit({
        name: ch.name,
        ...(moved ? { parent: category.id, ...(ready ? { permissionOverwrites: channelOw(guild, R, cat, ch) } : {}) } : {}),
      }).catch(console.warn);
      count += 1;
    }
  }
  return count;
}

async function ensureRoles(guild) {
  await guild.roles.fetch();
  const R = roleMap(guild);
  for (const def of roles) {
    if (R[def.key]) continue;
    const perms = def.admin ? [V.Administrator] : (def.perms ?? []).map((p) => V[p]);
    R[def.key] = await guild.roles.create({ name: def.name, color: def.color, hoist: !!def.hoist, permissions: perms });
  }
  return R;
}

async function orderCategories(guild) {
  const list = categories
    .map((cat) => guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name))
    .filter(Boolean)
    .map((channel, position) => ({ channel: channel.id, position }));
  await guild.channels.setPositions(list).catch(console.warn);
}

const asList = async (key, guild) => [].concat(await panels[key](guild));
const titleOf = (payload) => payload.embeds?.[0]?.data?.title ?? payload.embeds?.[0]?.title;

async function ensurePanels(guild) {
  for (const key of Object.keys(panels)) {
    const ch = channelByKey(guild, key);
    if (!ch) continue;
    try {
      const list = await asList(key, guild);
      const recent = await ch.messages.fetch({ limit: 50 }).catch(() => null);
      const mine = (recent ?? []).filter((m) => m.author.id === guild.client.user.id);
      if (mine.some((m) => m.embeds[0]?.title === titleOf(list[0]))) continue;
      for (const payload of list) await ch.send(payload);
    } catch (err) {
      console.error('panel', key, err.message);
    }
  }
}

async function refreshPanels(guild) {
  for (const key of Object.keys(panels)) {
    const ch = channelByKey(guild, key);
    if (!ch) continue;
    try {
      const list = await asList(key, guild);
      const titles = new Set(list.map(titleOf));
      const recent = await ch.messages.fetch({ limit: 100 }).catch(() => []);
      for (const m of recent.values()) {
        if (m.author.id === guild.client.user.id && (titles.has(m.embeds[0]?.title) || isLegacyTitle(m.embeds[0]?.title))) await m.delete().catch(() => {});
      }
      for (const payload of list) await ch.send(payload);
    } catch (err) {
      console.error('panel', key, err.message);
    }
  }
}

module.exports = { onInteraction, commands, specialNames, renameLegacy };
