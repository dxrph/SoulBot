// Each feature may export: init(client) for its own events, and the hooks called by the single
// dispatcher in index.js: onInteraction(i), onMessage(m), onReady(client).
const NAMES = [
  'live', 'verify', 'roles', 'rankrequest', 'rules', 'voice', 'say', 'modlog', 'security', 'tickets',
  'gameinvite', 'lfg', 'patches', 'guides', 'clips', 'anime', 'sondaggio', 'stats',
  'levels', 'events', 'soundboard',
  'predictions', 'liveroom', 'build', 'challenge', 'quiz', 'reminders',
];
// eslint-disable-next-line global-require, import/no-dynamic-require
const features = NAMES.map((name) => Object.assign(require(`./${name}`), { name }));

const OLD_TITLES = [
  '🔥 Become Soulbound',
  '📜 THE LAW OF THE HIDDEN KING',
  "📜 LA LEGGE DELL'ARCHMOTHER",
  '🎭 CHOOSE YOUR PATH',
  '🎫 Need help?',
  '🔎 FIND YOUR PARTY',
  '🎟️ GET INTO THE GAME',
  '🔥 ENTRA NELLA COMMUNITY DI ONYZUK4',
  '📜 LE REGOLE DI ONYZUK4',
];

module.exports = {
  features,
  commands: features.flatMap((f) => f.commands ?? []),
  panels: Object.assign({}, ...features.map((f) => f.panels ?? {})),
  isLegacyTitle: (title) => OLD_TITLES.includes(title) || features.some((f) => f.isLegacyTitle?.(title)),
};
