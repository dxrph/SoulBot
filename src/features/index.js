const features = [
  require('./live'),
  require('./verify'),
  require('./roles'),
  require('./rankrequest'),
  require('./rules'),
  require('./voice'),
  require('./say'),
  require('./modlog'),
  require('./security'),
  require('./tickets'),
  require('./gameinvite'),
  require('./lfg'),
  require('./patches'),
  require('./guides'),
  require('./clips'),
  require('./anime'),
  require('./sondaggio'),
];

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
