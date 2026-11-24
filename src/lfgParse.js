const { roles } = require('./template');

const ranks = roles.filter((r) => r.group === 'rank');
const plainName = (r) => r.name.replace(/[^A-Za-z]/g, '').toLowerCase();

function aliases(r) {
  return [r.name, ...(r.old || [])].map((n) => n.replace(/[^A-Za-z]/g, '').toLowerCase()).filter(Boolean);
}

// "ranked oracle need 2" or "cerco 2 ranked, sere EU"
// Old ladder names in `old` (alchemist, arcanist, archon) still parse to the new keys.
function parseRequest(text, memberRankKey, channelKey) {
  const t = text.toLowerCase();
  let mode = channelKey === 'lfg_ranked' ? 'ranked' : 'casual';
  if (/\branked?\b/.test(t)) mode = 'ranked';
  else if (/\b(casual|normals?|fun|normale|normie|unranked)\b/.test(t)) mode = 'casual';

  const rank = ranks.find((r) => aliases(r).some((n) => new RegExp(`\\b${n}\\b`).test(t)))?.key ?? memberRankKey ?? null;

  let size = 6;
  const needEn = t.match(/\bneed(?:s)?\s+(\d)\b/);
  const needIt = t.match(/\b(?:cerco|cerca|mancano?|serve(?:r(?:ebbe)?)?|servono|manca(?:no)?)\s+(\d)\b/);
  if (/\bduo\b/.test(t)) size = 2;
  else if (/\btrio\b/.test(t)) size = 3;
  else if (needEn) size = Math.min(6, Number(needEn[1]) + 1);
  else if (needIt) size = Math.min(6, Number(needIt[1]) + 1);
  return { mode, rank, size: Math.max(2, size), note: text.trim().slice(0, 200) };
}

module.exports = { parseRequest, ranks, plainName, aliases };
