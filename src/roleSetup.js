// Helpers for creating and placing template roles. Pure plan functions are tested without Discord.
function roleColors(color) {
  return { colors: { primaryColor: color } };
}

// Template roles the bot can move, packed in template order just under the bot role.
// Roles at or above the bot (or managed / @everyone) are left alone.
function planRolePositions(templateKeys, byKey, botPosition) {
  const movable = templateKeys.filter((key) => {
    const r = byKey[key];
    return r && r.id && !r.managed && r.position < botPosition;
  });
  return movable.map((key, i) => ({
    role: byKey[key].id,
    position: Math.max(1, botPosition - 1 - i),
  }));
}

module.exports = { roleColors, planRolePositions };
