require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const setup = require('./setup');
const { features, commands: featureCommands } = require('./features');

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is missing (.env locally, Variables on Railway)');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // privileged: join/leave logs, anti-raid
    GatewayIntentBits.GuildModeration, // ban logs
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged: say relay, anti-spam, edit/delete logs
  ],
});

const commands = [...setup.commands, ...featureCommands];

// Commands are registered per guild: they show up immediately (global ones can lag)
async function registerCommands(guildId) {
  const rest = new REST().setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
}

setup.init(client);
for (const f of features) f.init(client);

client.once('clientReady', async () => {
  await new REST().setToken(DISCORD_TOKEN).put(Routes.applicationCommands(client.user.id), { body: [] }); // drop old global commands
  for (const g of client.guilds.cache.values()) await registerCommands(g.id).catch(console.error);
  console.log(`Online as ${client.user.tag} in ${client.guilds.cache.size} server(s)`);
});

client.on('guildCreate', (g) => registerCommands(g.id).catch(console.error));
process.on('unhandledRejection', (e) => console.error(e));

client.login(DISCORD_TOKEN);
