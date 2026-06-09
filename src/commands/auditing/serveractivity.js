const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('serveractivity')
 .setDescription('Displays a link to the visual telemetry charts and metrics on the web dashboard.')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

 async execute(interaction) {
 const { guild } = interaction;
 if (!guild) return;

 try {
 const dashboardUrl = process.env.DASHBOARD_REDIRECT_URI || 'http://localhost:5173/';

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Server Activity Telemetry\nTo view detailed real-time active telemetry graphs, user growth analytics, and visual charts, visit the **Friday Web Admin Dashboard**.`
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png')
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Total Members:** ${guild.memberCount.toLocaleString()}\n` +
 `**Channels:** ${guild.channels.cache.size.toLocaleString()}\n` +
 `**Roles:** ${guild.roles.cache.size.toLocaleString()}`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setLabel('Open Web Dashboard')
 .setStyle(ButtonStyle.Link)
 .setURL(dashboardUrl)
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Telemetry analysis provided by Friday Bot`)
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[SERVERACTIVITY ERROR]', err);
 const _errMsg = { content: 'Failed to load server activity information.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
