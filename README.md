# 🔥 SoulBot · ONYZUK4

Il bot del server Discord di **[ONYZUK4](https://twitch.tv/onyzuk4)**: il posto dove la community si ritrova per guardare le live, trovare ONYZUK4 su tutti i social e giocare insieme.

> *Egoista. Manca poco al Radiant: credi in me anche tu.*

## 🔴 Live e social
- **Notifiche live** in `🔴┃live-ora`: appena ONYZUK4 va in live su Twitch il bot pubblica titolo, gioco e anteprima, tagga chi ha **🔴 Notifiche Live** e segna il post come finito quando la live si chiude (controllo ogni 2 minuti, nessuna chiave Twitch richiesta)
- `/live`: ONYZUK4 è in live adesso?
- `/social`: tutti i link di ONYZUK4
- Pannelli `🔗┃social` e `📅┃programma`
- La sezione **🔴 ONYZUK4 LIVE** è pubblica: chi arriva da Twitch la vede subito, anche prima di entrare

## 💬 Community
- Pulsante **Entra** in `✅┃verifica`: dà il ruolo **🔥 Egoisti** e pubblica un benvenuto con il numero del membro e i link a ruoli, social e Twitch
- Regole a tema stream (in italiano, con versione corta in inglese)
- Canali per chiacchierare, condividere le clip della live e proporre idee per le prossime live
- Stanza vocale **📺 Guardiamo la Live** per vedere lo stream insieme
- Ruoli supporter: **💎 VIP della Live** e **💜 Sub**
- Pannello `🎭┃ruoli` con quattro pulsanti (Rank, Region, Heroes, Pings) e `/profilo` per cambiare il profilo da qualsiasi canale

## 🎮 Giocare con ONYZUK4
- **⚔️ THE BATTLEFIELD**: stanze vocali Ranked, Casual, Duo e Trio che restano sempre con esattamente una stanza vuota per tipo, più `➕ Create Room` per crearsi una stanza propria
- **Cerco squadra**: scrivi per esempio `ranked archon need 2` e il bot crea la card del gruppo, oppure usa `/lfg`
- Rank verificati: da Emissary in su serve `/verifica-rank` con uno screenshot, e lo staff approva da `📥┃rank-queue`
- Inviti al gioco (`🎟️┃invito-al-gioco`), patch notes ufficiali in inglese e tradotte in italiano, forum con le guide degli eroi e delle build (`/sync-guides`)
- **🎓 Scuola dell'Ego**: richieste di coaching e analisi dei replay

## 🛡️ Moderazione
- Ticket privati con lo staff da `🎫┃supporto`
- Mod log: entrate, uscite, kick, ban, messaggi eliminati e modificati
- Anti-spam (timeout automatico) e anti-raid (blocco se entrano troppe persone insieme)
- `📡┃say`: lo staff scrive `#canale messaggio` e il bot lo pubblica lì

## ⚙️ Comandi per il proprietario
- `/setup-server`: cancella tutto e ricostruisce il server da zero (chiede conferma)
- `/add-tools`: aggiorna il server allo schema nuovo, rinomina i ruoli e i canali vecchi (i membri tengono i loro ruoli), crea quello che manca e non cancella niente
- `/refresh-panels`: ripubblica tutti i pannelli con la grafica aggiornata

## 🚀 Configurazione Discord
1. Developer Portal → New Application → **Bot** → Reset Token.
2. Nella scheda Bot attiva **Server Members Intent** e **Message Content Intent**.
3. OAuth2 → URL Generator: scope `bot` + `applications.commands`, permesso **Administrator**. Invita il bot.
4. Impostazioni server → Ruoli: trascina il ruolo del bot **in cima**.

## 💻 Avvio in locale
```
npm install
cp .env.example .env   # poi metti il token in .env
npm start
```

## ☁️ Deploy su Railway
1. Carica questa repo su GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Variables → aggiungi `DISCORD_TOKEN`.
4. Railway esegue `npm start` da solo. Il bot non salva dati in locale, quindi non serve un volume.

Spegni il bot in locale mentre gira su Railway, altrimenti ogni risposta arriva doppia.

## 🔧 Variabili facoltative
- `TIKTOK_URL`, `INSTAGRAM_URL`, `YOUTUBE_URL`, `X_URL`: altri link nel pannello social (se sono vuoti non compaiono). Twitch c'è sempre.
- `ANTHROPIC_API_KEY`: traduzione delle patch notes più precisa (i termini del gioco restano in inglese). Senza, si usa il traduttore gratuito di Google.
- `TRANSLATE_MODEL`: modello Claude per la traduzione (predefinito `claude-haiku-5-5`).

## 📌 Note
- I forum delle guide funzionano solo se nel server è attiva la **Community** (Impostazioni server → Abilita Community). Attivala, poi usa `/add-tools` e `/sync-guides`.
- Server creato con lo schema vecchio? Usa `/add-tools` e poi `/refresh-panels`. I canali tolti dallo schema (per esempio `map-and-objectives`) non vengono cancellati: eliminali a mano se non ti servono.
- Nomi, colori, canali e link di ONYZUK4 sono tutti in `src/template.js`.
