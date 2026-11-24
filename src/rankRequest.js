const { rankByKey } = require('./ranks');

// A request lives in its queue card: the footer carries who asked and for which rank
const encodeRequest = (userId, rankKey) => `${userId}:${rankKey}`;

function decodeRequest(text) {
  const m = /^(\d+):([a-z]+)/.exec((text ?? '').trim());
  return m ? { userId: m[1], rankKey: m[2] } : null;
}

function checkRequest({ rankKey, contentType, alreadyHasRank, pendingExists }) {
  if (!rankByKey(rankKey)?.verify) return { ok: false, reason: 'Quel rank non serve verifica: sceglilo nel pannello ruoli.' };
  if (!contentType?.startsWith('image/')) return { ok: false, reason: 'Allega uno screenshot (un\'immagine), non un altro tipo di file.' };
  if (alreadyHasRank) return { ok: false, reason: 'Hai già quel rank.' };
  if (pendingExists) return { ok: false, reason: 'Hai già una richiesta in attesa. Aspetta che lo staff la esamini.' };
  return { ok: true };
}

module.exports = { encodeRequest, decodeRequest, checkRequest };
