const { PermissionFlagsBits: V } = require('discord.js');

// What @everyone can do on a freshly built server. Stream is the "Video" permission: screen share and camera in voice.
const EVERYONE_PERMS = [V.ViewChannel, V.ReadMessageHistory, V.AddReactions, V.Connect, V.Speak, V.UseVAD, V.Stream,
  V.SendMessages, V.SendMessagesInThreads, V.EmbedLinks, V.AttachFiles, V.UseExternalEmojis, V.CreateInstantInvite, V.ChangeNickname];

// For servers built before Stream was granted: adds only that permission, leaves everything else as the owner set it
async function ensureEveryoneCanStream(guild) {
  const everyone = guild.roles.everyone;
  if (everyone.permissions.has(V.Stream)) return false;
  await everyone.setPermissions(everyone.permissions.add(V.Stream));
  return true;
}

module.exports = { EVERYONE_PERMS, ensureEveryoneCanStream };
