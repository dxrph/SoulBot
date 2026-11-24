const { EmbedBuilder } = require('discord.js');
const { streamer } = require('../template');
const { palette, LINE, withFooter } = require('../style');

const panels = {
  rules: () => [
    {
      embeds: [withFooter(new EmbedBuilder()
        .setColor(palette.primary)
        .setTitle(`Le regole di ${streamer.name}`)
        .setDescription(`Qui si gioca, si ride e si guarda la live insieme. Poche regole, valgono per tutti.\n${LINE}`)
        .addFields(
          { name: '1 · Rispetto per tutti', value: "Niente insulti, molestie, discorsi d'odio o discriminazioni. Il trash talk in partita resta in partita." },
          { name: '2 · Niente tossicità', value: 'Si gioca per migliorare e divertirsi, non per dare la colpa ai compagni.' },
          { name: '3 · Rispetta la live', value: 'Niente spoiler, hate o raid nella chat di Twitch o Kick. Niente stream sniping: se giochi contro di me in partita, non guardare la live.' },
          { name: '4 · Niente spam né pubblicità', value: 'Niente flood, menzioni di massa o link ad altri canali senza il permesso dello staff. Le tue clip della live vanno in **clip-della-live**.' },
          { name: '5 · Usa il canale giusto', value: 'Cerchi squadra? **cerco-squadra**. Idee per le live? **idee-per-le-live**. Domande sul gioco? **domande-nuovi**.' },
          { name: '6 · Gioca pulito', value: 'Niente cheat, exploit, boosting o vendita di account.' },
          { name: '7 · Contenuti puliti', value: 'Niente NSFW, gore o contenuti illegali, da nessuna parte.' },
          { name: '8 · Proteggi te stesso', value: 'Non condividere password o dati personali. Lo staff non ti chiederà mai le credenziali.' },
          { name: '9 · Decide lo staff', value: "Non sei d'accordo? Apri un ticket in **supporto**, non discutere nei canali pubblici." },
        ),
        'Chi infrange le regole rischia timeout, kick o ban. Valgono i Termini di Servizio di Discord, Twitch e Kick.',
      )],
    },
    {
      embeds: [withFooter(new EmbedBuilder()
        .setColor(palette.accent)
        .setTitle('The rules (EN)')
        .setDescription(
          'Respect everyone · no toxicity · respect the stream (no hate, no stream sniping) · no spam or ads · ' +
          'use the right channel · play fair · no NSFW · never share personal data · staff decisions are final.',
        ),
        'Breaking the rules can lead to a timeout, kick or ban. Press Entra in #verifica to unlock the server.',
      )],
    },
  ],
};

module.exports = { panels, init() {} };
