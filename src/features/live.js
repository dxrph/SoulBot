const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { streamer } = require('../template');
const { roleMap, channelByKey, logEvent } = require('../util');
const { parseUptime } = require('../uptime');
const { guildSlash } = require('../slash');
const { palette, LINE, withFooter, baseEmbed } = require('../style');
const store = require('../store');
const liveState = require('../liveState');

const TWITCH_LOGIN = streamer.twitch;
const TWITCH_URL = streamer.links.twitch;
const KICK_LOGIN = streamer.kick;
const KICK_URL = streamer.links.kick;
const INTERVAL_MS = 2 * 60_000;
const LIVE_TWITCH = 'LIVE · Twitch';
const LIVE_KICK = 'LIVE · Kick';
const ENDED = 'Live finita';

async function decapi(what) {
  const res = await fetch(`https://decapi.me/twitch/${what}/${TWITCH_LOGIN}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.text()).trim();
}

async function twitchStatus() {
  const uptime = await decapi('uptime');
  if (uptime === null) return null;
  const secs = parseUptime(uptime);
  if (secs === null) return { live: false };
  const [title, game] = await Promise.all([decapi('title'), decapi('game')]);
  return { live: true, start: Date.now() - secs * 1000, title: title || 'In live ora', game: game || '' };
}

async function kickStatus() {
  if (!KICK_LOGIN || !KICK_URL) return { live: false };
  const res = await fetch(`https://kick.com/api/v2/channels/${KICK_LOGIN}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SoulBot/1.0' },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  const live = data.livestream;
  if (!live) return { live: false };
  const start = Date.parse(live.start_time || live.created_at || live.started_at) || Date.now();
  return {
    live: true,
    start,
    title: live.session_title || live.title || 'In live ora',
    game: live.category?.name || data.recent_categories?.[0]?.name || '',
  };
}

const linkButton = (url, label, emoji = '🔴') => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Link).setURL(url),
);

function liveEmbed(s, platform) {
  const url = platform === 'kick' ? KICK_URL : TWITCH_URL;
  const label = platform === 'kick' ? 'Kick' : 'Twitch';
  const image = platform === 'twitch'
    ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_LOGIN}-1280x720.jpg?t=${Date.now()}`
    : (s.thumbnail || null);
  const embed = withFooter(new EmbedBuilder()
    .setColor(palette.live)
    .setAuthor({ name: `${streamer.name} è in LIVE su ${label}`, url })
    .setTitle(s.title.slice(0, 256))
    .setURL(url)
    .setDescription(`${s.game ? `**${s.game}**\n` : ''}Entra in chat, la live è più bella con te.`)
    .setTimestamp(s.start), platform === 'kick' ? LIVE_KICK : LIVE_TWITCH);
  if (image) embed.setImage(image);
  return embed;
}

const LABELS = {
  twitch: ['Twitch', '🟣'],
  kick: ['Kick', '🟢'],
  tiktok: ['TikTok', '🎵'],
  instagram: ['Instagram', '📸'],
  youtube: ['YouTube', '▶️'],
  x: ['X', '✖️'],
};
const socialLinks = () => Object.entries(streamer.links).filter(([, url]) => url);

const socialsPayload = () => ({
  embeds: [withFooter(baseEmbed(palette.primary)
    .setTitle(`Dove trovare ${streamer.name}`)
    .setDescription(
      `*${streamer.motto}*\n${LINE}\n` +
      socialLinks().map(([k, url]) => `${LABELS[k]?.[1] ?? '🔗'} **${LABELS[k]?.[0] ?? k}** · ${url}`).join('\n') +
      `\n${LINE}\nSegui, attiva le notifiche e porta un amico: ogni follow ci avvicina al Radiant.`,
    ))],
  components: [new ActionRowBuilder().addComponents(
    ...socialLinks().slice(0, 5).map(([k, url]) => new ButtonBuilder()
      .setLabel(LABELS[k]?.[0] ?? k).setEmoji(LABELS[k]?.[1] ?? '🔗').setStyle(ButtonStyle.Link).setURL(url)),
  )],
});

const panels = {
  live: () => ({
    embeds: [withFooter(baseEmbed(palette.primary)
      .setTitle('Quando sono in live lo sai qui')
      .setDescription(
        `Ogni volta che vado in live su Twitch o su Kick il bot lo scrive in questo canale.\n${LINE}\n` +
        'Vuoi il ping? Vai in **ruoli**, premi **Notifiche** e scegli **Scouter**.\n' +
        'Scrivi `/live` ovunque per vedere se sono online adesso.',
      ))],
    components: [linkButton(TWITCH_URL, 'Segui su Twitch'), linkButton(KICK_URL, 'Segui su Kick', '🟢')].slice(0, 1)
      .concat(KICK_URL ? [] : []),
  }),
  socials: socialsPayload,
  schedule: (guild) => {
    const anime = guild ? require('../store').getAnime(guild.id) : null;
    const animeLine = anime
      ? `\n${LINE}\n**Anime della settimana** · ${anime.title}` +
        `${anime.when ? ` · ${anime.when}` : ''}${anime.where ? ` · ${anime.where}` : ''}`
      : '';
    return {
      embeds: [withFooter(baseEmbed(palette.primary)
        .setTitle('Programma delle live')
        .setDescription(
          `Gli orari aggiornati sono sempre sulla pagina Twitch e Kick.\n${LINE}\n` +
          '**Deadlock con la chat** · ranked, partite con voi e build da provare\n' +
          '**Gioca con me** · entra in **THE BATTLEFIELD** prima della live e fatti trovare in Lobby' +
          `${animeLine}\n${LINE}\nI cambi di orario vengono annunciati in **annunci**.`,
        ))],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Programma su Twitch').setEmoji('📅').setStyle(ButtonStyle.Link).setURL(`${TWITCH_URL}/schedule`),
        ...(KICK_URL ? [new ButtonBuilder().setLabel('Kick').setEmoji('🟢').setStyle(ButtonStyle.Link).setURL(KICK_URL)] : []),
      )],
    };
  },
};

// Fix live panel: two link buttons in one row
panels.live = () => ({
  embeds: [withFooter(baseEmbed(palette.primary)
    .setTitle('Quando sono in live lo sai qui')
    .setDescription(
      `Ogni volta che vado in live su Twitch o su Kick il bot lo scrive in questo canale.\n${LINE}\n` +
      'Vuoi il ping? Vai in **ruoli**, premi **Notifiche** e scegli **Scouter**.\n' +
      'Scrivi `/live` ovunque per vedere se sono online adesso.',
    ))],
  components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Segui su Twitch').setEmoji('🔴').setStyle(ButtonStyle.Link).setURL(TWITCH_URL),
    ...(KICK_URL ? [new ButtonBuilder().setLabel('Segui su Kick').setEmoji('🟢').setStyle(ButtonStyle.Link).setURL(KICK_URL)] : []),
  )],
});

function footerOf(message) {
  return message.embeds[0]?.footer?.text ?? '';
}

async function lastAlert(ch, client, tag) {
  const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
  return [...(recent?.values() ?? [])].find((m) => m.author.id === client.user.id && footerOf(m).includes(tag));
}

async function closeAlert(last, url, label) {
  if (!last) return;
  const ended = withFooter(EmbedBuilder.from(last.embeds[0])
    .setAuthor({ name: `${streamer.name} era in live su ${label}`, url })
    .setImage(null), ENDED);
  const btn = label === 'Kick' ? linkButton(url, 'Rivedi su Kick', '🟢') : linkButton(url, 'Rivedi su Twitch');
  await last.edit({ embeds: [ended], components: [btn] }).catch(() => {});
}

async function announce(guild, s, platform) {
  const ch = channelByKey(guild, 'live');
  if (!ch?.isTextBased()) return;
  const tag = platform === 'kick' ? LIVE_KICK : LIVE_TWITCH;
  const url = platform === 'kick' ? KICK_URL : TWITCH_URL;
  const label = platform === 'kick' ? 'Kick' : 'Twitch';
  const last = await lastAlert(ch, guild.client, tag);

  if (!s || s.live === undefined) return;
  if (!s.live) {
    await closeAlert(last, url, label);
    return;
  }
  if (last && !footerOf(last).includes(ENDED) && Math.abs(Date.parse(last.embeds[0].timestamp) - s.start) < 15 * 60_000) return;

  const ping = roleMap(guild).live;
  await ch.send({
    content: ping ? `${ping} **${streamer.name}** è in live su ${label}!` : `**${streamer.name}** è in live su ${label}!`,
    allowedMentions: { roles: ping ? [ping.id] : [] },
    embeds: [liveEmbed(s, platform)],
    components: [linkButton(url, `Guarda su ${label}`, platform === 'kick' ? '🟢' : '🔴')],
  }).catch(console.error);
}

async function check(client) {
  const [twitch, kick] = await Promise.all([twitchStatus(), kickStatus()]);
  liveState.state.twitch = !!(twitch && twitch.live);
  liveState.state.kick = !!(kick && kick.live);

  for (const guild of client.guilds.cache.values()) {
    if (twitch === null) {
      const fails = store.decapiFail(guild.id, false);
      if (fails === 3) {
        logEvent(guild, {
          title: 'Twitch non raggiungibile',
          color: palette.warn,
          description: 'DecAPI non risponde da tre controlli. Gli alert Twitch sono in pausa, quelli Kick continuano. Riproverò da solo.',
        });
      }
    } else {
      store.decapiFail(guild.id, true);
      await announce(guild, twitch, 'twitch');
    }
    if (kick) await announce(guild, kick, 'kick');
  }
}

const commands = [
  guildSlash('live', `${streamer.name} è in live adesso?`),
  guildSlash('social', `Tutti i social di ${streamer.name}`),
].map((c) => c.toJSON());

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    try {
      if (i.commandName === 'social') return await i.reply({ ...socialsPayload(), flags: MessageFlags.Ephemeral });
      if (i.commandName !== 'live') return;
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const [twitch, kick] = await Promise.all([twitchStatus(), kickStatus()]);
      if (twitch === null && kick === null) {
        return await i.editReply('Non riesco a controllare Twitch e Kick adesso, riprova tra poco.');
      }
      const embeds = [];
      const components = [];
      if (twitch?.live) {
        embeds.push(liveEmbed(twitch, 'twitch'));
        components.push(linkButton(TWITCH_URL, 'Guarda su Twitch'));
      }
      if (kick?.live) {
        embeds.push(liveEmbed(kick, 'kick'));
        components.push(linkButton(KICK_URL, 'Guarda su Kick', '🟢'));
      }
      if (embeds.length) return await i.editReply({ embeds, components });
      await i.editReply({
        content: `${streamer.name} è offline. Segui Twitch o Kick per sapere quando torna!`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Segui su Twitch').setEmoji('🔴').setStyle(ButtonStyle.Link).setURL(TWITCH_URL),
          ...(KICK_URL ? [new ButtonBuilder().setLabel('Segui su Kick').setEmoji('🟢').setStyle(ButtonStyle.Link).setURL(KICK_URL)] : []),
        )],
      });
    } catch (err) {
      console.error(err);
    }
  });

  client.once('clientReady', () => {
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try { await check(client); } catch (e) { console.error(e); } finally { busy = false; }
    };
    setTimeout(run, 15_000);
    setInterval(run, INTERVAL_MS).unref();
  });
}

module.exports = { init, panels, commands };
