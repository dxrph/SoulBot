# Deadlock Bot

Discord bot that builds and runs a Deadlock community server.

## Features
- `/setup-deadlock` wipes the server and rebuilds roles + channels (owner only, with confirmation)
- `/add-tools` adds missing bot channels/panels without deleting anything
- Game invite requests (`🎟️┃game-invite`): players without access request an invite with their Steam profile, a verified member claims it and sends it through Steam
- Verify button gives **Soulbound**, then posts a welcome message
- Pretty `get-roles` panel: menus for rank, region, party pings and one role per hero ("mains", up to 5 per class)
- Styled rules panel (English + short Italian version)
- Join-to-create voice rooms (`➕ Create Room`)
- `📡┃say` relay: write `#channel message` and the bot posts it there
- Mod log: joins, leaves, kicks, bans, deleted/edited messages
- Anti-spam (auto timeout) and anti-raid (lockdown kicks on mass joins)
- Ticket button that opens a private channel with staff
- Looking for group: guided UI (button + menus + note) or just write `ranked archon need 2` and the bot posts a party card; `/lfg` also works
- Self-balancing match rooms: Ranked, Casual, Duo and Trio always keep exactly one empty room (new ones appear, extra empty ones disappear)
- `/refresh-panels` reposts all panels after a design change
- Patch notes: official Valve posts from the Steam news API, every 15 min, with images
- Italian patch notes (`📰┃patch-notes-ita`): same posts, auto-translated
- Forums are configured by the bot: recommended permissions, guidelines, class tags with emoji, default reaction, sort order and a pinned read-me post
- Hero and build forums in English and Italian (`/sync-guides`, refreshed every 12 h): one post per hero, data from the public Deadlock API in the game's own localization

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

## Optional variables
- `ANTHROPIC_API_KEY`: better Italian translation of patch notes (game terms kept in English). Without it the free Google endpoint is used.
- `TRANSLATE_MODEL`: Claude model for translation (default `claude-haiku-5-5`).

## Forums need Community
The hero/build forums only exist on servers with **Community** enabled (Server Settings → Enable Community). Enable it, then run `/add-tools` and `/sync-guides`.

## Customize
Names, colors and channels are all in `src/template.js`.
