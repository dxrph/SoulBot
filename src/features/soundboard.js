// /carica-suoni (owner only): uploads sounds to the server soundboard, from an attachment or from sounds/.
const fs = require('node:fs');
const path = require('node:path');
const { MessageFlags, PermissionFlagsBits: V } = require('discord.js');
const { guildSlash } = require('../slash');

const DIR = path.join(__dirname, '..', '..', 'sounds');
const MAX_BYTES = 512 * 1024;
const SLOTS = [8, 24, 36, 48]; // by boost tier 0..3
const TYPES = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const commands = [
  guildSlash('carica-suoni', 'Carica suoni nella soundboard: un allegato, oppure tutti quelli della cartella sounds/')
    .setDefaultMemberPermissions(V.Administrator)
    .addAttachmentOption((o) => o.setName('file').setDescription('Un file .mp3 o .ogg (max 512 KB)'))
    .addStringOption((o) => o.setName('nome').setDescription('Nome del suono (2-32 caratteri)').setMinLength(2).setMaxLength(32))
    .addStringOption((o) => o.setName('emoji').setDescription('Emoji unicode da mostrare accanto al suono (es. 😂)').setMaxLength(8)),
].map((c) => c.toJSON());

const cleanName = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);

function folderSounds() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter((f) => TYPES[path.extname(f).toLowerCase()])
    .map((f) => ({ file: path.join(DIR, f), name: cleanName(path.basename(f, path.extname(f))), type: TYPES[path.extname(f).toLowerCase()] }));
}

async function run(i) {
  if (i.user.id !== i.guild.ownerId) return i.reply({ content: 'Solo il proprietario del server può usare questo comando.', flags: MessageFlags.Ephemeral });
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const existing = await i.guild.soundboardSounds.fetch().catch(() => null);
  if (!existing) return i.editReply('Non riesco a leggere la soundboard: al bot serve il permesso **Crea espressioni / Gestisci espressioni**.');
  const taken = new Set([...existing.values()].map((s) => s.name.toLowerCase()));
  let free = (SLOTS[i.guild.premiumTier] ?? 8) - existing.size;

  const att = i.options.getAttachment('file');
  let todo;
  if (att) {
    const ext = path.extname(att.name).toLowerCase();
    if (!TYPES[ext]) return i.editReply('Serve un file .mp3 o .ogg.');
    if (att.size > MAX_BYTES) return i.editReply('Il file supera 512 KB: taglialo a pochi secondi.');
    const res = await fetch(att.url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) return i.editReply('Non riesco a scaricare l\'allegato.');
    todo = [{ buffer: Buffer.from(await res.arrayBuffer()), name: cleanName(i.options.getString('nome') ?? path.basename(att.name, ext)), type: TYPES[ext] }];
  } else {
    todo = folderSounds();
    if (!todo.length) return i.editReply('La cartella `sounds/` del bot è vuota. Aggiungi i file e fai il push, oppure allega un file.');
  }

  const done = []; const skipped = [];
  for (const s of todo) {
    if (s.name.length < 2) { skipped.push(`${s.name || '?'} (nome troppo corto)`); continue; }
    if (taken.has(s.name.toLowerCase())) { skipped.push(`${s.name} (c'è già)`); continue; }
    if (free <= 0) { skipped.push(`${s.name} (slot finiti)`); continue; }
    const buffer = s.buffer ?? fs.readFileSync(s.file);
    if (buffer.length > MAX_BYTES) { skipped.push(`${s.name} (oltre 512 KB)`); continue; }
    try {
      await i.guild.soundboardSounds.create({
        file: buffer, name: s.name, contentType: s.type,
        ...(att && i.options.getString('emoji') ? { emojiName: i.options.getString('emoji') } : {}),
        reason: `Caricato da ${i.user.tag}`,
      });
      done.push(s.name); taken.add(s.name.toLowerCase()); free -= 1;
    } catch (err) {
      skipped.push(`${s.name} (${err.message})`);
    }
  }
  return i.editReply(`🔊 Caricati: ${done.length ? done.join(', ') : 'nessuno'}${skipped.length ? `\nSaltati: ${skipped.join(', ')}`.slice(0, 1800) : ''}\nSlot liberi: ${Math.max(0, free)}`);
}

async function onInteraction(i) {
  if (!i.isChatInputCommand() || i.commandName !== 'carica-suoni') return;
  try {
    return await run(i);
  } catch (err) {
    console.error(err);
    return i.editReply(`Non riuscito: ${err.message}`).catch(() => {});
  }
}

module.exports = { onInteraction, commands, cleanName };
