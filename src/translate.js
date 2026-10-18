// English -> Italian. Uses Claude when ANTHROPIC_API_KEY is set (best for game terms),
// otherwise the free Google endpoint. Returns null on failure so callers can retry later.

const MODEL = process.env.TRANSLATE_MODEL || 'claude-haiku-5-5';

const SYSTEM = 'You translate Deadlock (Valve hero shooter) patch notes and announcements from English to Italian. ' +
  'Keep hero names, ability names, item names and the terms Soul(s), Urn, Mid Boss, Guardian, Walker, Patron in English. ' +
  'Keep numbers, symbols, bullet points and line breaks exactly as they are. Output only the translation.';

async function withClaude(text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: SYSTEM, messages: [{ role: 'user', content: text }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  return (await res.json()).content?.[0]?.text?.trim() ?? null;
}

// The free endpoint takes limited input, so split on line breaks into chunks
function chunks(text, max = 1800) {
  const out = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (cur && cur.length + line.length + 1 > max) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + line.slice(0, max);
  }
  if (cur) out.push(cur);
  return out;
}

async function withGoogle(text) {
  const parts = [];
  for (const chunk of chunks(text)) {
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=it&dt=t', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ q: chunk }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Translate ${res.status}`);
    const data = await res.json();
    parts.push(data[0].map((s) => s[0]).join(''));
  }
  return parts.join('\n');
}

async function toItalian(text) {
  if (!text?.trim()) return text;
  try {
    return process.env.ANTHROPIC_API_KEY ? await withClaude(text) : await withGoogle(text);
  } catch (err) {
    console.error('translate failed:', err.message);
    return null;
  }
}

module.exports = { toItalian };
