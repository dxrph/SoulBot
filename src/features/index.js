const features = [
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

module.exports = {
  features,
  commands: features.flatMap((f) => f.commands ?? []),
  panels: Object.assign({}, ...features.map((f) => f.panels ?? {})),
  isLegacyTitle: (title) => features.some((f) => f.isLegacyTitle?.(title)),
};
