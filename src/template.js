// Deadlock server layout: roles and channels are consistent with each other.
// Edit names, colors and channels here only.
//
// role.group  -> 'rank' | 'region' | 'extra': shown in the self-assign menus of the roles channel
// channel.special -> channel used by a bot feature (looked up by exact name, so keep names in sync)

const roles = [
  // Staff
  { key: 'owner', name: '👑 The Hidden King', color: 0xf1c40f, hoist: true, admin: true },
  { key: 'admin', name: '🔱 Hand of the Patron', color: 0xe74c3c, hoist: true, admin: true },
  { key: 'mod', name: '⚔️ Wardens', color: 0xe67e22, hoist: true,
    perms: ['KickMembers', 'BanMembers', 'ManageMessages', 'ModerateMembers', 'MoveMembers', 'MuteMembers', 'DeafenMembers'] },
  { key: 'coach', name: '🔮 Sage Mentors', color: 0x9b59b6, hoist: true },
  { key: 'bot', name: '⚙️ Automatons', color: 0x95a5a6 },

  // Ranks (highest first)
  { key: 'eternus', name: '🌌 Eternus', color: 0xff4d6d, hoist: true, group: 'rank' },
  { key: 'ascendant', name: '🪽 Ascendant', color: 0xff8fa3, hoist: true, group: 'rank' },
  { key: 'phantom', name: '👻 Phantom', color: 0xb388ff, hoist: true, group: 'rank' },
  { key: 'oracle', name: '👁️ Oracle', color: 0x7c4dff, hoist: true, group: 'rank' },
  { key: 'archon', name: '⚜️ Archon', color: 0x40c4ff, hoist: true, group: 'rank' },
  { key: 'emissary', name: '🕯️ Emissary', color: 0x26c6da, hoist: true, group: 'rank' },
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
  { key: 'player', name: '🔥 Soulbound', color: 0x1abc9c },
  { key: 'lfg', name: '🐺 Hunting for Party', color: 0xf39c12, group: 'extra' },
  { key: 'muted', name: '🔇 Silenced by the Void', color: 0x607d8b },
];

// vis: 'public' = everyone, 'member' = Soulbound only, 'staff' = staff only
const categories = [
  {
    name: '📌 THE GATE', vis: 'public',
    channels: [
      { name: '✅┃verify', type: 'text', readOnly: true, special: 'verify' },
      { name: '🚪┃welcome', type: 'text', readOnly: true, special: 'welcome' },
      { name: '📜┃rules', type: 'text', readOnly: true },
      { name: '📢┃announcements', type: 'text', readOnly: true },
      { name: '🎭┃get-roles', type: 'text', readOnly: true, special: 'roles' },
      { name: '🎫┃support', type: 'text', readOnly: true, special: 'support' },
      { name: '👋┃introductions', type: 'text' },
    ],
  },
  {
    name: '💬 THE TAVERN', vis: 'member',
    channels: [
      { name: '💬┃general', type: 'text' },
      { name: '😂┃memes', type: 'text' },
      { name: '🎬┃clips-and-highlights', type: 'text' },
      { name: '🤖┃bot-commands', type: 'text' },
      { name: '🗣️ Lounge', type: 'voice' },
      { name: '🎵 Music', type: 'voice' },
    ],
  },
  {
    name: '🔥 THE ARCHIVES', vis: 'member',
    channels: [
      { name: '📰┃patch-notes', type: 'text', readOnly: true, special: 'patches' },
      { name: '🦸┃heroes', type: 'text' },
      { name: '🛒┃builds-and-items', type: 'text' },
      { name: '🧠┃strategy', type: 'text' },
      { name: '🗺️┃map-and-objectives', type: 'text' },
      { name: '❓┃newcomer-questions', type: 'text' },
    ],
  },
  {
    name: '🐺 THE HUNT', vis: 'member',
    channels: [
      { name: '🔎┃looking-for-group', type: 'text' },
      { name: '🏆┃ranked-lfg', type: 'text', special: 'lfg_ranked' },
      { name: '🎲┃casual-lfg', type: 'text', special: 'lfg_casual' },
    ],
  },
  {
    name: '⚔️ THE BATTLEFIELD', vis: 'member',
    channels: [
      { name: '➕ Create Room', type: 'voice', special: 'create' },
      { name: '🟢 Lobby', type: 'voice' },
      { name: '🏆 Ranked I (6)', type: 'voice', limit: 6 },
      { name: '🏆 Ranked II (6)', type: 'voice', limit: 6 },
      { name: '🎲 Casual I (6)', type: 'voice', limit: 6 },
      { name: '🎲 Casual II (6)', type: 'voice', limit: 6 },
      { name: '👥 Duo (2)', type: 'voice', limit: 2 },
      { name: '👥 Trio (3)', type: 'voice', limit: 3 },
      { name: '🌙 AFK', type: 'voice' },
    ],
  },
  {
    name: '🔮 THE SANCTUM', vis: 'member', coach: true,
    channels: [
      { name: '🔮┃coaching-requests', type: 'text' },
      { name: '📹┃replay-review', type: 'text' },
      { name: '🔮 Sanctum I', type: 'voice' },
      { name: '🔮 Sanctum II', type: 'voice' },
    ],
  },
  {
    name: '🛠️ THE WAR ROOM', vis: 'staff',
    channels: [
      { name: '📡┃say', type: 'text', special: 'say' },
      { name: '📋┃mod-log', type: 'text', special: 'modlog' },
      { name: '🛠️┃staff-chat', type: 'text' },
      { name: '🛠️ Staff Voice', type: 'voice' },
    ],
  },
  // Ticket channels are created here by the bot
  { name: '🎫 TICKETS', vis: 'staff', channels: [] },
];

module.exports = { roles, categories };
