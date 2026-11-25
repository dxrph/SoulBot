// DM reminder: members with the Scouter role (live notifications) get a private message
// settings.reminders.minutesBefore minutes before a Discord scheduled event starts.
// Events are read through the REST API, so no GuildScheduledEvents intent is needed.
// Closed DMs are skipped silently; DMs go out one at a time with a pause (rate limits).
const { GuildScheduledEventStatus } = require('discord.js');
const { settings } = require('../template');
const { roleMap, channelByKey, logEvent } = require('../util');
const { palette } = require('../style');

const CFG = settings.reminders;
const sent = new Set(); // event ids already reminded (this session)
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Is this event inside the reminder window? Lower edge 2 minutes under the target, so a restart a few
// minutes later does not send the same reminder twice.
function due(startMs, now, minutes = CFG.minutesBefore) {
  const left = startMs - now;
  return left > 0 && left <= minutes * 60_000 && left > (minutes - 2) * 60_000;
}

async function remind(guild, event) {
  sent.add(event.id);
  const role = roleMap(guild).live;
  if (!role) return;
  await guild.members.fetch().catch(() => {});
  const rolesCh = channelByKey(guild, 'roles');
  const ts = Math.floor(event.scheduledStartTimestamp / 1000);
  const text = `🔔 **${event.name}** inizia <t:${ts}:R> su **${guild.name}**.\n${event.url}\n` +
    `*Ti arriva perché hai il ruolo ${role.name}. Non lo vuoi più? Toglilo in ${rolesCh ? `#${rolesCh.name}` : 'ruoli'}.*`;
  let ok = 0; let closed = 0;
  for (const m of [...role.members.values()].filter((x) => !x.user.bot).slice(0, CFG.maxDms)) {
    try {
      await m.send({ content: text, allowedMentions: { parse: [] } });
      ok += 1;
    } catch {
      closed += 1; // DMs closed or bot blocked: nothing to do
    }
    await sleep(CFG.delayMs);
  }
  logEvent(guild, { title: '🔔 Promemoria evento', color: palette.primary, description: `${event.name}: ${ok} DM inviati, ${closed} con DM chiusi.` });
}

async function tick(client) {
  if (!CFG.enabled) return;
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    const events = await guild.scheduledEvents.fetch().catch(() => null);
    if (!events) continue;
    for (const e of events.values()) {
      if (sent.has(e.id) || e.status !== GuildScheduledEventStatus.Scheduled) continue;
      if (due(e.scheduledStartTimestamp, now)) await remind(guild, e).catch(console.error);
    }
  }
}

function onReady(client) {
  if (!CFG.enabled) return;
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await tick(client); } catch (e) { console.error(e); } finally { busy = false; }
  }, 60_000).unref();
}

module.exports = { onReady, due };
