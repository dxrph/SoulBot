const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder, MessageFlags, SlashCommandBuilder,
} = require('discord.js');
const path = require('node:path');
const { roles } = require('../template');
const { roleMap, channelByKey, isStaff, logEvent } = require('../util');
const { verifiedRanks, rankByKey } = require('../ranks');
const { diffRoles } = require('../roleDiff');
const { encodeRequest, decodeRequest, checkRequest } = require('../rankRequest');

const commands = [
  new SlashCommandBuilder()
    .setName('verifica-rank')
    .setDescription('Ask staff to verify an Emissary or higher rank')
    .setDMPermission(false)
    .addStringOption((o) => o.setName('rank').setDescription('Your rank').setRequired(true)
      .addChoices(...verifiedRanks.map((r) => ({ name: r.name, value: r.key }))))
    .addAttachmentOption((o) => o.setName('screenshot').setDescription('Screenshot of your Deadlock profile showing the rank').setRequired(true)),
].map((c) => c.toJSON());

const refuse = (i, content) => i.reply({ content, flags: MessageFlags.Ephemeral });

async function request(i) {
  const queue = channelByKey(i.guild, 'rankqueue');
  if (!queue) return refuse(i, 'Rank requests are not set up yet. Ask staff to run /add-tools.');
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

  // The screenshot is re-uploaded so the card keeps it after the original link expires
  const file = new AttachmentBuilder(shot.url, { name: `screenshot${path.extname(shot.name) || '.png'}` });
  await queue.send({
    embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🎖️ Rank request')
      .setDescription(`<@${i.user.id}> asks for **${rankByKey(rankKey).name}**`)
      .setImage(`attachment://${file.name}`).setFooter({ text: encodeRequest(i.user.id, rankKey) })],
    files: [file],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rankq:ok').setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rankq:no').setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger),
    )],
  });
  await i.editReply('📨 Sent to staff. You will get a message when it is reviewed.');
}

async function review(i, approve) {
  if (!isStaff(i.member)) return refuse(i, 'Only staff can review rank requests.');
  const req = decodeRequest(i.message.embeds[0]?.footer?.text);
  if (!req) return refuse(i, 'I cannot read this request.');
  if (req.userId === i.user.id) return refuse(i, 'You cannot review your own request.');
  await i.deferUpdate();

  const embed = EmbedBuilder.from(i.message.embeds[0]);
  const rank = rankByKey(req.rankKey);
  const member = await i.guild.members.fetch(req.userId).catch(() => null);
  if (!member) {
    embed.setColor(0x95a5a6).addFields({ name: 'Status', value: 'The member left the server.' });
    return i.editReply({ embeds: [embed], components: [] });
  }

  if (approve) {
    const R = roleMap(i.guild);
    const allRanks = roles.filter((r) => r.group === 'rank').map((r) => R[r.key]).filter(Boolean);
    const { add, remove } = diffRoles(allRanks, [R[req.rankKey]].filter(Boolean), (r) => member.roles.cache.has(r.id));
    if (remove.length) await member.roles.remove(remove);
    if (add.length) await member.roles.add(add);
  }
  const verdict = approve ? `✅ Approved by <@${i.user.id}>` : `❌ Rejected by <@${i.user.id}>`;
  embed.setColor(approve ? 0x2ecc71 : 0xe74c3c).addFields({ name: 'Status', value: verdict });
  await i.editReply({ embeds: [embed], components: [] });
  member.send(approve
    ? `✅ Your **${rank.name}** rank was verified in ${i.guild.name}.`
    : `❌ Your **${rank.name}** request in ${i.guild.name} was not approved. You can send a clearer screenshot with /verifica-rank.`)
    .catch(() => {});
  logEvent(i.guild, { title: `🎖️ Rank ${approve ? 'approved' : 'rejected'}`, color: approve ? 0x2ecc71 : 0xe74c3c,
    description: `<@${req.userId}> · ${rank.name} · by <@${i.user.id}>` });
}

function init(client) {
  client.on('interactionCreate', async (i) => {
    try {
      if (i.isChatInputCommand() && i.commandName === 'verifica-rank') return await request(i);
      if (i.isButton() && i.customId === 'rankq:ok') return await review(i, true);
      if (i.isButton() && i.customId === 'rankq:no') return await review(i, false);
    } catch (err) {
      console.error(err);
      if (i.deferred || i.replied) await i.editReply({ content: 'Something went wrong. Try again or ask staff.' }).catch(() => {});
    }
  });
}

module.exports = { init, commands };
