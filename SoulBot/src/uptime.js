// DecAPI uptime text -> seconds live, or null when offline / unreadable.
// Live looks like "1 hour, 4 minutes, 12 seconds"; offline like "onyzuk4 is offline".
const UNITS = { day: 86400, hour: 3600, minute: 60, second: 1 };

function parseUptime(text) {
  if (!text || /offline|error|not found/i.test(text)) return null;
  let total = 0;
  let found = false;
  for (const [, n, unit] of text.matchAll(/(\d+)\s*(day|hour|minute|second)s?/gi)) {
    total += Number(n) * UNITS[unit.toLowerCase()];
    found = true;
  }
  return found ? total : null;
}

module.exports = { parseUptime };
