// Sliding-window counter: at most `limit` hits per key every `windowMs`.
// Used for channel renames, which Discord limits to about 2 every 10 minutes per channel.
function rateGuard(limit, windowMs) {
  const hits = new Map();
  const live = (key, now) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.set(key, list);
    return list;
  };
  return {
    // ms to wait before the next hit is allowed (0 = go now)
    wait(key, now = Date.now()) {
      const list = live(key, now);
      return list.length < limit ? 0 : windowMs - (now - list[0]);
    },
    hit(key, now = Date.now()) { live(key, now).push(now); },
    forget(key) { hits.delete(key); },
  };
}

module.exports = { rateGuard };
