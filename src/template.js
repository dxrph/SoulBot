// ONYZUK4 community server: the Discord home of twitch.tv/onyzuk4.
// Edit names, colors, channels and social links here only.
//
// role.group  -> 'rank' | 'extra' | 'interest': shown in the self-assign menus of the roles channel
// 'region' is kept on the existing EU/NA/Asia roles but is no longer offered in the panel
// channel.special -> channel used by a bot feature (looked up by exact name, so keep names in sync)
// old -> previous name(s): /add-tools renames an existing role, category or channel instead of making a copy

// The streamer. Leave a link empty ('') to hide it from the social panel.
const streamer = {
  name: 'ONYZUK4',
  twitch: 'onyzuk4',
  kick: 'onyzuk4',
  motto: 'Egoista. Manca poco all\'Eternus: credi in me anche tu.',
  color: 0x4FC3F7, // Infinity blue — live alerts use the live red instead
  links: {
    twitch: 'https://twitch.tv/onyzuk4',
    kick: process.env.KICK_URL || 'https://kick.com/onyzuk4',
    youtube: process.env.YOUTUBE_URL || 'https://youtube.com/@Onyzuk4',
    instagram: process.env.INSTAGRAM_URL || 'https://instagram.com/onyzuka.wrld',
    x: process.env.X_URL || 'https://x.com/onyzuk4',
    tiktok: process.env.TIKTOK_URL || 'https://www.tiktok.com/@itsonyzuka',
  },
};

const roles = [
  // Staff
  { key: 'owner', name: 'Hokage · ONYZUK4', color: 0x4FC3F7, hoist: true, admin: true,
    old: ['👑 ONYZUK4', '👑 The Hidden King'] },
  { key: 'admin', name: 'Hashira', color: 0x7C4DFF, hoist: true, admin: true,
    old: ['🩸 Braccio Destro', '🔱 Hand of the Patron'] },
  { key: 'mod', name: 'Shinigami', color: 0xC77DFF, hoist: true,
    old: ['🛡️ Guardiani', '⚔️ Wardens'],
    perms: ['KickMembers', 'BanMembers', 'ManageMessages', 'ModerateMembers', 'MoveMembers', 'MuteMembers', 'DeafenMembers'] },
  { key: 'coach', name: 'Sensei', color: 0x7C4DFF, hoist: true,
    old: ['🎓 Maestri', '🔮 Sage Mentors'] },
  { key: 'bot', name: 'Shikigami', color: 0x607D8B,
    old: ['⚙️ Bot', '⚙️ Automatons'] },

  // Supporters of the channel (given by hand or by a Twitch-link bot)
  { key: 'vip', name: 'Ace', color: 0xC77DFF, hoist: true, old: ['💎 VIP della Live'] },
  { key: 'sub', name: 'Nakama', color: 0x7C4DFF, hoist: true, old: ['💜 Sub'] },

  // Ranks (highest first) — official Deadlock ladder (Beta Season 2, July 2026)
  { key: 'eternus', name: 'Eternus', color: 0xC77DFF, hoist: true, group: 'rank', verify: true, old: ['🌌 Eternus'] },
  { key: 'ascendant', name: 'Ascendant', color: 0xB388FF, hoist: true, group: 'rank', verify: true, old: ['🪽 Ascendant'] },
  { key: 'phantom', name: 'Phantom', color: 0x7C4DFF, hoist: true, group: 'rank', verify: true, old: ['👻 Phantom'] },
  { key: 'oracle', name: 'Oracle', color: 0x4FC3F7, hoist: true, group: 'rank', verify: true, old: ['👁️ Oracle'] },
  { key: 'emissary', name: 'Emissary', color: 0x26C6DA, hoist: true, group: 'rank', verify: true, old: ['🕯️ Emissary'] },
  { key: 'ritualist', name: 'Ritualist', color: 0x4DB6AC, hoist: true, group: 'rank', old: ['🩸 Ritualist'] },
  { key: 'mystic', name: 'Mystic', color: 0x90A4AE, hoist: true, group: 'rank',
    old: ['Archon', '⚜️ Archon'] },
  { key: 'sentinel', name: 'Sentinel', color: 0x81C784, hoist: true, group: 'rank',
    old: ['Arcanist', '📖 Arcanist'] },
  { key: 'acolyte', name: 'Acolyte', color: 0xAED581, hoist: true, group: 'rank',
    old: ['Alchemist', '⚗️ Alchemist'] },
  { key: 'seeker', name: 'Seeker', color: 0xFFD54F, hoist: true, group: 'rank', old: ['🧭 Seeker'] },
  { key: 'initiate', name: 'Initiate', color: 0xBCAAA4, hoist: true, group: 'rank', old: ['🕳️ Initiate'] },

  // Regions
  { key: 'eu', name: 'EU · West Blue', color: 0x4FC3F7, group: 'region', old: ['🏰 Old World (EU)'] },
  { key: 'na', name: 'NA · East Blue', color: 0x2ECC71, group: 'region', old: ['🗽 New World (NA)'] },
  { key: 'asia', name: 'Asia · Grand Line', color: 0xC77DFF, group: 'region', old: ['🏯 Far East (Asia)'] },

  // Base and utility
  { key: 'player', name: 'Egoisti', color: 0x4FC3F7, old: ['🔥 Egoisti', '🔥 Soulbound'] },
  { key: 'live', name: 'Scouter', color: 0xE11D2A, group: 'extra', old: ['🔴 Notifiche Live'] },
  { key: 'lfg', name: 'Hunters', color: 0x7C4DFF, group: 'extra', old: ['🐺 Cerco Squadra', '🐺 Hunting for Party'] },
  { key: 'muted', name: 'Sigillato', color: 0x607D8B, old: ['🔇 Silenziato', '🔇 Silenced by the Void'] },

  // NEW: level rewards (XP from chat and voice). level = minimum level; the bot keeps only the highest one.
  { key: 'lvl_genin', name: 'Genin', color: 0x90A4AE, level: 5 },
  { key: 'lvl_chunin', name: 'Chunin', color: 0x4DB6AC, level: 10 },
  { key: 'lvl_jonin', name: 'Jonin', color: 0x4FC3F7, level: 20 },
  { key: 'lvl_anbu', name: 'ANBU', color: 0x7C4DFF, level: 30 },
  { key: 'lvl_kage', name: 'Kage', color: 0xC77DFF, level: 50 },

  // NEW: temporary role for whoever is in 📺 Guardiamo la Live while ONYZUK4 is live (removed at the end)
  { key: 'domain', name: 'Dominio Espanso', color: 0x7C4DFF },

  // Anime interests (self-assign in the roles panel). Created by /add-tools; nothing is deleted.
  { key: 'anime_jjk', name: 'Jujutsu Kaisen', color: 0x7C4DFF, group: 'interest' },
  { key: 'anime_naruto', name: 'Naruto', color: 0xFFD54F, group: 'interest' },
  { key: 'anime_onepiece', name: 'One Piece', color: 0xE11D2A, group: 'interest' },
  { key: 'anime_bleach', name: 'Bleach', color: 0xE67E22, group: 'interest' },
  { key: 'anime_hxh', name: 'Hunter x Hunter', color: 0x2ECC71, group: 'interest' },
  { key: 'anime_csm', name: 'Chainsaw Man', color: 0xC77DFF, group: 'interest' },
  { key: 'anime_aot', name: 'Attack on Titan', color: 0xBCAAA4, group: 'interest' },
  { key: 'anime_db', name: 'Dragon Ball', color: 0xF1C40F, group: 'interest' },
  { key: 'anime_opm', name: 'One Punch Man', color: 0x90A4AE, group: 'interest' },
  { key: 'anime_dn', name: 'Death Note', color: 0x607D8B, group: 'interest' },
];

// vis: 'public' = everyone, 'member' = Egoisti only, 'staff' = staff only
// Channel and voice names are left unchanged on purpose.
const categories = [
  {
    // NEW: live counters. Locked voice channels (nobody can join), renamed by the bot every 10 minutes.
    // stat -> matched by name prefix, because the bot appends ": N" to the name.
    name: '📊 STATISTICHE', vis: 'public',
    channels: [
      { name: '👥 Membri', type: 'voice', locked: true, stat: 'members' },
      { name: '💜 Follower', type: 'voice', locked: true, stat: 'followers' },
      { name: '🎯 Affiliate', type: 'voice', locked: true, stat: 'affiliate' },
    ],
  },
  {
    name: '🚪 L\'INGRESSO', vis: 'public', old: ['📌 THE GATE'],
    channels: [
      { name: '✅┃verifica', type: 'text', readOnly: true, special: 'verify', old: ['✅┃verify'] },
      { name: '👋┃benvenuti', type: 'text', readOnly: true, special: 'welcome', old: ['🚪┃welcome'] },
      { name: '📜┃regole', type: 'text', readOnly: true, special: 'rules', old: ['📜┃rules'] },
      { name: '📢┃annunci', type: 'text', readOnly: true, special: 'announcements', old: ['📢┃announcements'] },
      { name: '🎭┃ruoli', type: 'text', readOnly: true, special: 'roles', old: ['🎭┃get-roles'] },
      { name: '🎫┃supporto', type: 'text', readOnly: true, special: 'support', old: ['🎫┃support'] },
    ],
  },
  {
    name: '🔴 ONYZUK4 LIVE', vis: 'public',
    channels: [
      { name: '🔴┃live-ora', type: 'text', readOnly: true, special: 'live' },
      { name: '🔗┃social', type: 'text', readOnly: true, special: 'socials' },
      { name: '📅┃programma', type: 'text', readOnly: true, special: 'schedule' },
    ],
  },
  {
    name: '💬 LA CHAT', vis: 'member', old: ['💬 THE TAVERN'],
    channels: [
      { name: '💬┃generale', type: 'text', old: ['💬┃general'] },
      { name: '🙋┃presentati', type: 'text', old: ['👋┃introductions'] },
      { name: '🎬┃clip-della-live', type: 'text', special: 'clips', old: ['🎬┃clips-and-highlights'] },
      { name: '💡┃idee-per-le-live', type: 'text' },
      { name: '😂┃meme', type: 'text', old: ['😂┃memes'] },
      { name: '🤖┃comandi-bot', type: 'text', old: ['🤖┃bot-commands'] },
      { name: '📺 Guardiamo la Live', type: 'voice' },
      { name: '🗣️ Chiacchiere', type: 'voice', old: ['🗣️ Lounge'] },
      { name: '🎵 Musica', type: 'voice', old: ['🎵 Music'] },
    ],
  },
  {
    name: '🎮 DEADLOCK', vis: 'member', old: ['🔥 THE ARCHIVES'],
    channels: [
      { name: '📰┃patch-notes', type: 'text', readOnly: true, special: 'patches' },
      { name: '📰┃patch-notes-ita', type: 'text', readOnly: true, special: 'patches_it' },
      { name: '🎟️┃invito-al-gioco', type: 'text', readOnly: true, special: 'gameinvite', old: ['🎟️┃game-invite'] },
      { name: '🦸┃hero-guides', type: 'forum', noPosts: true, special: 'heroes_en' },
      { name: '🛒┃build-guides', type: 'forum', noPosts: true, special: 'builds_en' },
      { name: '🇮🇹┃guida-eroi', type: 'forum', noPosts: true, special: 'heroes_it' },
      { name: '🇮🇹┃guida-build', type: 'forum', noPosts: true, special: 'builds_it' },
      { name: '🧠┃strategie', type: 'text', old: ['🧠┃strategy'] },
      // NEW: daily Deadlock challenge. Read-only: people answer with a screenshot in the day's thread.
      { name: '🎯┃sfida-del-giorno', type: 'text', readOnly: true, special: 'challenge' },
      { name: '❓┃domande-nuovi', type: 'text', old: ['❓┃newcomer-questions'] },
    ],
  },
  {
    name: '🐺 CERCO SQUADRA', vis: 'member', old: ['🐺 THE HUNT'],
    channels: [
      { name: '🔎┃cerco-squadra', type: 'text', special: 'lfg', old: ['🔎┃looking-for-group'] },
      { name: '🏆┃ranked-lfg', type: 'text', special: 'lfg_ranked' },
      { name: '🎲┃casual-lfg', type: 'text', special: 'lfg_casual' },
    ],
  },
  {
    name: '⚔️ THE BATTLEFIELD', vis: 'member',
    channels: [
      { name: '➕ Create Room', type: 'voice', special: 'create' },
      { name: '🟢 Lobby', type: 'voice' },
      { name: '🏆 Ranked 1 (6)', type: 'voice', limit: 6 },
      { name: '🏆 Ranked 2 (6)', type: 'voice', limit: 6 },
      { name: '🎲 Casual 1 (6)', type: 'voice', limit: 6 },
      { name: '🎲 Casual 2 (6)', type: 'voice', limit: 6 },
      { name: '👥 Duo 1 (2)', type: 'voice', limit: 2 },
      { name: '👥 Trio 1 (3)', type: 'voice', limit: 3 },
      { name: '🌙 AFK', type: 'voice' },
    ],
  },
  {
    name: '🎓 SCUOLA DELL\'EGO', vis: 'member', coach: true, old: ['🔮 THE SANCTUM'],
    channels: [
      { name: '🎓┃richieste-coaching', type: 'text', old: ['🔮┃coaching-requests'] },
      { name: '📹┃analisi-replay', type: 'text', old: ['📹┃replay-review'] },
      { name: '🎓 Aula 1', type: 'voice', old: ['🔮 Sanctum I'] },
      { name: '🎓 Aula 2', type: 'voice', old: ['🔮 Sanctum II'] },
    ],
  },
  {
    name: '🛠️ STAFF', vis: 'staff', old: ['🛠️ THE WAR ROOM'],
    channels: [
      { name: '📡┃say', type: 'text', special: 'say' },
      { name: '📥┃rank-queue', type: 'text', special: 'rankqueue' },
      { name: '📋┃mod-log', type: 'text', special: 'modlog' },
      { name: '🛠️┃staff-chat', type: 'text' },
      // NEW: detailed logs, so the mod log stays readable (if missing, everything goes to the mod log)
      { name: '🗑️┃log-messaggi', type: 'text', special: 'log_messages' },
      { name: '🔊┃log-vocale', type: 'text', special: 'log_voice' },
      // NEW: the bot saves its state here (levels as a pinned JSON file). Do not delete its messages.
      { name: '💾┃dati-bot', type: 'text', special: 'botdata' },
      { name: '🛠️ Staff Voice', type: 'voice' },
    ],
  },
  { name: '🎫 TICKETS', vis: 'staff', channels: [] },
];

// Bot behaviour knobs (no Railway variable needed: change them here and push)
const settings = {
  verify: {
    captchaLength: 5, // characters of the code shown before the "Entra" modal
    captchaTries: 3,
    captchaMinutes: 5, // the code expires after this many minutes
    minAccountAgeDays: 3, // younger accounts wait for a staff "Approva" in the mod log (0 = off)
  },
  welcome: {
    // Image under the welcome message (Gojo style banner, 960x540 works well). Empty = no image.
    bannerUrl: '',
    goodbye: true, // ironic message in benvenuti when an Egoista leaves
  },
  stats: {
    enabled: true,
    intervalMinutes: 10, // Discord allows ~2 renames per channel every 10 minutes: never go lower
    affiliateGoal: 50, // Twitch Affiliate needs 50 followers
    // Followers come from decapi.me (the same free service the live alerts use), no Twitch key needed
    followers: true,
  },
  levels: {
    // XP is saved as a JSON file pinned in 💾┃dati-bot (no database, no Railway volume needed).
    // Set to false to switch the whole feature off (commands stay, they just say it's off).
    enabled: true,
    messageXp: [15, 25], // random XP per message...
    messageCooldownSec: 60, // ...at most once a minute per person
    voiceXpPerMinute: 6, // in voice with at least one other person, not muted/deafened, not in AFK
    saveEveryMinutes: 5,
  },
  predictions: {
    enabled: true, // /predizione (staff): "vinco o perdo?" with buttons
    xp: 40, // XP to everyone who guessed right
    voteMinutes: 5, // votes close by themselves after this (staff can close earlier)
  },
  liveRole: {
    enabled: true, // role 'Dominio Espanso' in 📺 Guardiamo la Live while live
    channelName: '📺 Guardiamo la Live',
  },
  build: {
    enabled: true, // /build <eroe>: top build from the build forums
  },
  clipHighlight: {
    enabled: true, // Monday 10:00: most 🔥 clip of the week in 📢┃annunci
  },
  challenge: {
    enabled: true, // daily Deadlock goal in 🎯┃sfida-del-giorno (list in src/data/challenges.js)
    hour: 12, // Brussels time
    xp: 60, // given only when staff presses "Confermo" on the screenshot
  },
  quiz: {
    enabled: true, // anime question in chat now and then (list in src/data/quiz.js)
    channelName: '💬┃generale',
    minGapMinutes: 120, // at least this much between two quizzes
    maxGapMinutes: 300, // ...and at most this (random in between)
    minRecentMessages: 5, // only if the chat is alive: messages in the last 15 minutes
    answerSeconds: 90,
    xp: 30,
    quietHours: [1, 11], // no quiz from 01:00 to 10:59 (Brussels)
  },
  reminders: {
    enabled: true, // DM to Scouter members before a Discord scheduled event
    minutesBefore: 10,
    maxDms: 300, // safety cap per event
    delayMs: 1200, // pause between two DMs (rate limit)
  },
};

module.exports = { streamer, roles, categories, settings };
