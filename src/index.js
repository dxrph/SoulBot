require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
} = require('discord.js');
const setup = require('./setup');
const { features, commands: featureCommands } = require('./features');
const { remember } = require('./util');

const { DISCORD_TOKEN } = process.env;
// DRY_RUN=1 loads every module and builds the command list without logging in (no token needed)
const DRY_RUN = process.env.DRY_RUN === '1';
if (!DISCORD_TOKEN && !DRY_RUN) throw new Error('DISCORD_TOKEN is missing (.env locally, Variables on Railway)');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  // Message/Channel partials: deletes and edits of messages sent before the last restart still reach the logs
  partials: [Partials.Message, Partials.Channel],
});

const commands = [...setup.commands, ...featureCommands];

async function registerCommands(guildId) {
  const rest = new REST().setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
}

// ---- one listener per event, fanned out to the features ---------------------------------------
// Every feature exports optional onInteraction(i), onMessage(m), onReady(client) hooks. They run
// side by side (same behaviour as the old separate listeners) and one failing never stops the others.
const handlers = [setup, ...features];
const name = (h) => (h === setup ? 'setup' : h.name ?? 'feature');
function fanOut(hook, ...args) {
  for (const h of handlers) {
    if (typeof h[hook] !== 'function') continue;
    Promise.resolve()
      .then(() => h[hook](...args))
      .catch((err) => console.error(`[${hook}] ${name(h)}:`, err));
  }
}

for (const f of features) f.init?.(client);

client.on('interactionCreate', (i) => fanOut('onInteraction', i));
client.on('messageCreate', (m) => fanOut('onMessage', m));

client.once('clientReady', async () => {
  await new REST().setToken(DISCORD_TOKEN).put(Routes.applicationCommands(client.user.id), { body: [] });
  for (const g of client.guilds.cache.values()) {
    await g.roles.fetch().catch(() => {});
    await g.channels.fetch().catch(() => {});
    remember(g);
    await registerCommands(g.id).catch(console.error);
  }
  console.log(`Online as ${client.user.tag} in ${client.guilds.cache.size} server(s)`);
  fanOut('onReady', client);
});

client.on('guildCreate', (g) => registerCommands(g.id).catch(console.error));
process.on('unhandledRejection', (e) => console.error(e));

if (DRY_RUN) {
  const hooks = (k) => handlers.filter((h) => typeof h[k] === 'function').length;
  console.log(`[dry-run] ${features.length} features, ${commands.length} commands: ${commands.map((c) => c.name).join(', ')}`);
  console.log(`[dry-run] onInteraction x${hooks('onInteraction')}, onMessage x${hooks('onMessage')}, onReady x${hooks('onReady')}`);
  console.log(`[dry-run] listeners: interactionCreate=${client.listenerCount('interactionCreate')} messageCreate=${client.listenerCount('messageCreate')} clientReady=${client.listenerCount('clientReady')}`);
  process.exit(0);
}

client.login(DISCORD_TOKEN);
