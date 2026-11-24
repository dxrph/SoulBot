const {
  SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType,
} = require('discord.js');

// Guild-only slash command (replaces deprecated setDMPermission(false)).
function guildSlash(name, description) {
  const cmd = new SlashCommandBuilder().setName(name).setDescription(description);
  if (typeof cmd.setContexts === 'function' && InteractionContextType?.Guild != null) {
    cmd.setContexts(InteractionContextType.Guild);
  }
  if (typeof cmd.setIntegrationTypes === 'function' && ApplicationIntegrationType?.GuildInstall != null) {
    cmd.setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
  } else if (typeof cmd.setDMPermission === 'function') {
    cmd.setDMPermission(false);
  }
  return cmd;
}

module.exports = { guildSlash };
