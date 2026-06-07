const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder,
 ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('serverinfo')
 .setDescription('Displays detailed, styled statistics about the current server.'),

 async execute(interaction) {
 const { guild } = interaction;
 if (!guild) return;

 try {
 const owner = await guild.fetchOwner();
 const rolesCount = guild.roles.cache.size;
 const channels = guild.channels.cache;
 const textCount = channels.filter(c => c.type === 0 || c.type === 5).size;
 const voiceCount = channels.filter(c => c.type === 2).size;

 const verificationLabels = {
 0: 'None', 1: 'Low (Verified Email)', 2: 'Medium (Registered > 5m)',
 3: 'High (Member > 10m)', 4: 'Very High (Verified Phone)'
 };

 const createdUnix = Math.floor(guild.createdTimestamp / 1000);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${guild.name}\n**ID:** \`${guild.id}\``
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png')
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Owner:** ${owner} (\`${owner.id}\`)\n` +
 `**Created:** <t:${createdUnix}:F> (<t:${createdUnix}:R>)`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Members:** **${guild.memberCount.toLocaleString()}**\n` +
 `**Roles:** **${rolesCount}**\n` +
 `**Boosts:** **${guild.premiumSubscriptionCount || 0}** (Level ${guild.premiumTier})\n` +
 `**Channels:** **${textCount}**Text · **${voiceCount}**Voice (Total: ${channels.size})\n` +
 `**Security:** **${verificationLabels[guild.verificationLevel]}**`
 )
 );

 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });
 } catch (err) {
 console.error('[SERVERINFO COMMAND ERROR] Failed:', err);
 const errMsg = { content: 'Failed to collect server statistics.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
