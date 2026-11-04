// ONYZUK4 community server: the Discord home of twitch.tv/onyzuk4.
// Edit names, colors, channels and social links here only.
//
// role.group  -> 'rank' | 'region' | 'extra': shown in the self-assign menus of the roles channel
// channel.special -> channel used by a bot feature (looked up by exact name, so keep names in sync)
// old -> previous name(s): /add-tools renames an existing role, category or channel instead of making a copy

// The streamer. Leave a link empty ('') to hide it from the social panel.
const streamer = {
  name: 'ONYZUK4',
  twitch: 'onyzuk4', // Twitch login: live alerts and /live use it
  motto: 'Egoista. Manca poco al Radiant: credi in me anche tu.',
  color: 0xe11d2a, // red of the channel banner
  links: {
    twitch: 'https://twitch.tv/onyzuk4',
    tiktok: process.env.TIKTOK_URL ?? '',
    instagram: process.env.INSTAGRAM_URL ?? '',
    youtube: process.env.YOUTUBE_URL ?? '',
    x: process.env.X_URL ?? '',
  },
};

const roles = [
  // Staff
  { key: 'owner', name: '👑 ONYZUK4', color: 0xe11d2a, hoist: true, admin: true, old: ['👑 The Hidden King'] },
  { key: 'admin', name: '🩸 Braccio Destro', color: 0xb71c1c, hoist: true, admin: true, old: ['🔱 Hand of the Patron'] },
  { key: 'mod', name: '🛡️ Guardiani', color: 0xff5252, hoist: true, old: ['⚔️ Wardens'],
    perms: ['KickMembers', 'BanMembers', 'ManageMessages', 'ModerateMembers', 'MoveMembers', 'MuteMembers', 'DeafenMembers'] },
  { key: 'coach', name: '🎓 Maestri', color: 0x9b59b6, hoist: true, old: ['🔮 Sage Mentors'] },
  { key: 'bot', name: '⚙️ Bot', color: 0x95a5a6, old: ['⚙️ Automatons'] },

  // Supporters of the channel (given by hand or by a Twitch-link bot)
  { key: 'vip', name: '💎 VIP della Live', color: 0xff4081, hoist: true },
  { key: 'sub', name: '💜 Sub', color: 0x9146ff, hoist: true },

  // Ranks (highest first)
  { key: 'eternus', name: '🌌 Eternus', color: 0xff4d6d, hoist: true, group: 'rank', verify: true },
  { key: 'ascendant', name: '🪽 Ascendant', color: 0xff8fa3, hoist: true, group: 'rank', verify: true },
  { key: 'phantom', name: '👻 Phantom', color: 0xb388ff, hoist: true, group: 'rank', verify: true },
  { key: 'oracle', name: '👁️ Oracle', color: 0x7c4dff, hoist: true, group: 'rank', verify: true },
  { key: 'archon', name: '⚜️ Archon', color: 0x40c4ff, hoist: true, group: 'rank', verify: true },
  { key: 'emissary', name: '🕯️ Emissary', color: 0x26c6da, hoist: true, group: 'rank', verify: true },
  { key: 'ritualist', name: '🩸 Ritualist', color: 0x4db6ac, hoist: true, group: 'rank' },
  { key: 'arcanist', name: '📖 Arcanist', color: 0x81c784, hoist: true, group: 'rank' },
  { key: 'alchemist', name: '⚗️ Alchemist', color: 0xaed581, hoist: true, group: 'rank' },
  { key: 'seeker', name: '🧭 Seeker', color: 0xffd54f, hoist: true, group: 'rank' },
  { key: 'initiate', name: '🕳️ Initiate', color: 0xbcaaa4, hoist: true, group: 'rank' },

  // Regions
  { key: 'eu', name: '🏰 Old World (EU)', color: 0x3498db, group: 'region' },
  { key: 'na', name: '🗽 New World (NA)', color: 0x2ecc71, group: 'region' },
  { key: 'asia', name: '🏯 Far East (Asia)', color: 0xe91e63, group: 'region' },

  // Base and utility
  { key: 'player', name: '🔥 Egoisti', color: 0xff6b6b, old: ['🔥 Soulbound'] },
  { key: 'live', name: '🔴 Notifiche Live', color: 0xe11d2a, group: 'extra' },
  { key: 'lfg', name: '🐺 Cerco Squadra', color: 0xf39c12, group: 'extra', old: ['🐺 Hunting for Party'] },
  { key: 'muted', name: '🔇 Silenziato', color: 0x607d8b, old: ['🔇 Silenced by the Void'] },
];

// vis: 'public' = everyone, 'member' = Egoisti only, 'staff' = staff only
const categories = [
  {
    name: '🚪 L\'INGRESSO', vis: 'public', old: ['📌 THE GATE'],
    channels: [
      { name: '✅┃verifica', type: 'text', readOnly: true, special: 'verify', old: ['✅┃verify'] },
      { name: '👋┃benvenuti', type: 'text', readOnly: true, special: 'welcome', old: ['🚪┃welcome'] },
      { name: '📜┃regole', type: 'text', readOnly: true, special: 'rules', old: ['📜┃rules'] },
      { name: '📢┃annunci', type: 'text', readOnly: true, old: ['📢┃announcements'] },
      { name: '🎭┃ruoli', type: 'text', readOnly: true, special: 'roles', old: ['🎭┃get-roles'] },
      { name: '🎫┃supporto', type: 'text', readOnly: true, special: 'support', old: ['🎫┃support'] },
    ],
  },
  {
    // Public on purpose: people arriving from Twitch see the stream and the socials before verifying
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
      { name: '🎬┃clip-della-live', type: 'text', old: ['🎬┃clips-and-highlights'] },
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
      // Forums filled by the bot (one post per hero). noPosts: members reply inside posts, only staff/bot create them
      { name: '🦸┃hero-guides', type: 'forum', noPosts: true, special: 'heroes_en' },
      { name: '🛒┃build-guides', type: 'forum', noPosts: true, special: 'builds_en' },
      { name: '🇮🇹┃guida-eroi', type: 'forum', noPosts: true, special: 'heroes_it' },
      { name: '🇮🇹┃guida-build', type: 'forum', noPosts: true, special: 'builds_it' },
      { name: '🧠┃strategie', type: 'text', old: ['🧠┃strategy'] },
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
    // Untouched: same voice rooms as before
    name: '⚔️ THE BATTLEFIELD', vis: 'member',
    channels: [
      { name: '➕ Create Room', type: 'voice', special: 'create' },
      { name: '🟢 Lobby', type: 'voice' },
      // Match rooms: the bot keeps exactly one empty room per group (see features/voice.js)
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
      { name: '🛠️ Staff Voice', type: 'voice' },
    ],
  },
  // Ticket channels are created here by the bot
  { name: '🎫 TICKETS', vis: 'staff', channels: [] },
];

module.exports = { streamer, roles, categories };
