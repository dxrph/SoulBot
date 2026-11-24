const { EmbedBuilder } = require('discord.js');
const { channelByKey } = require('../util');
const { palette, withFooter, baseEmbed, LINE } = require('../style');
const store = require('../store');

const REACTION = '🔥';
const CHECK_MS = 30 * 60_000;

function brusselsNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels', weekday: 'short', hour: '2-digit', minute: '2-digit',
    year: 'numeric', month: '2-digit', day: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { weekday: get('weekday'), hour: Number(get('hour')), minute: Number(get('minute')), year: get('year'), month: get('month'), day: get('day') };
}

function isoWeek(d) {
  // d is a Date in local box time; use Brussels calendar date
  const { year, month, day } = brusselsNow();
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const onejan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function isClipMessage(m) {
  if (m.author.bot) return false;
  if (m.attachments.size) return true;
  return /(?:https?:\/\/\S+)|(discord\.com\/attachments)/i.test(m.content);
}

async function pickWinner(channel, client) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60_000;
  let winner = null;
  let best = 0;
  let before;
  for (let i = 0; i < 5; i += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch?.size) break;
    for (const m of batch.values()) {
      if (m.createdTimestamp < cutoff) return winner;
      if (m.author.id === client.user.id || !isClipMessage(m)) continue;
      const count = m.reactions.cache.get(REACTION)?.count ?? 0;
      if (count > best) { best = count; winner = m; }
    }
    before = batch.last()?.id;
    if (batch.last()?.createdTimestamp < cutoff) break;
  }
  return winner;
}

async function postWeekly(guild, client) {
  const week = isoWeek();
  if (store.getLastClipWeek(guild.id) === week) return;
  const now = brusselsNow();
  if (now.weekday !== 'Mon' || now.hour !== 10) return;

  const clips = channelByKey(guild, 'clips');
  const news = channelByKey(guild, 'announcements');
  if (!clips?.isTextBased() || !news?.isTextBased()) return;

  const winner = await pickWinner(clips, client);
  store.setLastClipWeek(guild.id, week);
  if (!winner) {
    await news.send({
      embeds: [withFooter(baseEmbed(palette.accent).setTitle('Clip della settimana')
        .setDescription('Questa settimana non ci sono clip votate in **clip-della-live**. Mandate le vostre e reagite con 🔥!'))],
    }).catch(() => {});
    return;
  }
  const votes = winner.reactions.cache.get(REACTION)?.count ?? 0;
  const embed = withFooter(baseEmbed(palette.accent)
    .setTitle('Clip della settimana')
    .setDescription(
      `${LINE}\nLa clip più votata in **clip-della-live**.\n` +
      `Autore: <@${winner.author.id}> · ${votes} ${REACTION}\n${winner.url}`,
    )
    .setTimestamp(winner.createdAt));
  const image = winner.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (image) embed.setImage(image.url);
  await news.send({ content: `Complimenti <@${winner.author.id}>!`, embeds: [embed], allowedMentions: { users: [winner.author.id] } }).catch(console.error);
}

async function onMessage(m) {
  try {
    if (!m.guild || m.author.bot) return;
    const clips = channelByKey(m.guild, 'clips');
    if (!clips || m.channelId !== clips.id) return;
    if (!isClipMessage(m)) return;
    await m.react(REACTION).catch(() => {});
  } catch (err) {
    console.error(err);
  }
}

function onReady(client) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const g of client.guilds.cache.values()) await postWeekly(g, client);
    } catch (e) { console.error(e); } finally { busy = false; }
  };
  setTimeout(run, 20_000);
  setInterval(run, CHECK_MS).unref();
}

module.exports = { onMessage, onReady };
