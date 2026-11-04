const {
  PermissionFlagsBits: V, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags,
} = require('discord.js');
const { roles, categories } = require('./template');
const { roleMap, channelByKey, mergeOw, specialNames } = require('./util');
const { panels, isLegacyTitle } = require('./features');
const { EVERYONE_PERMS, ensureEveryoneCanStream } = require('./permissions');

const pending = new Map(); // guildId -> userId who requested the wipe

const commands = [
  new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('DELETES everything in this server and rebuilds the ONYZUK4 community')
    .setDefaultMemberPermissions(V.Administrator).setDMPermission(false),
  new SlashCommandBuilder()
    .setName('add-tools')
    .setDescription('Updates the server to the new layout: renames old items, adds what is missing, deletes nothing')
    .setDefaultMemberPermissions(V.Administrator).setDMPermission(false),
  new SlashCommandBuilder()
    .setName('refresh-panels')
    .setDescription('Reposts the verify, roles, rules, live, social and LFG panels with the latest design')
    .setDefaultMemberPermissions(V.Administrator).setDMPermission(false),
].map((c) => c.toJSON());

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'setup-server') return await askConfirm(i);
      if (i.isChatInputCommand() && i.commandName === 'add-tools') return await addTools(i);
      if (i.isChatInputCommand() && i.commandName === 'refresh-panels') return await refresh(i);
      if (i.isButton() && i.customId.startsWith('setup:')) return await handleWipeButton(i);
    } catch (err) {
      console.error(err);
    }
  });
}

const ownerOnly = (i) => i.reply({ content: 'Only the server owner can use this command.', flags: MessageFlags.Ephemeral });

async function askConfirm(i) {
  if (i.user.id !== i.guild.ownerId) return ownerOnly(i);
  pending.set(i.guildId, i.user.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:yes').setLabel('Yes, delete everything').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('setup:no').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  await i.reply({
    content: '⚠️ This deletes **ALL channels and roles** (below the bot\'s role) and rebuilds the ONYZUK4 layout. It cannot be undone.',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleWipeButton(i) {
  if (pending.get(i.guildId) !== i.user.id) {
    return i.reply({ content: 'You cannot use this button.', flags: MessageFlags.Ephemeral });
  }
  pending.delete(i.guildId);
  if (i.customId === 'setup:no') return i.update({ content: 'Cancelled.', components: [] });

  await i.update({ content: '⏳ Setup in progress...', components: [] });
  try {
    await wipe(i.guild);
    const failed = await build(i.guild);
    // The channel this ran in no longer exists, so reply through the interaction
    await i.editReply({ content: `✅ Done. Give yourself ${roles.find((r) => r.key === 'owner').name} and ${roles.find((r) => r.key === 'player').name} to see everything.` +
      (failed.length ? `
⚠️ Forums not created (${failed.join(', ')}): enable **Community** in Server Settings, then run /add-tools.` : '') });
  } catch (err) {
    console.error(err);
    await i.editReply({ content: `❌ Setup failed: ${err.message}` }).catch(() => {});
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
    const failed = await buildCategories(i.guild, R, false);
    await orderCategories(i.guild);
    await ensurePanels(i.guild);
    i.client.emit('patchesCheck');
    await i.editReply(failed.length
      ? `⚠️ Done, but these forums could not be created: ${failed.join(', ')}. Enable **Community** in Server Settings, then run /add-tools again.`
      : `✅ Server updated${renamed ? ` (${renamed} renamed)` : ''}.${streamFixed ? ' Screen sharing enabled for everyone.' : ''} Run /refresh-panels to repost the panels with the new design, and /sync-guides for the hero and build forums.`);
  } catch (err) {
    console.error(err);
    await i.editReply(`❌ Failed: ${err.message}`);
  }
}

async function refresh(i) {
  if (i.user.id !== i.guild.ownerId) return ownerOnly(i);
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await i.guild.channels.fetch();
    await refreshPanels(i.guild);
    await i.editReply('✅ Panels reposted.');
  } catch (err) {
    console.error(err);
    await i.editReply(`❌ Failed: ${err.message}`);
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
  // Keep list order (staff on top, then ranks...), just below the bot's role
  const top = guild.members.me.roles.highest.position - 1;
  await guild.roles.setPositions(roles.map((d, idx) => ({ role: R[d.key].id, position: Math.max(1, top - idx) }))).catch(() => {});

  await guild.roles.everyone.setPermissions(EVERYONE_PERMS);

  const failed = await buildCategories(guild, R, false);
  await ensurePanels(guild);
  return failed;
}

// onlySpecial: create only the missing channels used by bot features
async function buildCategories(guild, R, onlySpecial) {
  const failedForums = [];

  for (const cat of categories) {
    if (onlySpecial && !cat.channels.some((ch) => ch.special) && !cat.name.includes('TICKETS')) continue;

    const catOw = categoryOw(guild, R, cat);

    let category = guild.channels.cache.find((ch) => ch.type === ChannelType.GuildCategory && ch.name === cat.name);
    category ??= await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: mergeOw(catOw) });

    for (const ch of cat.channels) {
      if (onlySpecial && !ch.special) continue;
      if (guild.channels.cache.some((x) => x.name === ch.name)) continue; // already there (possibly moved by the owner)
      // Match rooms are added/removed by the voice balancer: one room of the group is enough
      if (ch.limit && guild.channels.cache.some((x) => x.name.startsWith(ch.name.replace(/\d+ \(\d+\)$/, '')))) continue;

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
        failedForums.push(ch.name); // forums need the Community feature enabled on the server
      }
    }
  }
  return failedForums;
}

// Permission overwrites of a category, from its visibility in the template
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

// Category overwrites plus the channel's own rules (read-only, forum without new posts)
function channelOw(guild, R, cat, ch) {
  const everyone = guild.roles.everyone;
  const staff = [R.owner, R.admin, R.mod];
  const ow = categoryOw(guild, R, cat);
  if (ch.readOnly) {
    ow.push({ id: everyone.id, deny: [V.SendMessages, V.AddReactions] });
    ow.push({ id: R.player.id, deny: [V.SendMessages] });
    for (const s of staff) ow.push({ id: s.id, allow: [V.SendMessages] });
  }
  if (ch.noPosts) { // forum: everyone can reply in posts, nobody but staff/bot starts new ones
    ow.push({ id: everyone.id, deny: [V.CreatePublicThreads, V.CreatePrivateThreads] });
    ow.push({ id: R.player.id, deny: [V.CreatePublicThreads, V.CreatePrivateThreads] });
    for (const s of staff) ow.push({ id: s.id, allow: [V.CreatePublicThreads] });
  }
  return mergeOw(ow);
}

// Roles, categories and channels from the old layout get their new name (members keep their roles).
// A channel that changed category is moved there with that category's permissions.
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

// Creates the template roles this server does not have yet (new ones like Live pings, VIP, Sub)
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

// Puts the categories in template order (the live corner right below the entrance)
async function orderCategories(guild) {
  const list = categories
    .map((cat) => guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name))
    .filter(Boolean)
    .map((channel, position) => ({ channel: channel.id, position }));
  await guild.channels.setPositions(list).catch(console.warn);
}

// A panel is one message or a list of messages; the first embed title identifies it in the channel
const asList = async (key, guild) => [].concat(await panels[key](guild));
const titleOf = (payload) => payload.embeds?.[0]?.data?.title ?? payload.embeds?.[0]?.title;

// Posts each panel (verify button, role menus, rules, ticket button, LFG) if the channel does not have it yet
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

// Deletes the bot's panel messages and posts them again (use after a design change)
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

module.exports = { init, commands, specialNames, renameLegacy };
