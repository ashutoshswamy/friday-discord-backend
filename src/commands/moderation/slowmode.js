const {
 SlashCommandBuilder, PermissionFlagsBits, ChannelType,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('slowmode')
 .setDescription('Sets the slowmode delay for the current channel.')
 .addIntegerOption(option =>
 option.setName('seconds').setDescription('Slowmode delay in seconds (0 to disable, max 21600 / 6 hours)').setMinValue(0).setMaxValue(21600).setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

 async execute(interaction) {
 const seconds = interaction.options.getInteger('seconds');
 const { channel, user } = interaction;

 if (!channel) return;

 if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
 return interaction.editReply({ content: 'You can only set slowmode on text or announcement channels!', ephemeral: true });
 }

 try {
 await channel.setRateLimitPerUser(seconds, `Slowmode set by ${user.tag}`);

 if (seconds === 0) {
 const container = new ContainerBuilder()
 .setAccentColor(0x00FF00)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Slowmode Disabled\nSlowmode has been successfully disabled for this channel.`)
 );
 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 let readableTime = '';
 if (seconds >= 3600) {
 const hours = Math.floor(seconds / 3600);
 const remainingMins = Math.floor((seconds % 3600) / 60);
 readableTime = `${hours} hour(s)${remainingMins > 0 ? ` and ${remainingMins} minute(s)` : ''}`;
 } else if (seconds >= 60) {
 const minutes = Math.floor(seconds / 60);
 const remainingSecs = seconds % 60;
 readableTime = `${minutes} minute(s)${remainingSecs > 0 ? ` and ${remainingSecs} second(s)` : ''}`;
 } else {
 readableTime = `${seconds} second(s)`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(0xFFFF00)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Slowmode Enabled\nSlowmode for this channel has been set to **${readableTime}**.`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Moderator: ${user.tag}`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[ERROR] Slowmode command failed:', err);
 const _errMsg = { content: 'Failed to update slowmode. Verify my bot role has the Manage Channels permission.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
