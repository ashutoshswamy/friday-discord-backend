const {
 SlashCommandBuilder, PermissionFlagsBits, ChannelType,
 ContainerBuilder, TextDisplayBuilder, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('lockdown')
 .setDescription('Prevents or permits standard users from sending messages in a channel.')
 .addChannelOption(option =>
 option.setName('channel').setDescription('The channel to lock or unlock (defaults to the current channel)')
 .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
 .addBooleanOption(option =>
 option.setName('unlock').setDescription('Set to True to unlock the channel').setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

 async execute(interaction) {
 const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
 const unlock = interaction.options.getBoolean('unlock') || false;
 const { guild } = interaction;

 if (!guild || !targetChannel) return;

 if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) {
 return interaction.editReply({ content: 'You can only lock text or announcement channels!', ephemeral: true });
 }

 try {
 const everyoneRole = guild.roles.everyone;

 if (unlock) {
 await targetChannel.permissionOverwrites.edit(everyoneRole, { SendMessages: null }, { reason: `Channel unlocked by ${interaction.user.tag}` });

 const unlockContainer = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Channel Unlocked\nThis channel has been unlocked. Users can now resume sending messages.`)
 );

 await targetChannel.send({ flags: MessageFlags.IsComponentsV2, components: [unlockContainer] }).catch(() => null);

 await interaction.editReply({
 content: targetChannel.id !== interaction.channelId
 ? `Successfully unlocked ${targetChannel}.`
 : ' Channel unlocked!',
 ephemeral: true
 });
 } else {
 await targetChannel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }, { reason: `Channel locked down by ${interaction.user.tag}` });

 const lockContainer = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Channel Lockdown\nThis channel is now locked. Sending messages has been disabled for standard members.`)
 );

 await targetChannel.send({ flags: MessageFlags.IsComponentsV2, components: [lockContainer] }).catch(() => null);

 await interaction.editReply({
 content: targetChannel.id !== interaction.channelId
 ? `Successfully locked down ${targetChannel}.`
 : ' Channel locked down!',
 ephemeral: true
 });
 }
 } catch (err) {
 console.error('[ERROR] Lockdown command failed:', err);
 const _errMsg = { content: 'Failed to update channel permissions. Verify my role has the Manage Roles permission.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
