const {
  PermissionFlagsBits: V, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
} = require('discord.js');
const { channelByKey, mergeOw, roleMap } = require('../util');
const { palette, withFooter, baseEmbed } = require('../style');
const { rateGuard } = require('../rateGuard');

// ---- join-to-create rooms -------------------------------------------------------------------
// Temp rooms are the voice channels whose name starts with this prefix (or that were created this session)
const PREFIX = '🔊 ';
const temp = new Set();
const isTemp = (ch) => ch && (temp.has(ch.id) || ch.name.startsWith(PREFIX));

// ---- self-balancing match rooms -------------------------------------------------------------
// Each group always keeps exactly one empty room: when the last empty one gets a player a new
// one appears, and when extra empty ones pile up they are removed. Rooms with players are never touched.
const GROUPS = [
  { prefix: '🏆 Ranked', limit: 6 },
  { prefix: '🎲 Casual', limit: 6 },
  { prefix: '👥 Duo', limit: 2 },
  { prefix: '👥 Trio', limit: 3 },
];
const numberOf = (name) => Number(name.match(/\s(\d+)\s/)?.[1] ?? 0);
const roomsOf = (guild, g) => guild.channels.cache
  .filter((c) => c.type === ChannelType.GuildVoice && c.name.startsWith(`${g.prefix} `))
  .sort((a, b) => a.rawPosition - b.rawPosition);

const queue = new Map(); // guildId -> promise chain, so balancing never runs twice at once
function balance(guild) {
  const run = (queue.get(guild.id) ?? Promise.resolve()).then(() => balanceNow(guild)).catch(console.error);
  queue.set(guild.id, run);
  return run;
}

async function balanceNow(guild) {
  for (const g of GROUPS) {
    const rooms = [...roomsOf(guild, g).values()];
    if (!rooms.length) continue; // group not set up on this server
    const empty = rooms.filter((c) => c.members.size === 0);

    if (!empty.length) {
      const last = rooms[rooms.length - 1];
      const used = new Set(rooms.map((c) => numberOf(c.name)));
      let n = 1;
      while (used.has(n)) n += 1;
      await guild.channels.create({
        name: `${g.prefix} ${n} (${g.limit})`,
        type: ChannelType.GuildVoice,
        parent: last.parentId,
        userLimit: g.limit,
        position: last.rawPosition + 1,
        permissionOverwrites: mergeOw([...last.permissionOverwrites.cache.values()]),
      });
    } else if (empty.length > 1) {
      // keep the lowest-numbered empty room, delete the rest
      const sorted = empty.sort((a, b) => numberOf(a.name) - numberOf(b.name));
      for (const extra of sorted.slice(1)) await extra.delete('Too many empty rooms').catch(() => {});
    }
  }
}

// ---- control panel for ➕ Create Room rooms ----------------------------------------------------
// Sent in the room's own text chat. The owner is whoever holds the ManageChannels overwrite on the
// room, so ownership survives a bot restart without any stored state.
const RENAME_LIMIT = 2; // Discord allows about 2 name changes per channel every 10 minutes
const renames = rateGuard(RENAME_LIMIT, 10 * 60_000);

function roomPanel(owner) {
  return {
    content: `<@${owner.id}>`,
    allowedMentions: { users: [owner.id] },
    embeds: [withFooter(baseEmbed(palette.accent)
      .setTitle('🎛️ La tua stanza, le tue regole')
      .setDescription(
        `Sei il proprietario di questa stanza, <@${owner.id}>. Solo tu puoi usare i pulsanti.\n` +
        '✏️ **Rinomina** · 🔒 **Blocca/Sblocca** · 👥 **Limite** · 👑 **Passa la stanza**\n' +
        '*Si cancella da sola quando resta vuota. Come un Dominio, ma senza mal di testa.*',
      ))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vroom:rename').setLabel('Rinomina').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vroom:lock').setLabel('Blocca/Sblocca').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vroom:limit').setLabel('Limite').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vroom:transfer').setLabel('Passa la stanza').setEmoji('👑').setStyle(ButtonStyle.Primary),
    )],
  };
}

const ownerOf = (room) => room.permissionOverwrites.cache
  .find((o) => o.type === 1 && o.allow.has(V.ManageChannels))?.id ?? null;

const ephemeral = (i, content) => i.reply({ content, flags: MessageFlags.Ephemeral });

async function rename(i, room) {
  const wait = renames.wait(room.id);
  if (wait) return ephemeral(i, `Discord concede solo ${RENAME_LIMIT} cambi di nome ogni 10 minuti. Riprova tra ${Math.ceil(wait / 60_000)} min.`);
  return i.showModal(new ModalBuilder().setCustomId('vroom:rename-modal').setTitle('Rinomina la stanza')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Nuovo nome').setStyle(TextInputStyle.Short)
        .setMaxLength(100 - PREFIX.length).setRequired(true).setValue(room.name.replace(PREFIX, '').slice(0, 100 - PREFIX.length)),
    )));
}

async function renameSubmit(i, room) {
  const wait = renames.wait(room.id);
  if (wait) return ephemeral(i, `Troppi cambi di nome: riprova tra ${Math.ceil(wait / 60_000)} min.`);
  const name = i.fields.getTextInputValue('name').replace(/\s+/g, ' ').trim();
  if (!name) return ephemeral(i, 'Un nome vuoto? Nemmeno Mahito è così senza forma.');
  renames.hit(room.id);
  await room.setName(`${PREFIX}${name}`.slice(0, 100), `Rinominata da ${i.user.tag}`);
  return ephemeral(i, `Fatto: la stanza ora si chiama **${name}**.`);
}

async function toggleLock(i, room) {
  const R = roleMap(i.guild);
  const targets = [i.guild.roles.everyone, R.player].filter(Boolean);
  const locked = targets.some((r) => room.permissionOverwrites.cache.get(r.id)?.deny.has(V.Connect));
  for (const r of targets) await room.permissionOverwrites.edit(r, { Connect: locked ? null : false });
  if (!locked) {
    // who is already inside can come back after a disconnect
    for (const m of room.members.values()) await room.permissionOverwrites.edit(m.id, { Connect: true }).catch(() => {});
  }
  return ephemeral(i, locked ? '🔓 Stanza sbloccata: porte aperte.' : '🔒 Stanza bloccata: entra solo chi c\'è già (e lo staff).');
}

async function limit(i) {
  return i.showModal(new ModalBuilder().setCustomId('vroom:limit-modal').setTitle('Limite di persone')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('limit').setLabel('Numero massimo (0 = nessun limite, max 99)')
        .setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true),
    )));
}

async function limitSubmit(i, room) {
  const n = Number(i.fields.getTextInputValue('limit').trim());
  if (!Number.isInteger(n) || n < 0 || n > 99) return ephemeral(i, 'Serve un numero tra 0 e 99.');
  await room.setUserLimit(n, `Limite impostato da ${i.user.tag}`);
  return ephemeral(i, n ? `👥 Limite: **${n}** persone.` : '👥 Nessun limite.');
}

async function transfer(i) {
  return i.reply({
    content: 'A chi passi la stanza? Deve essere dentro la stanza.',
    components: [new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('vroom:transfer-select').setPlaceholder('Scegli il nuovo proprietario').setMaxValues(1),
    )],
    flags: MessageFlags.Ephemeral,
  });
}

async function transferSubmit(i, room) {
  const targetId = i.values[0];
  const target = room.members.get(targetId);
  if (!target || target.user.bot) return i.update({ content: 'Deve essere una persona dentro la stanza.', components: [] });
  if (targetId === i.user.id) return i.update({ content: 'È già tua.', components: [] });
  await room.permissionOverwrites.edit(targetId, { ManageChannels: true, MoveMembers: true, MuteMembers: true, Connect: true });
  await room.permissionOverwrites.edit(i.user.id, { ManageChannels: null, MoveMembers: null, MuteMembers: null });
  await i.update({ content: `👑 Stanza passata a <@${targetId}>.`, components: [] });
  await room.send(roomPanel(target)).catch(() => {});
}

async function onInteraction(i) {
  if (!i.customId?.startsWith('vroom:')) return;
  try {
    const room = i.channel;
    if (!room || room.type !== ChannelType.GuildVoice || !isTemp(room)) return ephemeral(i, 'Questo pannello funziona solo nelle stanze create con ➕ Create Room.');
    if (ownerOf(room) !== i.user.id) return ephemeral(i, 'Solo il proprietario della stanza può usarlo.');
    switch (i.customId) {
      case 'vroom:rename': return await rename(i, room);
      case 'vroom:rename-modal': return await renameSubmit(i, room);
      case 'vroom:lock': return await toggleLock(i, room);
      case 'vroom:limit': return await limit(i);
      case 'vroom:limit-modal': return await limitSubmit(i, room);
      case 'vroom:transfer': return await transfer(i);
      case 'vroom:transfer-select': return await transferSubmit(i, room);
      default: return undefined;
    }
  } catch (err) {
    console.error(err);
    if (!i.replied && !i.deferred) await ephemeral(i, 'Non ci sono riuscito, riprova tra poco.').catch(() => {});
  }
}

function init(client) {
  client.on('voiceStateUpdate', async (oldS, newS) => {
    try {
      const guild = newS.guild;
      const hub = channelByKey(guild, 'create');

      if (hub && newS.channelId === hub.id && newS.member) {
        const parent = hub.parent;
        const room = await guild.channels.create({
          name: `${PREFIX}${newS.member.displayName}`.slice(0, 100),
          type: ChannelType.GuildVoice,
          parent: parent?.id,
          // explicit overwrites replace the inherited ones, so copy the category's first
          permissionOverwrites: mergeOw([
            ...(parent ? [...parent.permissionOverwrites.cache.values()] : []),
            { id: newS.member.id, allow: [V.ManageChannels, V.MoveMembers, V.MuteMembers, V.Connect] },
          ]),
        });
        temp.add(room.id);
        try {
          await newS.setChannel(room);
          await room.send(roomPanel(newS.member)).catch(() => {});
        } catch {
          await room.delete().catch(() => {});
        }
      }

      const left = oldS.channel;
      if (isTemp(left) && left.members.size === 0) {
        temp.delete(left.id);
        renames.forget(left.id);
        await left.delete('Empty temp room').catch(() => {});
      }

      if (oldS.channelId !== newS.channelId) await balance(guild);
    } catch (err) {
      console.error(err);
    }
  });
}

async function onReady(client) {
  for (const g of client.guilds.cache.values()) {
    for (const ch of g.channels.cache.values()) {
      if (ch.type === ChannelType.GuildVoice && ch.name.startsWith(PREFIX) && ch.members.size === 0) {
        await ch.delete('Empty temp room').catch(() => {});
      }
    }
    await balance(g);
  }
}

module.exports = {
  init, onReady, onInteraction,
};
