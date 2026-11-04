const { rankByKey } = require('./ranks');

// A request lives in its queue card: the footer carries who asked and for which rank
const encodeRequest = (userId, rankKey) => `${userId}:${rankKey}`;

function decodeRequest(text) {
  const m = /^(\d+):([a-z]+)$/.exec(text ?? '');
  return m ? { userId: m[1], rankKey: m[2] } : null;
}

function checkRequest({ rankKey, contentType, alreadyHasRank, pendingExists }) {
  if (!rankByKey(rankKey)?.verify) return { ok: false, reason: 'That rank does not need verification: pick it in the roles panel.' };
  if (!contentType?.startsWith('image/')) return { ok: false, reason: 'Attach a screenshot (an image), not another file type.' };
  if (alreadyHasRank) return { ok: false, reason: 'You already have that rank.' };
  if (pendingExists) return { ok: false, reason: 'You already have a pending request. Wait for staff to review it.' };
  return { ok: true };
}

module.exports = { encodeRequest, decodeRequest, checkRequest };
