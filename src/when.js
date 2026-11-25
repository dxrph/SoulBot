// Parses Italian-style dates typed in a slash command, in the server's time zone (Europe/Brussels).
// Accepts: "21:30" (today, or tomorrow if already past), "domani 21:30", "27/11 21:30", "27/11/2026 21:30".
const TZ = 'Europe/Brussels';

// Offset in minutes of `tz` at the given UTC instant (e.g. +60 in winter for Brussels)
function tzOffset(utcMs, tz = TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60_000);
}

// Wall-clock time in `tz` -> Date
function zoned(y, mo, d, h, mi, tz = TZ) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - tzOffset(guess, tz) * 60_000;
  return new Date(guess - tzOffset(first, tz) * 60_000);
}

function todayIn(now, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day };
}

function parseWhen(text, now = new Date()) {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^(alle|ore) /, '');
  let m = t.match(/^(?:(oggi|domani) )?(?:alle |ore )?(\d{1,2})[:.](\d{2})$/);
  if (m) {
    const { y, mo, d } = todayIn(now);
    let date = zoned(y, mo, d, +m[2], +m[3]);
    if (m[1] === 'domani') date = zoned(y, mo, d + 1, +m[2], +m[3]);
    else if (!m[1] && date <= now) date = zoned(y, mo, d + 1, +m[2], +m[3]);
    return valid(m[2], m[3]) ? date : null;
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))? (?:alle |ore )?(\d{1,2})[:.](\d{2})$/);
  if (m) {
    if (!valid(m[4], m[5]) || +m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : todayIn(now).y;
    let date = zoned(year, +m[2], +m[1], +m[4], +m[5]);
    if (!m[3] && date <= now) date = zoned(year + 1, +m[2], +m[1], +m[4], +m[5]);
    return date;
  }
  return null;
}

const valid = (h, mi) => +h >= 0 && +h <= 23 && +mi >= 0 && +mi <= 59;

module.exports = { parseWhen, zoned, tzOffset };
