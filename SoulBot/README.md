# SoulBot · ONYZUK4

Discord bot for the community of [twitch.tv/onyzuk4](https://twitch.tv/onyzuk4): live alerts, socials, chat, and the Deadlock rooms to play together.

## Features
- **Live alerts** in `🔴┃live-ora`: when onyzuk4 goes live the bot posts title, game and preview, pings `🔴 Notifiche Live`, and marks the post as finished when the stream ends (checked every 2 min, no Twitch keys needed)
- `/live` (is the stream on right now?) and `/social` (all links), plus `🔗┃social` and `📅┃programma` panels
- The live corner is public, so people coming from Twitch see it before verifying
- `/setup-server` wipes the server and rebuilds roles + channels (owner only, with confirmation)
- `/add-tools` updates an existing server to the latest layout: renames old roles/channels (members keep their roles), creates what is missing, deletes nothing
- Game invite requests (`🎟️┃game-invite`): players without access request an invite with their Steam profile, a verified member claims it and sends it through Steam
- Verify button gives **🔥 Egoisti**, then posts a welcome message with links to roles, socials and Twitch
- `get-roles` panel with four buttons (Rank, Region, Heroes, Pings), each opening a private menu; `/profilo` shows and changes your profile from anywhere (heroes: up to 5 "mains" per class)
- Ranks: Initiate to Ritualist are picked freely; Emissary and above need `/verifica-rank` with a screenshot, and admins/mods approve it from `📥┃rank-queue`
- Everyone can share their screen and camera in voice channels (`/add-tools` enables it on existing servers)
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
- `TIKTOK_URL`, `INSTAGRAM_URL`, `YOUTUBE_URL`, `X_URL`: extra links in the social panel (empty = hidden). Twitch is always there.
- `ANTHROPIC_API_KEY`: better Italian translation of patch notes (game terms kept in English). Without it the free Google endpoint is used.
- `TRANSLATE_MODEL`: Claude model for translation (default `claude-haiku-5-5`).

## Forums need Community
The hero/build forums only exist on servers with **Community** enabled (Server Settings → Enable Community). Enable it, then run `/add-tools` and `/sync-guides`.

## Customize
Names, colors, channels and the streamer's links are all in `src/template.js`.

## Updating a server built with the old layout
Run `/add-tools`, then `/refresh-panels`. Channels removed from the template (e.g. `map-and-objectives`) are not deleted: remove them by hand if you don't want them.
