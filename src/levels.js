// Pure level maths (MEE6-style curve), kept apart so it can be unit tested.
const xpForNext = (level) => 5 * level * level + 50 * level + 100;

function levelOf(totalXp) {
  let level = 0;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpForNext(level)) {
    rest -= xpForNext(level);
    level += 1;
  }
  return { level, into: rest, need: xpForNext(level) };
}

function bar(into, need, size = 12) {
  const full = Math.round((into / need) * size);
  return '▰'.repeat(full) + '▱'.repeat(size - full);
}

// Highest reward role definition reached at `level` (defs: [{ key, level }])
const rewardFor = (defs, level) => defs.filter((d) => d.level <= level).sort((a, b) => b.level - a.level)[0] ?? null;

module.exports = { xpForNext, levelOf, bar, rewardFor };
