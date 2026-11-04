const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, MessageFlags,
} = require('discord.js');
const { streamer } = require('../template');
const { roleMap, channelByKey } = require('../util');
const { parseUptime } = require('../uptime');

// Live alerts for twitch.tv/<streamer.twitch>, from the public DecAPI endpoints (no Twitch keys needed)
const LOGIN = streamer.twitch;
const URL = streamer.links.twitch;
const INTERVAL_MS = 2 * 60_000;
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
const LIVE_FOOTER = '🔴 LIVE';
const ENDED_FOOTER = '⚫ Live finita';

async function decapi(what) {
  const res = await fetch(`https://decapi.me/twitch/${what}/${LOGIN}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.text()).trim();
}

// null = could not check, { live: false }, or { live: true, start, title, game }
async function status() {
  const uptime = await decapi('uptime');
  if (uptime === null) return null;
  const secs = parseUptime(uptime);
  if (secs === null) return { live: false };
  const [title, game] = await Promise.all([decapi('title'), decapi('game')]);
  return { live: true, start: Date.now() - secs * 1000, title: title || 'In live ora', game: game || '' };
}

const twitchButton = (label = 'Guarda su Twitch') => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setLabel(label).setEmoji('🔴').setStyle(ButtonStyle.Link).setURL(URL),
);

function liveEmbed(s) {
  return new EmbedBuilder()
    .setColor(streamer.color)
    .setAuthor({ name: `${streamer.name} è in LIVE`, url: URL })
    .setTitle(s.title.slice(0, 256))
    .setURL(URL)
    .setDescription(`${s.game ? `🎮 **${s.game}**\n` : ''}Entra in chat, la live è più bella con te. 🔥`)
    // ?t= busts Discord's image cache, otherwise every alert shows the same old frame
    .setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${LOGIN}-1280x720.jpg?t=${Date.now()}`)
    .setFooter({ text: LIVE_FOOTER })
    .setTimestamp(s.start);
}

// ---- panels ---------------------------------------------------------------------------------
const LABELS = { twitch: ['Twitch', '🟣'], tiktok: ['TikTok', '🎵'], instagram: ['Instagram', '📸'], youtube: ['YouTube', '▶️'], x: ['X', '✖️'] };
const socialLinks = () => Object.entries(streamer.links).filter(([, url]) => url);

const socialsPayload = () => ({
  embeds: [new EmbedBuilder()
    .setColor(streamer.color)
    .setTitle(`🔗 DOVE TROVARE ${streamer.name}`)
    .setDescription(
      `*${streamer.motto}*\n${LINE}\n` +
      socialLinks().map(([k, url]) => `${LABELS[k]?.[1] ?? '🔗'} **${LABELS[k]?.[0] ?? k}** · ${url}`).join('\n') +
      `\n${LINE}\nSegui, attiva le notifiche e porta un amico: ogni follow ci avvicina al Radiant. 🔥`,
    )],
  components: [new ActionRowBuilder().addComponents(
    ...socialLinks().slice(0, 5).map(([k, url]) => new ButtonBuilder()
      .setLabel(LABELS[k]?.[0] ?? k).setEmoji(LABELS[k]?.[1] ?? '🔗').setStyle(ButtonStyle.Link).setURL(url)),
  )],
});

const panels = {
  live: () => ({
    embeds: [new EmbedBuilder()
      .setColor(streamer.color)
      .setTitle('🔴 QUANDO SONO IN LIVE LO SAI QUI')
      .setDescription(
        `Ogni volta che vado in live su Twitch il bot lo scrive in questo canale.\n${LINE}\n` +
        '🔔 Vuoi il ping? Vai in **ruoli**, premi **Pings** e scegli **🔴 Notifiche Live**.\n' +
        '⌨️ Scrivi `/live` ovunque per vedere se sono online adesso.',
      )],
    components: [twitchButton('Segui su Twitch')],
  }),
  socials: socialsPayload,
  schedule: () => ({
    embeds: [new EmbedBuilder()
      .setColor(streamer.color)
      .setTitle('📅 PROGRAMMA DELLE LIVE')
      .setDescription(
        `Gli orari aggiornati sono sempre sulla pagina Twitch.\n${LINE}\n` +
        '🎮 **Deadlock con la chat** · ranked, partite con voi e build da provare\n' +
        '🤝 **Gioca con me** · entra in **THE BATTLEFIELD** prima della live e fatti trovare in Lobby\n' +
        `${LINE}\nI cambi di orario vengono annunciati in **annunci**.`,
      )],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Programma su Twitch').setEmoji('📅').setStyle(ButtonStyle.Link).setURL(`${URL}/schedule`),
    )],
  }),
};

// ---- alerts ---------------------------------------------------------------------------------
async function lastAlert(ch, client) {
  const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
  return [...(recent?.values() ?? [])].find((m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === LIVE_FOOTER);
}

async function check(client) {
  const s = await status();
  if (!s) return; // DecAPI down: try again later, never post a wrong alert
  for (const guild of client.guilds.cache.values()) {
    const ch = channelByKey(guild, 'live');
    if (!ch?.isTextBased()) continue;
    const last = await lastAlert(ch, client);

    if (!s.live) {
      // Mark the previous alert as finished so nobody joins an offline channel
      if (last) {
        const ended = EmbedBuilder.from(last.embeds[0]).setAuthor({ name: `${streamer.name} era in live`, url: URL })
          .setFooter({ text: ENDED_FOOTER }).setImage(null);
        await last.edit({ embeds: [ended], components: [twitchButton('Rivedi su Twitch')] }).catch(() => {});
      }
      continue;
    }
    // Same stream already announced (also survives bot restarts: state lives in the message)
    if (last && Math.abs(Date.parse(last.embeds[0].timestamp) - s.start) < 15 * 60_000) continue;

    const ping = roleMap(guild).live;
    await ch.send({
      content: ping ? `${ping} **${streamer.name}** è in live! 🔥` : `**${streamer.name}** è in live! 🔥`,
      allowedMentions: { roles: ping ? [ping.id] : [] },
      embeds: [liveEmbed(s)],
      components: [twitchButton()],
    }).catch(console.error);
  }
}

// ---- commands -------------------------------------------------------------------------------
const commands = [
  new SlashCommandBuilder().setName('live').setDescription(`${streamer.name} è in live adesso?`).setDMPermission(false),
  new SlashCommandBuilder().setName('social').setDescription(`Tutti i social di ${streamer.name}`).setDMPermission(false),
].map((c) => c.toJSON());

function init(client) {
  client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    try {
      if (i.commandName === 'social') return await i.reply({ ...socialsPayload(), flags: MessageFlags.Ephemeral });
      if (i.commandName !== 'live') return;
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const s = await status();
      if (!s) return await i.editReply('Non riesco a controllare Twitch adesso, riprova tra poco.');
      if (s.live) return await i.editReply({ embeds: [liveEmbed(s)], components: [twitchButton()] });
      await i.editReply({ content: `⚫ ${streamer.name} è offline. Segui il canale per sapere quando torna!`, components: [twitchButton('Segui su Twitch')] });
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
