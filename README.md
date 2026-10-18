# Deadlock Bot

Discord bot that builds and runs a Deadlock community server.

## Features
- `/setup-deadlock` wipes the server and rebuilds roles + channels (owner only, with confirmation)
- `/add-tools` adds missing bot channels/panels without deleting anything
- Verify button gives **Soulbound**, then posts a welcome message
- Self-assign menus for rank, region and "Hunting for Party"
- Join-to-create voice rooms (`➕ Create Room`)
- `📡┃say` relay: write `#channel message` and the bot posts it there
- Mod log: joins, leaves, kicks, bans, deleted/edited messages
- Anti-spam (auto timeout) and anti-raid (lockdown kicks on mass joins)
- Ticket button that opens a private channel with staff
- `/lfg` party cards with Join/Leave/Close buttons
- Patch notes: official Valve posts from the Steam news API, every 15 min

## Discord setup
1. Developer Portal → New Application → **Bot** → Reset Token.
2. Bot tab → enable **Server Members Intent** and **Message Content Intent**.
3. OAuth2 → URL Generator: scopes `bot` + `applications.commands`, permission **Administrator**. Invite the bot.
4. Server settings → Roles: drag the bot's role to the **top**.

## Run locally
```
npm install
cp .env.example .env   # then put your token in .env
npm start
```

## Deploy on Railway
1. Push this repo to GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Variables → add `DISCORD_TOKEN`.
4. Railway runs `npm start` by itself. The bot keeps no local state, so no volume is needed.
Stop the local bot while Railway is running, or you get double replies.

## Customize
Names, colors and channels are all in `src/template.js`.
