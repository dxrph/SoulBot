const { PermissionFlagsBits: V, ChannelType } = require('discord.js');
const { channelByKey, mergeOw } = require('../util');

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

function init(client) {
  client.once('clientReady', async () => {
    for (const g of client.guilds.cache.values()) {
      for (const ch of g.channels.cache.values()) {
        if (ch.type === ChannelType.GuildVoice && ch.name.startsWith(PREFIX) && ch.members.size === 0) {
          await ch.delete('Empty temp room').catch(() => {});
        }
      }
      await balance(g);
    }
  });

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
        await newS.setChannel(room).catch(() => room.delete().catch(() => {}));
      }

      const left = oldS.channel;
      if (isTemp(left) && left.members.size === 0) {
        temp.delete(left.id);
        await left.delete('Empty temp room').catch(() => {});
      }

      if (oldS.channelId !== newS.channelId) await balance(guild);
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init };
