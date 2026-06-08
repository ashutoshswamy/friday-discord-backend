const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('clearwarn')
 .setDescription('Deletes specific or all warnings for a user.')
 .addUserOption(option =>
 option.setName('user').setDescription('The user to clear warnings for').setRequired(true))
 .addStringOption(option =>
 option.setName('id').setDescription('The specific Warning ID to clear (e.g. warn_1A2B3C)').setRequired(false))
 .addBooleanOption(option =>
 option.setName('all').setDescription('Set to true to clear all warnings for this user').setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user');
 const warningId = interaction.options.getString('id');
 const clearAll = interaction.options.getBoolean('all');
 const { guild, user } = interaction;

 if (!guild) return;

 if (!warningId && !clearAll) {
 return interaction.editReply({
 content: 'Please specify either a **Warning ID** (using the `id` option) or set **`all`** to `True` to wipe warning history.',
 ephemeral: true
 });
 }

 try {
 if (clearAll) {
 const countDeleted = await db.clearAllWarnings(guild.id, targetUser.id);

 if (countDeleted === 0) {
 return interaction.editReply({ content: `**${targetUser.tag}** has no active warnings to clear.`, ephemeral: true });
 }

 await db.logInfraction(guild.id, targetUser.id, user.id, 'CLEAR_ALL_WARNS', `Cleared all (${countDeleted}) warnings`);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## All Warnings Cleared\nCleared **${countDeleted}** warning(s) for **${targetUser.tag}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User:** <@${targetUser.id}>\n**Moderator:** <@${user.id}>`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (warningId) {
 const targetWarnId = warningId.toUpperCase().trim();
 const deleted = await db.deleteWarning(guild.id, targetUser.id, targetWarnId);

 if (!deleted) {
 return interaction.editReply({
 content: `Could not find warning ID \`${targetWarnId}\` for **${targetUser.tag}**. Verify with \`/warnings\`.`,
 ephemeral: true
 });
 }

 await db.logInfraction(guild.id, targetUser.id, user.id, 'CLEAR_WARN', `Cleared warning ID ${targetWarnId}`);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Warning Removed\nWarning \`${targetWarnId}\` has been removed from **${targetUser.tag}**'s record.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User:** <@${targetUser.id}>\n**Moderator:** <@${user.id}>`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
 } catch (err) {
 console.error('[ERROR] Clear warn failed:', err);
 const errMsg = { content: 'Failed to clear warning records.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
