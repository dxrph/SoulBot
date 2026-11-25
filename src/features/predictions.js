// /predizione (staff): "Vinco o perdo?" with two buttons. Staff closes the votes, then picks the result:
// whoever guessed right gets XP (levels). State in memory: a bot restart cancels an open prediction.
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits: V,
} = require('discord.js');
const { settings, streamer } = require('../template');
const { isStaff } = require('../util');
const { guildSlash } = require('../slash');
const { palette, LINE, withFooter, baseEmbed } = require('../style');
const { grantXp } = require('./levels');

const CFG = settings.predictions;
const preds = new Map(); // messageId -> { question, votes: Map<userId, 'win'|'lose'>, open, timer, hostId }

const commands = [
  guildSlash('predizione', 'Apri una predizione per la partita in live (solo staff)')
    .setDefaultMemberPermissions(V.ManageMessages)
    .addStringOption((o) => o.setName('domanda').setDescription('Predefinita: Vinco o perdo?').setMaxLength(200))
    .addIntegerOption((o) => o.setName('minuti').setDescription(`Minuti per votare (predefinito ${CFG.voteMinutes})`).setMinValue(1).setMaxValue(60)),
].map((c) => c.toJSON());

function tally(p) {
  let win = 0; let lose = 0;
  for (const v of p.votes.values()) if (v === 'win') win += 1; else lose += 1;
  return { win, lose };
}

function predEmbed(p, result) {
  const { win, lose } = tally(p);
  const total = win + lose || 1;
  const pct = (n) => Math.round((n / total) * 100);
  let status = p.open ? 'Votazioni **aperte**: premi un pulsante (puoi cambiare idea finché sono aperte).' : 'Votazioni **chiuse**. Si aspetta il verdetto dello staff.';
  if (result) {
    const right = [...p.votes.entries()].filter(([, v]) => v === result).length;
    status = `Risultato: **${result === 'win' ? 'VITTORIA 🏆' : 'SCONFITTA 💀'}**. ${right} veggenti indovinano${CFG.xp ? ` e prendono **${CFG.xp} XP**` : ''}.`;
  }
  return withFooter(baseEmbed(result ? palette.muted : palette.accent)
    .setTitle(`🔮 ${p.question}`.slice(0, 256))
    .setDescription(`${status}\n${LINE}\n🏆 Vince: **${win}** (${pct(win)}%)\n💀 Perde: **${lose}** (${pct(lose)}%)`), 'Predizione');
}

const voteRow = (disabled) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('pred:win').setLabel(`Vince ${streamer.name}`).setEmoji('🏆').setStyle(ButtonStyle.Success).setDisabled(disabled),
  new ButtonBuilder().setCustomId('pred:lose').setLabel('Perde').setEmoji('💀').setStyle(ButtonStyle.Danger).setDisabled(disabled),
);
const staffRow = (open) => new ActionRowBuilder().addComponents(
  ...(open ? [new ButtonBuilder().setCustomId('pred:close').setLabel('Chiudi voti (staff)').setEmoji('🔒').setStyle(ButtonStyle.Secondary)] : []),
  new ButtonBuilder().setCustomId('pred:res:win').setLabel('Ha vinto').setEmoji('✅').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('pred:res:lose').setLabel('Ha perso').setEmoji('❌').setStyle(ButtonStyle.Secondary),
);
const rows = (p) => [voteRow(!p.open), staffRow(p.open)];

async function start(i) {
  if (!CFG.enabled) return i.reply({ content: 'Le predizioni sono spente.', flags: MessageFlags.Ephemeral });
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può aprire una predizione.', flags: MessageFlags.Ephemeral });
  const minutes = i.options.getInteger('minuti') ?? CFG.voteMinutes;
  const p = { question: i.options.getString('domanda') ?? 'Vinco o perdo?', votes: new Map(), open: true, hostId: i.user.id };
  const msg = await i.channel.send({ embeds: [predEmbed(p)], components: rows(p) });
  preds.set(msg.id, p);
  p.timer = setTimeout(() => {
    if (!p.open) return;
    p.open = false;
    msg.edit({ embeds: [predEmbed(p)], components: rows(p) }).catch(() => {});
  }, minutes * 60_000);
  return i.reply({ content: `Predizione aperta per ${minutes} min. Un riavvio del bot la annulla.`, flags: MessageFlags.Ephemeral });
}

async function vote(i, side) {
  const p = preds.get(i.message.id);
  if (!p) return i.reply({ content: 'Questa predizione non è più attiva.', flags: MessageFlags.Ephemeral });
  if (!p.open) return i.reply({ content: 'Votazioni chiuse, troppo tardi veggente.', flags: MessageFlags.Ephemeral });
  p.votes.set(i.user.id, side);
  await i.update({ embeds: [predEmbed(p)], components: rows(p) });
  return i.followUp({ content: side === 'win' ? 'Hai puntato sulla vittoria 🏆' : 'Hai puntato sulla sconfitta 💀 (coraggioso)', flags: MessageFlags.Ephemeral });
}

async function close(i) {
  const p = preds.get(i.message.id);
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff.', flags: MessageFlags.Ephemeral });
  if (!p) return i.reply({ content: 'Questa predizione non è più attiva.', flags: MessageFlags.Ephemeral });
  p.open = false;
  clearTimeout(p.timer);
  return i.update({ embeds: [predEmbed(p)], components: rows(p) });
}

async function resolve(i, result) {
  const p = preds.get(i.message.id);
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff.', flags: MessageFlags.Ephemeral });
  if (!p) return i.reply({ content: 'Questa predizione non è più attiva.', flags: MessageFlags.Ephemeral });
  preds.delete(i.message.id);
  clearTimeout(p.timer);
  p.open = false;
  await i.update({ embeds: [predEmbed(p, result)], components: [] });
  const winners = [...p.votes.entries()].filter(([, v]) => v === result).map(([id]) => id);
  for (const id of winners) {
    const member = await i.guild.members.fetch(id).catch(() => null);
    await grantXp(member, CFG.xp, i.channel);
  }
}

async function onInteraction(i) {
  try {
    if (i.isChatInputCommand() && i.commandName === 'predizione') return await start(i);
    if (!i.isButton() || !i.customId.startsWith('pred:')) return undefined;
    if (i.customId === 'pred:win') return await vote(i, 'win');
    if (i.customId === 'pred:lose') return await vote(i, 'lose');
    if (i.customId === 'pred:close') return await close(i);
    if (i.customId === 'pred:res:win') return await resolve(i, 'win');
    if (i.customId === 'pred:res:lose') return await resolve(i, 'lose');
  } catch (err) {
    console.error(err);
    if (!i.replied && !i.deferred) await i.reply({ content: 'Qualcosa è andato storto.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return undefined;
}

module.exports = { onInteraction, commands, tally };
