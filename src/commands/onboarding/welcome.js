const {
 SlashCommandBuilder, PermissionFlagsBits, ChannelType,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('welcome')
 .setDescription('Configure the welcome onboarding greetings for new server members.')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('The channel to post welcome greetings inside')
 .addChannelTypes(ChannelType.GuildText)
 .setRequired(true))
 .addStringOption(option =>
 option.setName('message')
 .setDescription('Custom welcome text. Placeholders: {user}, {username}, {server}, {memberCount}')
 .setRequired(true)),

 async execute(interaction) {
 const channel = interaction.options.getChannel('channel');
 const messageText = interaction.options.getString('message');
 const { guild } = interaction;

 if (!guild || !channel) return;

 try {
 await db.updateGuildConfig(guild.id, {
 welcomeChannelId: channel.id,
 welcomeMessage: messageText
 });

 const container = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Welcome System Enabled\nOnboarding greeting cards successfully directed to ${channel}.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Welcome Greeting Template:**\n\`\`\`\n${messageText}\n\`\`\``
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Placeholders: {user}, {username}, {server}, {memberCount}`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[WELCOME CONFIG ERROR] Failed to save configs:', err);
 const errMsg = { content: 'Failed to save welcome configuration. Verify database connection.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 return interaction.followUp(errMsg).catch(() => {});
 } else {
 return interaction.editReply(errMsg).catch(() => {});
 }
 }
 }
};
