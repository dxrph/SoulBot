// 📊 STATISTICHE: locked voice channels whose name shows a live number ("👥 Membri: 37").
// Renamed only when the value changed, at most every 10 minutes (Discord: ~2 renames / 10 min per channel).
const { ChannelType } = require('discord.js');
const { categories, streamer, settings } = require('../template');
const { rateGuard } = require('../rateGuard');

const CFG = settings.stats;
const DEFS = categories.flatMap((c) => c.channels).filter((c) => c.stat);
const guard = rateGuard(2, 10 * 60_000);

let followersCache = null; // last good value, so a decapi hiccup never shows 0

async function followers() {
  if (!CFG.followers) return null;
  const res = await fetch(`https://decapi.me/twitch/followcount/${streamer.twitch}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return followersCache;
  const text = (await res.text()).trim();
  // decapi answers errors with HTTP 200 and a sentence: accept only a plain number ("1,234" too)
  if (/^\d[\d,.]*$/.test(text)) followersCache = Number(text.replace(/[,.]/g, ''));
  return followersCache;
}

// Full channel name for a counter, or null when the value is unknown (then the channel is left alone)
function label(def, { members, follows }) {
  if (def.stat === 'members') return `${def.name}: ${members}`;
  if (def.stat === 'followers') return follows == null ? null : `${def.name}: ${follows}`;
  if (def.stat === 'affiliate') {
    if (follows == null) return null;
    const goal = CFG.affiliateGoal;
    return follows >= goal ? `${def.name}: ✅ ${goal}/${goal}` : `${def.name}: ${follows}/${goal}`;
  }
  return null;
}

async function update(guild, values) {
  for (const def of DEFS) {
    const ch = guild.channels.cache.find((c) => c.type === ChannelType.GuildVoice && c.name.startsWith(def.name));
    if (!ch) continue; // not created yet: /add-tools makes it
    const name = label(def, values)?.slice(0, 100);
    if (!name || name === ch.name || guard.wait(ch.id)) continue;
    guard.hit(ch.id);
    await ch.setName(name, 'Contatore statistiche').catch((e) => console.warn('stats', def.stat, e.message));
  }
}

async function run(client) {
  if (!CFG.enabled) return;
  const follows = await followers();
  for (const guild of client.guilds.cache.values()) {
    await update(guild, { members: guild.memberCount, follows });
  }
}

function onReady(client) {
  if (!CFG.enabled) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await run(client); } catch (e) { console.error(e); } finally { busy = false; }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, Math.max(10, CFG.intervalMinutes) * 60_000).unref();
  client.on('statsCheck', tick); // right after /add-tools creates the channels
}

module.exports = { onReady, label };
