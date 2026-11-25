// 'Dominio Espanso': temporary role for whoever sits in 📺 Guardiamo la Live while ONYZUK4 is live.
// Removed when they leave the room or when the live ends. Live status comes from live.js (liveState).
const { ChannelType } = require('discord.js');
const { settings } = require('../template');
const { roleMap } = require('../util');
const liveState = require('../liveState');

const CFG = settings.liveRole;
const REASON = 'Dominio Espanso (live)';

const watchRoom = (guild) => guild.channels.cache
  .find((c) => c.type === ChannelType.GuildVoice && c.name === CFG.channelName) ?? null;

// Who should hold the role right now (pure, for tests)
function shouldHave(isLive, inRoom, isBot) {
  return Boolean(isLive && inRoom && !isBot);
}

async function sync(guild) {
  const role = roleMap(guild).domain;
  if (!role) return; // /add-tools creates it
  const room = watchRoom(guild);
  const live = liveState.any();
  const inside = room ? room.members : new Map();
  for (const m of inside.values()) {
    if (shouldHave(live, true, m.user.bot) && !m.roles.cache.has(role.id)) await m.roles.add(role, REASON).catch(() => {});
  }
  for (const m of role.members.values()) {
    if (!shouldHave(live, inside.has(m.id), m.user.bot)) await m.roles.remove(role, REASON).catch(() => {});
  }
}

function init(client) {
  if (!CFG.enabled) return;
  client.on('voiceStateUpdate', async (oldS, newS) => {
    if (oldS.channelId === newS.channelId) return;
    const name = CFG.channelName;
    if (oldS.channel?.name !== name && newS.channel?.name !== name) return;
    await sync(newS.guild).catch(console.error);
  });
}

function onReady(client) {
  if (!CFG.enabled) return;
  // after a restart someone may still hold the role without being in the member cache
  for (const g of client.guilds.cache.values()) g.members.fetch().then(() => sync(g)).catch(() => {});
  // live.js polls every 2 minutes: checking every minute catches the start and the end of the live
  setInterval(() => {
    for (const g of client.guilds.cache.values()) sync(g).catch(console.error);
  }, 60_000).unref();
}

module.exports = { init, onReady, shouldHave };
