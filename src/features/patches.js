const { EmbedBuilder } = require('discord.js');
const { channelByKey } = require('../util');

// Official Valve posts for Deadlock (app 1422450) from the public Steam news API
const APP_ID = 1422450;
const FEED = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID}&count=15&maxlength=0`;
const INTERVAL_MS = 15 * 60_000;
const urlOf = (item) => `https://store.steampowered.com/news/app/${APP_ID}/view/${item.gid}`;

// Steam BBCode -> plain Discord text
function clean(text) {
  return text
    .replace(/\{STEAM_CLAN_(LOC_)?IMAGE\}\S+/g, '')
    .replace(/\[\/?(h\d|b|i|u|list|olist|strike|p|quote|code|url|img|previewyoutube)[^\]]*\]/gi, '')
    .replace(/\[\*\]/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function check(client) {
  const res = await fetch(FEED).catch(() => null);
  if (!res?.ok) return;
  const items = ((await res.json()).appnews?.newsitems ?? [])
    .filter((n) => n.feedname === 'steam_community_announcements')
    .sort((a, b) => a.date - b.date);
  if (!items.length) return;

  for (const guild of client.guilds.cache.values()) {
    const ch = channelByKey(guild, 'patches');
    if (!ch) continue;

    // Dedup without a database: urls already posted by the bot in this channel
    const recent = await ch.messages.fetch({ limit: 50 }).catch(() => null);
    if (!recent) continue;
    const posted = new Set(recent.filter((m) => m.author.id === client.user.id).flatMap((m) => m.embeds.map((e) => e.url)));

    let fresh = items.filter((n) => !posted.has(urlOf(n)));
    if (!posted.size) fresh = fresh.slice(-1); // first run: only the latest, don't flood the channel
    for (const n of fresh) {
      const body = clean(n.contents);
      await ch.send({
        embeds: [new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle(n.title.slice(0, 256))
          .setURL(urlOf(n))
          .setDescription(body.length > 3800 ? `${body.slice(0, 3800)}…` : body || null)
          .setFooter({ text: n.author ? `by ${n.author}` : 'Deadlock' })
          .setTimestamp(n.date * 1000)],
      }).catch(console.error);
    }
  }
}

function init(client) {
  client.once('clientReady', () => {
    const run = () => check(client).catch(console.error);
    setTimeout(run, 10_000);
    setInterval(run, INTERVAL_MS).unref();
  });
}

module.exports = { init };
