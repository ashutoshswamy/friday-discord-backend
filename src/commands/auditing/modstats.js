const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('modstats')
 .setDescription('Displays moderation metrics and execution stats for a staff member.')
 .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
 .addUserOption(opt =>
 opt.setName('moderator')
 .setDescription('The staff member whose metrics you want to see (defaults to you)')
 .setRequired(false)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const targetMod = options.getUser('moderator') || user;

 try {
 const stats = await db.getModeratorStats(guild.id, targetMod.id);
 const totalActions = stats.WARN + stats.TIMEOUT + stats.KICK + stats.BAN;

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Staff Metrics: ${targetMod.username}\n**Staff Member:** <@${targetMod.id}>\n**Staff ID:** \`${targetMod.id}\``
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetMod.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Total Actions Logged:** **${totalActions}** actions`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Warnings Issued:** ${stats.WARN}\n` +
 `**Timeouts Applied:** ${stats.TIMEOUT}\n` +
 `**Members Kicked:** ${stats.KICK}\n` +
 `**Permanent Bans:** ${stats.BAN}`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[MODSTATS ERROR]', err);
 const _errMsg = { content: 'Failed to load staff metrics.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
