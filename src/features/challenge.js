// Sfida del giorno: every day at settings.challenge.hour (Brussels) a Deadlock goal is posted in
// 🎯┃sfida-del-giorno with a thread. People reply in the thread with a screenshot; XP only after a staff
// member presses "Confermo" (anti-abuse). The day is written in the footer, so a redeploy never posts twice.
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ThreadAutoArchiveDuration,
} = require('discord.js');
const { settings } = require('../template');
const { channelByKey, isStaff } = require('../util');
const { palette, LINE, withFooter, baseEmbed } = require('../style');
const { grantXp } = require('./levels');
const CHALLENGES = require('../data/challenges');

const CFG = settings.challenge;
const lastPosted = new Map(); // guildId -> 'YYYY-MM-DD'
const reviewed = new Set(); // `${threadId}:${userId}`: one review per person per challenge

function brussels(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), dm: `${p.day}/${p.month}` };
}

// Same challenge for the whole day, and the list never repeats until it loops
function challengeFor(date) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return CHALLENGES[((day % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}

const tag = (date) => `Sfida ${date}`;

async function postedToday(ch, date) {
  const recent = await ch.messages.fetch({ limit: 10 }).catch(() => null);
  if (!recent) return true; // can't read the channel: better skip than double post
  return [...recent.values()].some((m) => m.author.id === ch.client.user.id && (m.embeds[0]?.footer?.text ?? '').includes(tag(date)));
}

async function post(guild) {
  const now = brussels();
  if (now.hour < CFG.hour || lastPosted.get(guild.id) === now.date) return;
  const ch = channelByKey(guild, 'challenge');
  if (!ch?.isTextBased()) return; // /add-tools creates 🎯┃sfida-del-giorno
  if (await postedToday(ch, now.date)) { lastPosted.set(guild.id, now.date); return; }
  lastPosted.set(guild.id, now.date);
  const msg = await ch.send({
    embeds: [withFooter(baseEmbed(palette.primary)
      .setTitle(`🎯 Sfida del giorno · ${now.dm}`)
      .setDescription(`**${challengeFor(now.date)}**\n${LINE}\nCompletata? Manda lo **screenshot** nel thread qui sotto. ` +
        `Quando lo staff conferma prendi **${CFG.xp} XP**. Niente foto, niente gloria.`), tag(now.date))],
  });
  await msg.startThread({ name: `Sfida ${now.dm}`, autoArchiveDuration: ThreadAutoArchiveDuration.OneDay }).catch(console.error);
}

const isChallengeThread = (m) => m.channel?.isThread?.() && m.channel.parentId === channelByKey(m.guild, 'challenge')?.id
  && m.channel.ownerId === m.client.user.id;

async function onMessage(m) {
  if (!CFG.enabled || !m.guild || m.author.bot || !isChallengeThread(m)) return;
  if (!m.attachments.some((a) => a.contentType?.startsWith('image/'))) return;
  const key = `${m.channelId}:${m.author.id}`;
  if (reviewed.has(key)) return;
  reviewed.add(key);
  await m.reply({
    content: `📸 Screenshot ricevuto. Uno dello staff deve confermare la sfida di <@${m.author.id}>.`,
    allowedMentions: { parse: [] },
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`chal:ok:${m.author.id}`).setLabel('Confermo (staff)').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`chal:no:${m.author.id}`).setLabel('Non valida (staff)').setEmoji('❌').setStyle(ButtonStyle.Secondary),
    )],
  }).catch(() => {});
}

async function review(i) {
  const [, verdict, userId] = i.customId.split(':');
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può confermare le sfide.', flags: MessageFlags.Ephemeral });
  if (userId === i.user.id && i.user.id !== i.guild.ownerId) return i.reply({ content: 'Non puoi confermare la tua sfida da solo, furbetto.', flags: MessageFlags.Ephemeral });
  if (verdict === 'no') {
    reviewed.delete(`${i.channelId}:${userId}`); // can try again with a better screenshot
    return i.update({ content: `❌ Sfida di <@${userId}> non valida (da <@${i.user.id}>). Puoi riprovare con un altro screenshot.`, components: [], allowedMentions: { parse: [] } });
  }
  await i.update({ content: `✅ Sfida di <@${userId}> confermata da <@${i.user.id}>: **+${CFG.xp} XP**.`, components: [], allowedMentions: { parse: [] } });
  const member = await i.guild.members.fetch(userId).catch(() => null);
  await grantXp(member, CFG.xp, i.channel);
  return undefined;
}

async function onInteraction(i) {
  if (!i.isButton() || !i.customId.startsWith('chal:')) return undefined;
  try {
    return await review(i);
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

function onReady(client) {
  if (!CFG.enabled) return;
  const tick = () => { for (const g of client.guilds.cache.values()) post(g).catch(console.error); };
  setTimeout(tick, 90_000);
  setInterval(tick, 5 * 60_000).unref();
}

module.exports = {
  onMessage, onInteraction, onReady, challengeFor, brussels,
};
