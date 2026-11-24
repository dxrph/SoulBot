// Shared look for every embed: Infinity blue / Hollow purple, one footer.
const { EmbedBuilder } = require('discord.js');

const palette = {
  navy: 0x0B1020,
  primary: 0x4FC3F7, // Infinity blue
  accent: 0x7C4DFF, // Hollow purple
  accentSoft: 0xC77DFF,
  live: 0xE11D2A, // only for "on air"
  ok: 0x2ECC71,
  muted: 0x607D8B,
  warn: 0xF1C40F,
};

const FOOTER = 'ONYZUK4 · Soulside';
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━';

function withFooter(embed, extra) {
  const text = extra ? `${extra} · ${FOOTER}` : FOOTER;
  embed.setFooter({ text });
  return embed;
}

function baseEmbed(color = palette.primary) {
  return withFooter(new EmbedBuilder().setColor(color ?? palette.primary));
}

module.exports = { palette, FOOTER, LINE, withFooter, baseEmbed };
