const {
  PermissionFlagsBits: V, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags,
} = require('discord.js');
const { roles, categories } = require('./template');
const { roleMap, channelByKey, mergeOw, specialNames } = require('./util');
const { panels } = require('./features');

const pending = new Map(); // guildId -> userId who requested the wipe

const commands = [
  new SlashCommandBuilder()
    .setName('setup-deadlock')
    .setDescription('DELETES everything in this server and rebuilds it for Deadlock')
    .setDefaultMemberPermissions(V.Administrator).setDMPermission(false),
  new SlashCommandBuilder()
    .setName('add-tools')
    .setDescription('Adds missing bot channels and panels without deleting anything')
    .setDefaultMemberPermissions(V.Administrator).setDMPermission(false),
].map((c) => c.toJSON());

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'setup-deadlock') return await askConfirm(i);
      if (i.isChatInputCommand() && i.commandName === 'add-tools') return await addTools(i);
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
    content: '⚠️ This deletes **ALL channels and roles** (below the bot\'s role) and rebuilds the Deadlock layout. It cannot be undone.',
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
    await build(i.guild);
    // The channel this ran in no longer exists, so reply through the interaction
    await i.editReply({ content: '✅ Done. Give yourself 👑 The Hidden King and 🔥 Soulbound to see everything.' });
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
    const R = roleMap(i.guild);
    if (!R.player) throw new Error('Soulbound role not found. Run /setup-deadlock first.');
    await buildCategories(i.guild, R, true);
    await ensurePanels(i.guild);
    await i.editReply('✅ Tool channels and panels are ready.');
  } catch (err) {
    console.error(err);
    await i.editReply(`❌ Failed: ${err.message}`);
  }
}

async function wipe(guild) {
  await guild.channels.fetch();
  for (const ch of guild.channels.cache.values()) {
    await ch.delete('Deadlock reset').catch((e) => console.warn('channel', ch.name, e.message));
  }
  await guild.roles.fetch();
  const me = guild.members.me;
  for (const r of guild.roles.cache.values()) {
    if (r.id === guild.id || r.managed || r.position >= me.roles.highest.position) continue;
    await r.delete('Deadlock reset').catch((e) => console.warn('role', r.name, e.message));
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

  await guild.roles.everyone.setPermissions([V.ViewChannel, V.ReadMessageHistory, V.AddReactions, V.Connect, V.Speak, V.UseVAD,
    V.SendMessages, V.EmbedLinks, V.AttachFiles, V.UseExternalEmojis, V.CreateInstantInvite, V.ChangeNickname]);

  await buildCategories(guild, R, false);
  await ensurePanels(guild);
}

// onlySpecial: create only the missing channels used by bot features
async function buildCategories(guild, R, onlySpecial) {
  const everyone = guild.roles.everyone;
  const staff = [R.owner, R.admin, R.mod];

  for (const cat of categories) {
    if (onlySpecial && !cat.channels.some((ch) => ch.special) && !cat.name.includes('TICKETS')) continue;

    const catOw = [];
    if (cat.vis === 'member' || cat.vis === 'staff') catOw.push({ id: everyone.id, deny: [V.ViewChannel] });
    if (cat.vis === 'member') catOw.push({ id: R.player.id, allow: [V.ViewChannel] });
    for (const s of staff) catOw.push({ id: s.id, allow: [V.ViewChannel, V.SendMessages, V.Connect, V.ManageMessages] });
    if (cat.coach) catOw.push({ id: R.coach.id, allow: [V.ViewChannel, V.MoveMembers, V.MuteMembers] });
    catOw.push({ id: R.muted.id, deny: [V.SendMessages, V.Speak, V.AddReactions] });

    let category = guild.channels.cache.find((ch) => ch.type === ChannelType.GuildCategory && ch.name === cat.name);
    category ??= await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: mergeOw(catOw) });

    for (const ch of cat.channels) {
      if (onlySpecial && !ch.special) continue;
      if (guild.channels.cache.some((x) => x.name === ch.name)) continue; // already there (possibly moved by the owner)

      const isVoice = ch.type === 'voice';
      const ow = [...catOw];
      if (ch.readOnly) {
        ow.push({ id: everyone.id, deny: [V.SendMessages, V.AddReactions] });
        ow.push({ id: R.player.id, deny: [V.SendMessages] });
        for (const s of staff) ow.push({ id: s.id, allow: [V.SendMessages] });
      }
      await guild.channels.create({
        name: ch.name,
        type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category.id,
        userLimit: ch.limit,
        permissionOverwrites: mergeOw(ow),
      });
    }
  }
}

// Posts each panel (verify button, role menus, ticket button) if the channel has no bot panel yet
async function ensurePanels(guild) {
  for (const key of Object.keys(panels)) {
    const ch = channelByKey(guild, key);
    if (!ch) continue;
    const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (recent?.some((m) => m.author.id === guild.client.user.id && m.components.length)) continue;
    await ch.send(panels[key]()).catch(console.error);
  }
}

module.exports = { init, commands, specialNames };
