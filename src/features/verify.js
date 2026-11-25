const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { roleMap, channelByKey, isStaff, logEvent } = require('../util');
const { streamer, settings } = require('../template');
const { palette, LINE, withFooter, baseEmbed } = require('../style');

const CFG = settings.verify;
const WELCOME = settings.welcome;
// No 0/O, 1/I/L: easy to read, easy to type
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const panels = {
  verify: () => ({
    embeds: [withFooter(new EmbedBuilder()
      .setTitle(`Entra nella community di ${streamer.name}`)
      .setDescription(
        `Premi il pulsante qui sotto per diventare un **Egoista** e sbloccare tutto il server: chat, stanze vocali, clip e partite con me.\n` +
        `${LINE}\n*Press the button to unlock the server.*`,
      )
      .setColor(palette.primary))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify').setLabel('Entra').setEmoji('🔥').setStyle(ButtonStyle.Success),
    )],
  }),
};

// ---- captcha (in memory: a restart only means pressing "Entra" again) -------------------------
const captchas = new Map(); // `${guildId}:${userId}` -> { code, tries, expires }
const pendingAge = new Set(); // `${guildId}:${userId}` already waiting for staff approval

function newCode(len = CFG.captchaLength) {
  let code = '';
  for (let n = 0; n < len; n += 1) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

function sweep() {
  const now = Date.now();
  for (const [k, c] of captchas) if (c.expires < now) captchas.delete(k);
}

const ageDays = (user) => (Date.now() - user.createdTimestamp) / 86_400_000;

async function askCaptcha(i) {
  const role = roleMap(i.guild).player;
  if (!role) return i.reply({ content: 'Ruolo non trovato. Chiedi allo staff.', flags: MessageFlags.Ephemeral });
  if (i.member.roles.cache.has(role.id)) return i.reply({ content: 'Sei già dei nostri.', flags: MessageFlags.Ephemeral });
  if (pendingAge.has(`${i.guildId}:${i.user.id}`)) {
    return i.reply({ content: 'La tua richiesta è già nelle mani dello staff. Pazienza, anche Gojo è stato sigillato per un po\'.', flags: MessageFlags.Ephemeral });
  }
  sweep();
  const code = newCode();
  captchas.set(`${i.guildId}:${i.user.id}`, { code, tries: CFG.captchaTries, expires: Date.now() + CFG.captchaMinutes * 60_000 });
  return i.reply({
    content:
      `Prima una prova che non sei una maledizione automatica 🤖\n` +
      `Il tuo codice: **\`${code.split('').join(' ')}\`**\n` +
      `Premi **Inserisci codice** e scrivilo senza spazi. Hai ${CFG.captchaTries} tentativi e ${CFG.captchaMinutes} minuti.`,
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify:code').setLabel('Inserisci codice').setEmoji('⌨️').setStyle(ButtonStyle.Primary),
    )],
    flags: MessageFlags.Ephemeral,
  });
}

async function openModal(i) {
  const c = captchas.get(`${i.guildId}:${i.user.id}`);
  if (!c || c.expires < Date.now()) {
    return i.reply({ content: 'Codice scaduto. Torna su **Entra** e prendine uno nuovo.', flags: MessageFlags.Ephemeral });
  }
  return i.showModal(new ModalBuilder()
    .setCustomId('verify:modal')
    .setTitle('Verifica')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('code').setLabel('Scrivi il codice').setStyle(TextInputStyle.Short)
        .setMinLength(CFG.captchaLength).setMaxLength(CFG.captchaLength + 8).setRequired(true),
    )));
}

async function checkCode(i) {
  const key = `${i.guildId}:${i.user.id}`;
  const c = captchas.get(key);
  if (!c || c.expires < Date.now()) {
    captchas.delete(key);
    return i.reply({ content: 'Codice scaduto. Torna su **Entra** e prendine uno nuovo.', flags: MessageFlags.Ephemeral });
  }
  const typed = i.fields.getTextInputValue('code').toUpperCase().replace(/\s+/g, '');
  if (typed !== c.code) {
    c.tries -= 1;
    if (c.tries <= 0) {
      captchas.delete(key);
      return i.reply({ content: 'Tentativi finiti. Torna su **Entra** per un codice nuovo.', flags: MessageFlags.Ephemeral });
    }
    return i.reply({ content: `Codice sbagliato. Ti restano ${c.tries} tentativi: premi di nuovo **Inserisci codice**.`, flags: MessageFlags.Ephemeral });
  }
  captchas.delete(key);
  return admit(i);
}

// Code is right: give Egoisti, or park young accounts for a staff approval
async function admit(i) {
  const role = roleMap(i.guild).player;
  if (!role) return i.reply({ content: 'Ruolo non trovato. Chiedi allo staff.', flags: MessageFlags.Ephemeral });
  if (i.member.roles.cache.has(role.id)) return i.reply({ content: 'Sei già dei nostri.', flags: MessageFlags.Ephemeral });

  const days = ageDays(i.user);
  if (CFG.minAccountAgeDays > 0 && days < CFG.minAccountAgeDays) {
    pendingAge.add(`${i.guildId}:${i.user.id}`);
    await logEvent(i.guild, {
      title: '🕒 Account giovane in attesa',
      color: palette.warn,
      description: `<@${i.user.id}> (${i.user.tag}) ha superato il captcha, ma l'account ha **${days.toFixed(1)} giorni** ` +
        `(soglia ${CFG.minAccountAgeDays}). Non ha ricevuto ${role.name}: approva tu se ti fidi.`,
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`verify:approve:${i.user.id}`).setLabel('Approva').setEmoji('✅').setStyle(ButtonStyle.Success),
      )],
    });
    return i.reply({
      content: 'Codice giusto! Il tuo account però è appena nato, quindi uno dello staff ti approva a mano. Ci vuole poco.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await i.member.roles.add(role, 'Verified (captcha)');
  await i.reply({ content: 'Benvenuto tra gli Egoisti! Ora vedi tutto il server.', flags: MessageFlags.Ephemeral });
  await sendWelcome(i.guild, i.member);
}

async function approve(i) {
  if (!isStaff(i.member)) return i.reply({ content: 'Solo lo staff può approvare.', flags: MessageFlags.Ephemeral });
  const userId = i.customId.split(':')[2];
  const role = roleMap(i.guild).player;
  const member = await i.guild.members.fetch(userId).catch(() => null);
  pendingAge.delete(`${i.guildId}:${userId}`);
  if (!member) return i.update({ content: `Utente <@${userId}> non più nel server.`, components: [] });
  if (!role) return i.reply({ content: 'Ruolo Egoisti non trovato.', flags: MessageFlags.Ephemeral });
  if (!member.roles.cache.has(role.id)) await member.roles.add(role, `Approvato da ${i.user.tag}`);
  await i.update({ content: `✅ Approvato da <@${i.user.id}>.`, components: [] });
  await sendWelcome(i.guild, member);
}

const channelUrl = (guild, ch) => `https://discord.com/channels/${guild.id}/${ch.id}`;

async function sendWelcome(guild, member) {
  const welcome = channelByKey(guild, 'welcome');
  const rulesCh = channelByKey(guild, 'rules');
  const rolesCh = channelByKey(guild, 'roles');
  const socials = channelByKey(guild, 'socials');
  if (!welcome) return;
  const embed = withFooter(baseEmbed(palette.primary)
    .setTitle('Un nuovo Egoista è arrivato')
    .setDescription(
      `Benvenuto <@${member.id}>! Sei il membro numero **${guild.memberCount}**.\n` +
      `${rolesCh ? `Scegli rank e notifiche live in ${rolesCh}\n` : ''}` +
      `${socials ? `Seguimi ovunque da ${socials}\n` : ''}` +
      `Ci vediamo in live: ${streamer.links.twitch}`,
    )
    .setThumbnail(member.user.displayAvatarURL()));
  if (WELCOME.bannerUrl) embed.setImage(WELCOME.bannerUrl);
  const buttons = [
    rulesCh && new ButtonBuilder().setLabel('Regole').setEmoji('📜').setStyle(ButtonStyle.Link).setURL(channelUrl(guild, rulesCh)),
    rolesCh && new ButtonBuilder().setLabel('Ruoli').setEmoji('🎭').setStyle(ButtonStyle.Link).setURL(channelUrl(guild, rolesCh)),
    new ButtonBuilder().setLabel('Twitch').setEmoji('🔴').setStyle(ButtonStyle.Link).setURL(streamer.links.twitch),
  ].filter(Boolean);
  await welcome.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] }).catch(() => {});
}

// ---- goodbye ----------------------------------------------------------------------------------
const GOODBYES = [
  '**{name}** ha lasciato il Dominio. L\'Espansione si è chiusa senza di lui.',
  '**{name}** è uscito dall\'Infinito. Gojo non l\'ha nemmeno toccato.',
  '**{name}** è stato esorcizzato. Nessuna maledizione residua rilevata.',
  '**{name}** ha preso la Hollow Purple in pieno. Di lui resta solo il nickname.',
  '**{name}** se n\'è andato. Sukuna dice che era debole comunque.',
  '**{name}** ha mollato prima dell\'Eternus. Chi crede in sé resta, gli altri vanno.',
];

async function goodbye(member) {
  if (!WELCOME.goodbye || member.user?.bot) return;
  const player = roleMap(member.guild).player;
  // only for people who actually got in: no spam from bots that never passed the captcha
  if (!player || !member.roles?.cache?.has(player.id)) return;
  const ch = channelByKey(member.guild, 'welcome');
  if (!ch) return;
  const name = member.displayName ?? member.user?.username ?? 'Qualcuno';
  const line = GOODBYES[Math.floor(Math.random() * GOODBYES.length)].replace('{name}', name);
  await ch.send({
    embeds: [withFooter(baseEmbed(palette.muted).setDescription(`${line}\nOra siamo in **${member.guild.memberCount}**.`))],
    allowedMentions: { parse: [] },
  }).catch(() => {});
}

function init(client) {
  client.on('guildMemberRemove', (m) => goodbye(m).catch(console.error));
}

async function onInteraction(i) {
  try {
    if (i.isButton() && i.customId === 'verify') return await askCaptcha(i);
    if (i.isButton() && i.customId === 'verify:code') return await openModal(i);
    if (i.isModalSubmit() && i.customId === 'verify:modal') return await checkCode(i);
    if (i.isButton() && i.customId.startsWith('verify:approve:')) return await approve(i);
  } catch (err) {
    console.error(err);
    if (!i.replied && !i.deferred) await i.reply({ content: 'Qualcosa è andato storto, riprova.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

module.exports = {
  init, onInteraction, panels, newCode, GOODBYES,
};
