const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder, MessageFlags,
} = require('discord.js');
const path = require('node:path');
const { roles } = require('../template');
const { roleMap, channelByKey, isStaff, logEvent } = require('../util');
const { verifiedRanks, rankByKey } = require('../ranks');
const { diffRoles } = require('../roleDiff');
const { encodeRequest, decodeRequest, checkRequest } = require('../rankRequest');
const { guildSlash } = require('../slash');
const { palette, withFooter, baseEmbed } = require('../style');

const commands = [
  guildSlash('verifica-rank', 'Chiedi allo staff di verificare un rank da Emissary in su')
    .addStringOption((o) => o.setName('rank').setDescription('Il tuo rank').setRequired(true)
      .addChoices(...verifiedRanks.map((r) => ({ name: r.name, value: r.key }))))
    .addAttachmentOption((o) => o.setName('screenshot').setDescription('Screenshot del profilo Deadlock con il rank').setRequired(true)),
].map((c) => c.toJSON());

const refuse = (i, content) => i.reply({ content, flags: MessageFlags.Ephemeral });

async function request(i) {
  const queue = channelByKey(i.guild, 'rankqueue');
  if (!queue) return refuse(i, 'Le richieste rank non sono ancora pronte. Chiedi allo staff di usare /add-tools.');
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const rankKey = i.options.getString('rank');
  const shot = i.options.getAttachment('screenshot');
  const R = roleMap(i.guild);
  const recent = await queue.messages.fetch({ limit: 100 });
  const pendingExists = recent.some((m) => m.author.id === i.client.user.id && m.components.length
    && decodeRequest(m.embeds[0]?.footer?.text)?.userId === i.user.id);

  const check = checkRequest({
    rankKey, contentType: shot.contentType, pendingExists,
    alreadyHasRank: !!R[rankKey] && i.member.roles.cache.has(R[rankKey].id),
  });
  if (!check.ok) return i.editReply(check.reason);

  const file = new AttachmentBuilder(shot.url, { name: `screenshot${path.extname(shot.name) || '.png'}` });
  await queue.send({
    embeds: [withFooter(baseEmbed(palette.warn).setTitle('Richiesta rank')
      .setDescription(`<@${i.user.id}> chiede **${rankByKey(rankKey).name}**`)
      .setImage(`attachment://${file.name}`), encodeRequest(i.user.id, rankKey))],
    files: [file],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rankq:ok').setLabel('Approva').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rankq:no').setLabel('Rifiuta').setEmoji('❌').setStyle(ButtonStyle.Danger),
    )],
  });
  await i.editReply('Inviata allo staff. Ti scrivo quando viene esaminata.');
}

async function review(i, approve) {
  if (!isStaff(i.member)) return refuse(i, 'Solo lo staff può esaminare le richieste rank.');
  const req = decodeRequest(i.message.embeds[0]?.footer?.text);
  if (!req) return refuse(i, 'Non riesco a leggere questa richiesta.');
  if (req.userId === i.user.id) return refuse(i, 'Non puoi esaminare la tua richiesta.');
  await i.deferUpdate();

  const embed = EmbedBuilder.from(i.message.embeds[0]);
  const rank = rankByKey(req.rankKey);
  const member = await i.guild.members.fetch(req.userId).catch(() => null);
  if (!member) {
    withFooter(embed.setColor(palette.muted).addFields({ name: 'Stato', value: 'Il membro ha lasciato il server.' }));
    return i.editReply({ embeds: [embed], components: [] });
  }

  if (approve) {
    const R = roleMap(i.guild);
    const allRanks = roles.filter((r) => r.group === 'rank').map((r) => R[r.key]).filter(Boolean);
    const { add, remove } = diffRoles(allRanks, [R[req.rankKey]].filter(Boolean), (r) => member.roles.cache.has(r.id));
    if (remove.length) await member.roles.remove(remove);
    if (add.length) await member.roles.add(add);
  }
  const verdict = approve ? `Approvata da <@${i.user.id}>` : `Rifiutata da <@${i.user.id}>`;
  withFooter(embed.setColor(approve ? palette.ok : palette.live).addFields({ name: 'Stato', value: verdict }));
  await i.editReply({ embeds: [embed], components: [] });
  member.send(approve
    ? `Il tuo rank **${rank.name}** è stato verificato in ${i.guild.name}.`
    : `La tua richiesta **${rank.name}** in ${i.guild.name} non è stata approvata. Puoi mandare uno screenshot più chiaro con /verifica-rank.`)
    .catch(() => {});
  logEvent(i.guild, { title: `Rank ${approve ? 'approvato' : 'rifiutato'}`, color: approve ? palette.ok : palette.live,
    description: `<@${req.userId}> · ${rank.name} · da <@${i.user.id}>` });
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'verifica-rank') return await request(i);
      if (i.isButton() && i.customId === 'rankq:ok') return await review(i, true);
      if (i.isButton() && i.customId === 'rankq:no') return await review(i, false);
    } catch (err) {
      console.error(err);
      if (i.deferred || i.replied) await i.editReply({ content: 'Qualcosa è andato storto. Riprova o chiedi allo staff.' }).catch(() => {});
    }
  });
}

module.exports = { init, commands };
