# Ruoli facili da usare, rank verificati e permesso Stream

Data: 2026-10-19 · Repo: `dxrph/SoulBot` · Stato: bozza da approvare

## Perché

Oggi i ruoli si prendono da una serie di menu a tendina in `#get-roles` (rank, regione, ping, un menu per classe di eroi). Ha due problemi, detti dal proprietario:

1. **Il modo di ottenere i rank non va bene.** Chiunque può dichiararsi Eternus senza esserlo.
2. **L'interfaccia per chiedere i ruoli non piace.** Il canale è un muro di menu uno sotto l'altro.

In più, nessuno riesce a condividere lo schermo nei canali vocali. Causa verificata nel codice: `src/setup.js` (riga ~133) imposta i permessi di `@everyone` senza `Stream` (in Discord si chiama "Video"). `Stream` non compare in nessun altro file del repo.

## Obiettivi

- Prendere un ruolo deve essere facile: un nuovo membro finisce in meno di un minuto, senza istruzioni.
- I rank bassi si prendono subito. I rank alti vengono verificati da admin o mod.
- Regione, eroi principali e ping restano liberi, con un tocco.
- Tutti possono condividere lo schermo e la camera nei canali vocali.

## Non obiettivi

- Nessun collegamento a Steam e nessuna lettura di dati di gioco. Tutto avviene dentro Discord.
- Nessuna migrazione: nessun membro ha oggi un rank, quindi non si tolgono né si riconfermano ruoli esistenti.
- Nessun cambio ai ruoli dello staff, ai rank come elenco (restano gli 11 di `src/template.js`) né alle card LFG, che continuano a leggere il rank dal ruolo.

## Anti-obiettivi (sarebbe un fallimento anche se "funziona")

- Un pannello che richiede di capire come funziona prima di usarlo.
- Una verifica che fa aspettare lo staff su più canali o che richiede più di due click per approvare.
- Rank alti assegnati senza nessun controllo.

## Cosa è stato deciso

1. **Pannello unico** in `#get-roles` con quattro pulsanti grandi: Rank, Regione, Eroi, Ping. Al posto del muro di menu di oggi.
2. **Finestra privata per pulsante.** Premendo si apre un messaggio visibile solo a chi ha premuto, con le scelte e i ruoli già posseduti.
3. **Rank liberi:** Initiate, Seeker, Alchemist, Arcanist, Ritualist. Assegnati subito alla scelta. Il taglio è un valore unico facile da cambiare (scelta del proprietario: "medio basso"; il rank esatto del taglio è una mia scelta).
4. **Rank verificati:** Emissary, Archon, Oracle, Phantom, Ascendant, Eternus. Il giocatore sceglie il rank e allega uno screenshot del profilo Deadlock.
5. **Coda staff:** un solo canale riservato dove arriva una scheda per richiesta, con pulsanti Approva e Rifiuta. Approvando, il ruolo viene assegnato e il giocatore riceve un avviso. Possono approvare admin e mod (chi ha il permesso di gestire i messaggi, come `isStaff` in `src/util.js`).
6. **Comando `/profilo`:** apre lo stesso pannello privato da qualsiasi canale, mostrando rank, regione, eroi e ping attuali.
7. **Permesso Stream:** aggiungere `Stream` ai permessi di `@everyone` in `src/setup.js`, così i server costruiti da zero partono corretti. Il server esistente non viene ricostruito, quindi serve anche un'azione una tantum che aggiunge il permesso all'`@everyone` esistente.

## Vincoli

- Il bot non salva dati su disco: lo stato deve stare nei messaggi e nei ruoli, come già fa `src/features/lfg.js`.
- Un membro ha al massimo un rank alla volta.
- Se il canale della coda staff non esiste, `/add-tools` deve crearlo, come per gli altri canali speciali.
- Gli eroi principali restano limitati come oggi (fino a 5 per classe).

## Lasciato a chi costruisce

- Come tenere traccia di una richiesta rank in attesa senza salvare dati (probabilmente nella scheda stessa, come fa LFG).
- Cosa succede se un giocatore ha già un rank verificato e ne chiede un altro: sostituzione dopo approvazione, mantenendo il vecchio nel frattempo.
- Testi, emoji e colori dei pannelli (in linea con quelli esistenti).
- Dove applicare l'azione una tantum per il permesso Stream sul server esistente (avvio, `/add-tools` o comando dedicato). Mia proposta: `/add-tools`, perché serve già a mettere a posto un server esistente.
- Cosa succede se un utente invia la richiesta senza screenshot (rifiutarla con un messaggio chiaro).
