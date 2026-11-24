require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const setup = require('./setup');
const { features, commands: featureCommands } = require('./features');
const { remember } = require('./util');

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is missing (.env locally, Variables on Railway)');

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
});

const commands = [...setup.commands, ...featureCommands];

async function registerCommands(guildId) {
  const rest = new REST().setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
}

setup.init(client);
for (const f of features) f.init(client);

client.once('clientReady', async () => {
  await new REST().setToken(DISCORD_TOKEN).put(Routes.applicationCommands(client.user.id), { body: [] });
  for (const g of client.guilds.cache.values()) {
    await g.roles.fetch().catch(() => {});
    await g.channels.fetch().catch(() => {});
    remember(g);
    await registerCommands(g.id).catch(console.error);
  }
  console.log(`Online as ${client.user.tag} in ${client.guilds.cache.size} server(s)`);
});

client.on('guildCreate', (g) => registerCommands(g.id).catch(console.error));
process.on('unhandledRejection', (e) => console.error(e));

client.login(DISCORD_TOKEN);
