const { EmbedBuilder } = require('discord.js');

const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';

const panels = {
  rules: () => [
    {
      embeds: [new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('📜 THE LAW OF THE HIDDEN KING')
        .setDescription(
          `Welcome to the hunt. Follow these rules and everyone has a good time.\n${LINE}`,
        )
        .addFields(
          { name: '1 · 🤝 Respect everyone', value: 'No insults, harassment, hate speech or discrimination. Trash talk in-game stays in-game.' },
          { name: '2 · 🚫 No toxicity', value: 'Blaming, flaming and rage-quitting teammates is not welcome here. Play to improve, not to blame.' },
          { name: '3 · 🎮 Play fair', value: 'No cheats, exploits, boosting, smurfing to stomp lower ranks, or selling accounts.' },
          { name: '4 · 📢 No spam or ads', value: 'No flooding, repeated messages, mass mentions, unsolicited invites or self-promotion without staff approval.' },
          { name: '5 · 🗂️ Use the right channel', value: 'Looking for a team? Use **looking-for-group**. Questions? **newcomer-questions**. Keep every topic where it belongs.' },
          { name: '6 · 🔞 Keep it clean', value: 'No NSFW, gore, or illegal content anywhere on the server.' },
          { name: '7 · 🔐 Protect yourself', value: 'Never share passwords or personal data. Staff will never ask for your login.' },
          { name: '8 · ⚖️ Staff decisions are final', value: 'Disagree? Open a ticket in **support**. Do not argue in public channels.' },
        )
        .setFooter({ text: 'Breaking the rules can lead to a timeout, kick or ban. Discord Terms of Service and Community Guidelines apply.' })],
    },
    {
      embeds: [new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📜 LA LEGGE DELL'ARCHMOTHER")
        .setDescription(
          `Benvenuto nella caccia. Rispetta queste regole e ci divertiamo tutti.\n${LINE}`,
        )
        .addFields(
          { name: '1 · 🤝 Rispetto per tutti', value: "Niente insulti, molestie, discorsi d'odio o discriminazioni. Il trash talk in partita resta in partita." },
          { name: '2 · 🚫 Niente tossicità', value: 'Dare la colpa, insultare e abbandonare i compagni non è gradito. Si gioca per migliorare, non per incolpare.' },
          { name: '3 · 🎮 Gioca pulito', value: 'Niente cheat, exploit, boosting, smurf per stompare rank più bassi o vendita di account.' },
          { name: '4 · 📢 Niente spam né pubblicità', value: 'Niente flood, messaggi ripetuti, menzioni di massa, inviti non richiesti o autopromozione senza il permesso dello staff.' },
          { name: '5 · 🗂️ Usa il canale giusto', value: 'Cerchi squadra? Usa **looking-for-group**. Domande? **newcomer-questions**. Ogni argomento al suo posto.' },
          { name: '6 · 🔞 Contenuti puliti', value: 'Niente NSFW, gore o contenuti illegali, da nessuna parte nel server.' },
          { name: '7 · 🔐 Proteggi te stesso', value: 'Non condividere mai password o dati personali. Lo staff non ti chiederà mai le tue credenziali.' },
          { name: '8 · ⚖️ Le decisioni dello staff sono definitive', value: "Non sei d'accordo? Apri un ticket in **support**. Non discutere nei canali pubblici." },
        )
        .setFooter({ text: 'Chi infrange le regole rischia timeout, kick o ban. Valgono i Termini di Servizio e le Linee Guida di Discord. · Premi Verify in #verify per sbloccare il server.' })],
    },
  ],
};

module.exports = { panels, init() {} };
