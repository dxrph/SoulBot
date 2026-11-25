// Decide how /refresh-panels should update existing bot messages: edit in place, never delete.
function planPanelRefresh(existing, payloads, isLegacyTitle, titleOfPayload) {
  const titles = new Set(payloads.map(titleOfPayload));
  const matches = existing
    .filter((m) => titles.has(m.title) || isLegacyTitle(m.title))
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const edits = [];
  const sends = [];
  const leftovers = [];
  for (let i = 0; i < payloads.length; i += 1) {
    if (matches[i]) edits.push({ id: matches[i].id, payloadIndex: i });
    else sends.push(i);
  }
  for (let i = payloads.length; i < matches.length; i += 1) leftovers.push(matches[i].id);
  return { edits, sends, leftovers };
}

module.exports = { planPanelRefresh };
