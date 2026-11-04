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
];

// Panel titles of the old Deadlock-only design: /refresh-panels deletes them so nothing is doubled
const OLD_TITLES = ['🔥 Become Soulbound', '📜 THE LAW OF THE HIDDEN KING', "📜 LA LEGGE DELL'ARCHMOTHER"];

module.exports = {
  features,
  commands: features.flatMap((f) => f.commands ?? []),
  panels: Object.assign({}, ...features.map((f) => f.panels ?? {})),
  isLegacyTitle: (title) => OLD_TITLES.includes(title) || features.some((f) => f.isLegacyTitle?.(title)),
};
