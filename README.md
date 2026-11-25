# 🔥 SoulBot · ONYZUK4

Il bot del server Discord di **[ONYZUK4](https://twitch.tv/onyzuk4)**: il posto dove la community si ritrova per guardare le live, trovare ONYZUK4 su tutti i social e giocare insieme.

> *Egoista. Manca poco all'Eternus: credi in me anche tu.* (motto proposto, in attesa di conferma)

## 🔴 Live e social
- **Notifiche live** in `🔴┃live-ora`: appena ONYZUK4 va in live su Twitch il bot pubblica titolo, gioco e anteprima, tagga chi ha **🔴 Notifiche Live** e segna il post come finito quando la live si chiude (controllo ogni 2 minuti, nessuna chiave Twitch richiesta)
- `/live`: ONYZUK4 è in live adesso?
- `/social`: tutti i link di ONYZUK4 (Twitch, Kick, YouTube, Instagram, X)
- `/sondaggio`: lo staff crea un sondaggio per la live
- `/anime` e `/anime-off`: pannello “Anime della settimana” in `📅┃programma`
- `/pulisci-eroi`: lo staff toglie i ruoli eroe non più usati dal gioco
- Pannelli `🔗┃social` e `📅┃programma`
- La sezione **🔴 ONYZUK4 LIVE** è pubblica: chi arriva da Twitch la vede subito, anche prima di entrare

## 💬 Community
- Pulsante **Entra** in `✅┃verifica`: prima un **captcha** (codice di 5 caratteri in un messaggio privato, 3 tentativi, 5 minuti), poi il ruolo **Egoisti** e un benvenuto in `👋┃benvenuti` con il numero del membro e i pulsanti 📜 Regole, 🎭 Ruoli e 🔴 Twitch (più un banner, se impostato in `settings.welcome.bannerUrl`)
- **Account giovani** (meno di 3 giorni, `settings.verify.minAccountAgeDays`): niente ruolo automatico, lo staff riceve un avviso in `📋┃mod-log` con il pulsante **Approva**
- Messaggio ironico in `👋┃benvenuti` quando un Egoista esce ("ha lasciato il Dominio")
- **Livelli**: XP scrivendo (una volta al minuto) e stando in vocale con altre persone. `/rank` e `/classifica`. Gradi premio: **Genin** (5), **Chunin** (10), **Jonin** (20), **ANBU** (30), **Kage** (50). Lo stato è salvato in un file fissato in `💾┃dati-bot` (niente database). Si spegne con `settings.levels.enabled = false`
- `/giveaway` (staff): pulsante Partecipa ed estrazione automatica. Un riavvio del bot annulla i giveaway in corso
- `/evento-live` (staff): crea un evento Discord per la prossima live, col link Twitch (es. `domani 21:30`, ora di Bruxelles)
- **📊 STATISTICHE**: canali bloccati con 👥 Membri, 💜 Follower Twitch e 🎯 Affiliate (N/50), aggiornati ogni 10 minuti
- `/predizione` (staff): "Vinco o perdo?" con i pulsanti Vince/Perde, chiusura dei voti (automatica dopo 5 minuti o a mano) e verdetto dello staff. Chi indovina prende XP. Un riavvio del bot annulla la predizione aperta
- **Dominio Espanso**: ruolo temporaneo per chi è in `📺 Guardiamo la Live` mentre ONYZUK4 è in live; sparisce quando esci o quando la live finisce
- `/build <eroe>`: la build più votata dal forum `🛒┃build-guides` (o `🇮🇹┃guida-build` con `lingua: italiano`), con anteprima e link al post
- **Clip della settimana**: ogni lunedì alle 10 la clip con più 🔥 va in `📢┃annunci` con un embed curato (mai doppia, nemmeno dopo un deploy)
- **Sfida del giorno** in `🎯┃sfida-del-giorno` (alle 12, elenco in `src/data/challenges.js`): screenshot nel thread, XP solo dopo il "Confermo" dello staff
- **Quiz anime** in `💬┃generale` ogni 2-5 ore, solo se la chat è attiva e non di notte (domande in `src/data/quiz.js`): il primo che risponde giusto prende XP
- **Promemoria DM**: chi ha il ruolo **Scouter** riceve un messaggio privato 10 minuti prima di un evento Discord programmato (chi ha i DM chiusi viene saltato)
- Regole a tema stream (in italiano, con versione corta in inglese)
- Canali per chiacchierare, condividere le clip della live e proporre idee per le prossime live
- Stanza vocale **📺 Guardiamo la Live** per vedere lo stream insieme
- Ruoli supporter: **💎 VIP della Live** e **💜 Sub**
- Pannello `🎭┃ruoli` con quattro pulsanti (Rank, Region, Heroes, Pings) e `/profilo` per cambiare il profilo da qualsiasi canale

## 🎮 Giocare con ONYZUK4
- **⚔️ THE BATTLEFIELD**: stanze vocali Ranked, Casual, Duo e Trio che restano sempre con esattamente una stanza vuota per tipo, più `➕ Create Room` per crearsi una stanza propria, con un **pannello di controllo** nella chat della stanza (rinomina, blocca/sblocca, limite, passa la stanza; massimo 2 cambi di nome ogni 10 minuti)
- **Cerco squadra**: scrivi per esempio `ranked oracle need 2` e il bot crea la card del gruppo, oppure usa `/lfg`
- Rank verificati: da Emissary in su serve `/verifica-rank` con uno screenshot, e lo staff approva da `📥┃rank-queue`
- Inviti al gioco (`🎟️┃invito-al-gioco`), patch notes ufficiali in inglese e tradotte in italiano, forum con le guide degli eroi e delle build (`/sync-guides`)
- **🎓 Scuola dell'Ego**: richieste di coaching e analisi dei replay

## 🛡️ Moderazione
- **Ticket** da `🎫┃supporto`: menu con Supporto, Segnalazione e Verifica rank, domande in un modulo, pulsante **Prendi in carico** per lo staff, trascrizione `.txt` in `📋┃mod-log` alla chiusura, un solo ticket aperto per persona
- Mod log: entrate, uscite, kick, ban, timeout, cambi di ruolo (non quelli che ognuno si sceglie da solo). Messaggi eliminati e modificati in `🗑️┃log-messaggi`, ingressi e uscite dalla vocale in `🔊┃log-vocale` (se i canali non ci sono, va tutto nel mod log)
- Anti-spam (timeout automatico) e anti-raid (blocco se entrano troppe persone insieme)
- `📡┃say`: lo staff scrive `#canale messaggio` e il bot lo pubblica lì

## ⚙️ Comandi per il proprietario
- `/setup-server`: cancella tutto e ricostruisce il server da zero (chiede conferma)
- `/add-tools`: aggiorna il server allo schema nuovo, rinomina i ruoli e i canali vecchi (i membri tengono i loro ruoli), crea quello che manca e non cancella niente
- `/refresh-panels`: ripubblica tutti i pannelli con la grafica aggiornata
- `/carica-suoni`: carica suoni nella soundboard, da un allegato o da tutti i file della cartella `sounds/`

`/add-tools` toglie anche il permesso "Menziona @everyone" al ruolo everyone (solo quello, il resto non cambia).

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
DRY_RUN=1 npm start   # controllo a secco: carica i moduli e i comandi senza login e senza token
```

## ☁️ Deploy su Railway
1. Carica questa repo su GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Variables → aggiungi `DISCORD_TOKEN`.
4. Railway esegue `npm start` da solo. Il bot non salva dati in locale, quindi non serve un volume (i livelli stanno in un messaggio di `💾┃dati-bot`).

Spegni il bot in locale mentre gira su Railway, altrimenti ogni risposta arriva doppia.

## 🔧 Variabili facoltative
- `KICK_URL`, `TIKTOK_URL`, `INSTAGRAM_URL`, `YOUTUBE_URL`, `X_URL`: link nel pannello social. Se sono vuoti, Kick, YouTube, Instagram e X usano i link di default di ONYZUK4; TikTok compare solo se lo imposti. Twitch c'è sempre.
- `ANTHROPIC_API_KEY`: traduzione delle patch notes più precisa (i termini del gioco restano in inglese). Senza, si usa il traduttore gratuito di Google.
- `TRANSLATE_MODEL`: modello Claude per la traduzione (predefinito `claude-haiku-5-5`).
- `DRY_RUN=1`: solo in locale, avvio a secco senza login.

Ogni funzione nuova ha il suo interruttore in `settings` (`predictions`, `liveRole`, `build`, `clipHighlight`, `challenge`, `quiz`, `reminders`, `levels`, `stats`): basta mettere `enabled: false`.

Nessuna variabile nuova è obbligatoria: soglia età account, banner del benvenuto, statistiche e livelli si regolano in `settings` dentro `src/template.js`. I follower Twitch arrivano da decapi.me, lo stesso servizio gratuito degli alert live, quindi non serve una chiave Twitch.

## 📌 Note
- I forum delle guide funzionano solo se nel server è attiva la **Community** (Impostazioni server → Abilita Community). Attivala, poi usa `/add-tools` e `/sync-guides`.
- Server creato con lo schema vecchio? Usa `/add-tools` e poi `/refresh-panels`. I canali tolti dallo schema (per esempio `map-and-objectives`) non vengono cancellati: eliminali a mano se non ti servono.
- Nomi, colori, canali e link di ONYZUK4 sono tutti in `src/template.js`.
- Al bot servono anche i permessi **Gestisci eventi** (`/evento-live`) e **Crea/Gestisci espressioni** (`/carica-suoni`): con Administrator li ha già.
