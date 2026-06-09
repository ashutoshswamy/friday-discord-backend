const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('unban')
 .setDescription('Unbans a user from the server by their user ID.')
 .addStringOption(option =>
 option.setName('user_id').setDescription('The Discord ID of the user to unban').setRequired(true))
 .addStringOption(option =>
 option.setName('reason').setDescription('The reason for unbanning this user').setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

 async execute(interaction) {
 const targetId = interaction.options.getString('user_id');
 const reason = interaction.options.getString('reason') || 'No reason provided';
 const { guild, user } = interaction;

 if (!guild) return;

 try {
 const ban = await guild.bans.fetch(targetId).catch(() => null);

 if (!ban) {
 return interaction.editReply({
 content: `No active ban found for user ID \`${targetId}\` in this server.`,
 ephemeral: true
 });
 }

 await guild.members.unban(targetId, `${reason} | Unbanned by ${user.tag}`);
 await db.logInfraction(guild.id, targetId, user.id, 'UNBAN', reason);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## User Unbanned\n**${ban.user.tag}** (\`${targetId}\`) has been unbanned from **${guild.name}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(ban.user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User ID:** \`${targetId}\`\n` +
 `**Moderator:** <@${user.id}>\n` +
 `**Reason:** ${reason}`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[ERROR] Unban failed:', err);
 const errMsg = { content: 'Failed to unban this user. Ensure the user ID is correct and my role has the Ban Members permission.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
