const { PermissionFlagsBits: V, ChannelType } = require('discord.js');
const { channelByKey, mergeOw } = require('../util');

// Temp rooms are the voice channels whose name starts with this prefix (or that were created this session)
const PREFIX = '🔊 ';
const temp = new Set();
const isTemp = (ch) => ch && (temp.has(ch.id) || ch.name.startsWith(PREFIX));

function init(client) {
  client.once('clientReady', async () => {
    for (const g of client.guilds.cache.values()) {
      for (const ch of g.channels.cache.values()) {
        if (ch.type === ChannelType.GuildVoice && ch.name.startsWith(PREFIX) && ch.members.size === 0) {
          await ch.delete('Empty temp room').catch(() => {});
        }
      }
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
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init };
