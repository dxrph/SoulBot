const { PermissionFlagsBits: V, MessageFlags, EmbedBuilder } = require('discord.js');
const { channelByKey, isStaff } = require('../util');
const { guildSlash } = require('../slash');
const { palette, LINE, withFooter, baseEmbed } = require('../style');
const store = require('../store');

const TITLE = 'Anime della settimana';

const commands = [
  guildSlash('anime', 'Aggiorna l\'anime della settimana (solo staff)')
    .setDefaultMemberPermissions(V.ManageMessages)
    .addStringOption((o) => o.setName('titolo').setDescription('Quale anime stiamo guardando').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('orario').setDescription('Quando lo guardiamo insieme').setMaxLength(100))
    .addStringOption((o) => o.setName('dove').setDescription('Piattaforma o canale (Crunchyroll, live, ecc.)').setMaxLength(100)),
  guildSlash('anime-off', 'Toglie il pannello anime della settimana (solo staff)')
    .setDefaultMemberPermissions(V.ManageMessages),
].map((c) => c.toJSON());

function card(anime) {
  const lines = [
    `**${anime.title}**`,
    anime.when ? `Orario · ${anime.when}` : null,
    anime.where ? `Dove · ${anime.where}` : null,
    `${LINE}`,
    'Ci vediamo in live, o in **Guardiamo la Live**, per guardarlo insieme.',
    '*This week\'s anime. Join the stream or the watch-party voice room.*',
  ].filter(Boolean);
  return withFooter(baseEmbed(palette.accent).setTitle(TITLE).setDescription(lines.join('\n')));
}

async function upsertPanel(guild, anime) {
  const ch = channelByKey(guild, 'schedule');
  if (!ch?.isTextBased()) return null;
  const recent = await ch.messages.fetch({ limit: 30 }).catch(() => null);
  const mine = recent && [...recent.values()].find((m) => m.author.id === guild.client.user.id && m.embeds[0]?.title === TITLE);
  if (!anime) {
    if (mine) await mine.delete().catch(() => {});
    return null;
  }
  const payload = { embeds: [card(anime)] };
  if (mine) return mine.edit(payload);
  return ch.send(payload);
}

async function setAnime(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può aggiornare l\'anime della settimana.', flags: MessageFlags.Ephemeral });
  const anime = {
    title: i.options.getString('titolo'),
    when: i.options.getString('orario'),
    where: i.options.getString('dove'),
  };
  store.setAnime(i.guildId, anime);
  const msg = await upsertPanel(i.guild, anime);
  await i.reply({ content: msg ? `Pannello aggiornato: ${msg.url}` : 'Salvato, ma non trovo il canale programma. Usa /add-tools.', flags: MessageFlags.Ephemeral });
}

async function clearAnime(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può togliere il pannello.', flags: MessageFlags.Ephemeral });
  store.setAnime(i.guildId, null);
  await upsertPanel(i.guild, null);
  await i.reply({ content: 'Pannello anime rimosso.', flags: MessageFlags.Ephemeral });
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'anime') return await setAnime(i);
      if (i.isChatInputCommand() && i.commandName === 'anime-off') return await clearAnime(i);
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { init, commands };
