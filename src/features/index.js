const features = [
  require('./verify'),
  require('./roles'),
  require('./voice'),
  require('./say'),
  require('./modlog'),
  require('./security'),
  require('./tickets'),
  require('./lfg'),
  require('./patches'),
];

module.exports = {
  features,
  commands: features.flatMap((f) => f.commands ?? []),
  panels: Object.assign({}, ...features.map((f) => f.panels ?? {})),
};
