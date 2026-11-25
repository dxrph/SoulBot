const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { settings } = require('../template');
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

// Already posted this week? The footer of the announcement carries the week, so a redeploy
// (which wipes data.json on Railway) never posts the same highlight twice.
async function alreadyPosted(news, client, week) {
  const recent = await news.messages.fetch({ limit: 30 }).catch(() => null);
  return [...(recent?.values() ?? [])].some((m) => m.author.id === client.user.id
    && (m.embeds[0]?.footer?.text ?? '').includes(`Clip ${week}`));
}

function highlightEmbed(winner, votes, week) {
  const image = winner.attachments.find((a) => a.contentType?.startsWith('image/'));
  const video = winner.attachments.find((a) => a.contentType?.startsWith('video/'));
  const link = winner.content.match(/https?:\/\/\S+/)?.[0];
  const quote = winner.content.replace(/https?:\/\/\S+/g, '').trim();
  const embed = withFooter(baseEmbed(palette.accent)
    .setAuthor({ name: `${winner.member?.displayName ?? winner.author.username} · Clip della settimana`, iconURL: winner.author.displayAvatarURL() })
    .setTitle('🏆 La clip più votata della settimana')
    .setURL(winner.url)
    .setDescription(
      `${quote ? `> ${quote.slice(0, 300)}\n` : ''}${LINE}\n` +
      `🔥 **${votes}** voti in **clip-della-live**\n` +
      `${link ? `🎬 ${link}\n` : ''}${video ? `🎬 [Guarda il video](${video.url})\n` : ''}` +
      'Vuoi esserci la prossima settimana? Manda la tua clip e fatti votare con 🔥.',
    )
    .setThumbnail(winner.author.displayAvatarURL())
    .setTimestamp(winner.createdAt), `Clip ${week}`);
  if (image) embed.setImage(image.url);
  return embed;
}

async function postWeekly(guild, client) {
  if (!settings.clipHighlight.enabled) return;
  const week = isoWeek();
  if (store.getLastClipWeek(guild.id) === week) return;
  const now = brusselsNow();
  if (now.weekday !== 'Mon' || now.hour !== 10) return;

  const clips = channelByKey(guild, 'clips');
  const news = channelByKey(guild, 'announcements');
  if (!clips?.isTextBased() || !news?.isTextBased()) return;
  if (await alreadyPosted(news, client, week)) { store.setLastClipWeek(guild.id, week); return; }

  const winner = await pickWinner(clips, client);
  store.setLastClipWeek(guild.id, week);
  if (!winner) {
    await news.send({
      embeds: [withFooter(baseEmbed(palette.accent).setTitle('Clip della settimana')
        .setDescription('Questa settimana non ci sono clip votate in **clip-della-live**. Mandate le vostre e reagite con 🔥!'), `Clip ${week}`)],
    }).catch(() => {});
    return;
  }
  const votes = winner.reactions.cache.get(REACTION)?.count ?? 0;
  await news.send({
    content: `Complimenti <@${winner.author.id}>! 👑`,
    embeds: [highlightEmbed(winner, votes, week)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Vai alla clip').setEmoji('🎬').setStyle(ButtonStyle.Link).setURL(winner.url),
    )],
    allowedMentions: { users: [winner.author.id] },
  }).catch(console.error);
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

module.exports = { onMessage, onReady, highlightEmbed };
