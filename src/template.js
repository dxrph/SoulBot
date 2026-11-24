// ONYZUK4 community server: the Discord home of twitch.tv/onyzuk4.
// Edit names, colors, channels and social links here only.
//
// role.group  -> 'rank' | 'region' | 'extra': shown in the self-assign menus of the roles channel
// channel.special -> channel used by a bot feature (looked up by exact name, so keep names in sync)
// old -> previous name(s): /add-tools renames an existing role, category or channel instead of making a copy

// The streamer. Leave a link empty ('') to hide it from the social panel.
const streamer = {
  name: 'ONYZUK4',
  twitch: 'onyzuk4',
  kick: 'onyzuk4',
  motto: 'Egoista. Manca poco al Radiant: credi in me anche tu.',
  color: 0x4FC3F7, // Infinity blue — live alerts use the live red instead
  links: {
    twitch: 'https://twitch.tv/onyzuk4',
    kick: process.env.KICK_URL || 'https://kick.com/onyzuk4',
    youtube: process.env.YOUTUBE_URL || 'https://youtube.com/@Onyzuk4',
    instagram: process.env.INSTAGRAM_URL || 'https://instagram.com/onyzuka.wrld',
    x: process.env.X_URL || 'https://x.com/onyzuk4',
    tiktok: process.env.TIKTOK_URL || '',
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

  // Ranks (highest first) — official Deadlock names, emoji prefix removed
  { key: 'eternus', name: 'Eternus', color: 0xC77DFF, hoist: true, group: 'rank', verify: true, old: ['🌌 Eternus'] },
  { key: 'ascendant', name: 'Ascendant', color: 0xB388FF, hoist: true, group: 'rank', verify: true, old: ['🪽 Ascendant'] },
  { key: 'phantom', name: 'Phantom', color: 0x7C4DFF, hoist: true, group: 'rank', verify: true, old: ['👻 Phantom'] },
  { key: 'oracle', name: 'Oracle', color: 0x4FC3F7, hoist: true, group: 'rank', verify: true, old: ['👁️ Oracle'] },
  { key: 'archon', name: 'Archon', color: 0x40C4FF, hoist: true, group: 'rank', verify: true, old: ['⚜️ Archon'] },
  { key: 'emissary', name: 'Emissary', color: 0x26C6DA, hoist: true, group: 'rank', verify: true, old: ['🕯️ Emissary'] },
  { key: 'ritualist', name: 'Ritualist', color: 0x4DB6AC, hoist: true, group: 'rank', old: ['🩸 Ritualist'] },
  { key: 'arcanist', name: 'Arcanist', color: 0x81C784, hoist: true, group: 'rank', old: ['📖 Arcanist'] },
  { key: 'alchemist', name: 'Alchemist', color: 0xAED581, hoist: true, group: 'rank', old: ['⚗️ Alchemist'] },
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
];

// vis: 'public' = everyone, 'member' = Egoisti only, 'staff' = staff only
// Channel and voice names are left unchanged on purpose.
const categories = [
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
      { name: '🛠️ Staff Voice', type: 'voice' },
    ],
  },
  { name: '🎫 TICKETS', vis: 'staff', channels: [] },
];

module.exports = { streamer, roles, categories };
