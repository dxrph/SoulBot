const { PermissionFlagsBits: V, MessageFlags, PollLayoutType } = require('discord.js');
const { isStaff } = require('../util');
const { guildSlash } = require('../slash');

const commands = [
  guildSlash('sondaggio', 'Crea un sondaggio per la live (solo staff)')
    .setDefaultMemberPermissions(V.ManageMessages)
    .addStringOption((o) => o.setName('domanda').setDescription('La domanda').setRequired(true).setMaxLength(300))
    .addStringOption((o) => o.setName('opzioni').setDescription('Opzioni separate da |  (es. Shiv | Haze | Infernus)').setRequired(true).setMaxLength(500))
    .addIntegerOption((o) => o.setName('ore').setDescription('Durata in ore (predefinito 24, max 168)').setMinValue(1).setMaxValue(168))
    .addBooleanOption((o) => o.setName('multipla').setDescription('Si può votare più di un\'opzione')),
].map((c) => c.toJSON());

async function run(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può creare un sondaggio.', flags: MessageFlags.Ephemeral });
  const question = i.options.getString('domanda');
  const answers = i.options.getString('opzioni').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (answers.length < 2) {
    return i.reply({ content: 'Servono almeno due opzioni, separate da |.', flags: MessageFlags.Ephemeral });
  }
  if (answers.some((a) => a.length > 55)) {
    return i.reply({ content: 'Ogni opzione può avere al massimo 55 caratteri.', flags: MessageFlags.Ephemeral });
  }
  const hours = i.options.getInteger('ore') ?? 24;
  const multi = i.options.getBoolean('multipla') ?? false;
  try {
    await i.channel.send({
      poll: {
        question: { text: question },
        answers: answers.map((text) => ({ text })),
        duration: hours,
        allowMultiselect: multi,
        layoutType: PollLayoutType?.Default ?? 1,
      },
    });
    await i.reply({ content: 'Sondaggio pubblicato in questo canale.', flags: MessageFlags.Ephemeral });
  } catch (err) {
    console.error(err);
    await i.reply({ content: `Non ho potuto creare il sondaggio: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

async function onInteraction(i) {
  try {
    if (i.isChatInputCommand() && i.commandName === 'sondaggio') return await run(i);
  } catch (err) {
    console.error(err);
  }
}

module.exports = { onInteraction, commands };
