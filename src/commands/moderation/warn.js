const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
 .setName('warn')
 .setDescription('Issues a formal warning to a user.')
 .addUserOption(option =>
 option.setName('user').setDescription('The user to warn').setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user');
 const { guild, user } = interaction;

 if (!guild) return;

 if (targetUser.id === user.id) {
 return interaction.reply({ content: 'You cannot warn yourself.', ephemeral: true });
 }

 if (targetUser.bot) {
 return interaction.reply({ content: 'You cannot warn bot accounts.', ephemeral: true });
 }

 if (targetUser.id === guild.ownerId) {
 return interaction.reply({ content: 'You cannot warn the server owner.', ephemeral: true });
 }

 const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
 if (targetMember && guild.ownerId !== user.id) {
 if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
 return interaction.reply({ content: 'You cannot warn this user — they have an equal or higher role.', ephemeral: true });
 }
 }

 const modal = new ModalBuilder()
 .setCustomId(`warn_modal_${targetUser.id}`)
 .setTitle(`Warn ${targetUser.username}`);

 const reasonInput = new TextInputBuilder()
 .setCustomId('warn_reason')
 .setLabel('Reason for Warning')
 .setStyle(TextInputStyle.Paragraph)
 .setPlaceholder('Describe the rule violation or behavior that warrants this warning...')
 .setMinLength(5)
 .setMaxLength(500)
 .setRequired(true);

 modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

 await interaction.showModal(modal);

 const submitted = await interaction.awaitModalSubmit({
 filter: i => i.customId === `warn_modal_${targetUser.id}` && i.user.id === user.id,
 time: 120000
 }).catch(() => null);

 if (!submitted) return;

 await submitted.deferReply();

 const reason = submitted.fields.getTextInputValue('warn_reason');

 try {
 const warning = await db.addWarning(guild.id, targetUser.id, user.id, reason);
 await db.logInfraction(guild.id, targetUser.id, user.id, 'WARN', reason);

 const allWarns = await db.getWarnings(guild.id, targetUser.id);
 const warnCount = allWarns.length;

 const dmsSent = await targetUser.send(
 `**Warning Issued** — **${guild.name}**\n` +
 `You have received a formal warning (Warning #${warnCount}).\n` +
 `**Reason:** ${reason}`
 ).then(() => true).catch(() => false);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Warning Issued\n**${targetUser.tag}** has received Warning #${warnCount}.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
 `**Moderator:** <@${user.id}>\n` +
 `**Warning ID:** \`${warning.id}\`\n` +
 `**DM Sent:** ${dmsSent ? ' Yes' : ' No (DMs closed)'}\n` +
 `**Total Warnings:** **${warnCount}** warning(s)\n` +
 `**Reason:** ${reason}`
 )
 );

 await submitted.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 const rules = await db.getPunishmentRules(guild.id);
 const matchingRule = rules.find(r => warnCount === r.warnThreshold);
 if (matchingRule) {
 const member = await guild.members.fetch(targetUser.id).catch(() => null);
 if (member) {
 const escReason = `[AUTO-ESCALATION] Reached ${matchingRule.warnThreshold} warnings.`;
 try {
 if (matchingRule.punishmentType === 'TIMEOUT' && member.moderatable) {
 await member.timeout(matchingRule.durationMs, escReason);
 await db.logInfraction(guild.id, targetUser.id, interaction.client.user.id, 'TIMEOUT', escReason);
 } else if (matchingRule.punishmentType === 'KICK' && member.kickable) {
 await member.kick(escReason);
 await db.logInfraction(guild.id, targetUser.id, interaction.client.user.id, 'KICK', escReason);
 } else if (matchingRule.punishmentType === 'BAN' && member.bannable) {
 await member.ban({ reason: escReason });
 await db.logInfraction(guild.id, targetUser.id, interaction.client.user.id, 'BAN', escReason);
 }
 } catch (escErr) {
 console.error('[WARN] Escalation failed:', escErr);
 }
 }
 }
 } catch (err) {
 console.error('[ERROR] Warn failed:', err);
 await submitted.editReply({ content: 'An error occurred while issuing this warning.', ephemeral: true }).catch(() => null);
 }
 }
};
