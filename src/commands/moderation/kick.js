const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('kick')
 .setDescription('Kicks a user from the server.')
 .addUserOption(option =>
 option.setName('user').setDescription('The user to kick').setRequired(true))
 .addStringOption(option =>
 option.setName('reason').setDescription('The reason for kicking this user').setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user');
 const reason = interaction.options.getString('reason') || 'No reason provided';
 const { guild, user } = interaction;

 if (!guild) return;

 if (targetUser.id === user.id) {
 return interaction.editReply({ content: 'You cannot kick yourself.', ephemeral: true });
 }

 const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

 if (!targetMember) {
 return interaction.editReply({ content: 'This user is not currently in the server.', ephemeral: true });
 }

 if (!targetMember.kickable) {
 return interaction.editReply({ content: 'I cannot kick this user — they may outrank me or I lack permission.', ephemeral: true });
 }

 if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
 return interaction.editReply({ content: 'You cannot kick this user — they have an equal or higher role.', ephemeral: true });
 }

 const confirmBtn = new ButtonBuilder().setCustomId('kick_confirm').setLabel('Confirm Kick').setStyle(ButtonStyle.Danger);
 const cancelBtn = new ButtonBuilder().setCustomId('kick_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
 const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

 const confirmContainer = new ContainerBuilder()
 .setAccentColor(0xFFA500)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Confirm Kick\nYou are about to ** kick** <@${targetUser.id}> from **${guild.name}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User:** ${targetUser.tag} (\`${targetUser.id}\`)\n**Reason:** ${reason}`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# They can rejoin with an invite. Confirm within 30 seconds.`))
 .addActionRowComponents(row);

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 30000,
 max: 1
 });

 collector.on('collect', async i => {
 if (i.customId === 'kick_cancel') {
 return i.update({ content: 'Kick cancelled.', flags: MessageFlags.IsComponentsV2, components: [] });
 }

 try {
 await targetMember.kick(`${reason} | Kicked by ${user.tag}`);
 await db.logInfraction(guild.id, targetUser.id, user.id, 'KICK', reason);

 const kickedContainer = new ContainerBuilder()
 .setAccentColor(0xFFA500)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## User Kicked\n**${targetUser.tag}** has been kicked from **${guild.name}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User ID:** \`${targetUser.id}\`\n` +
 `**Moderator:** <@${user.id}>\n` +
 `**Reason:** ${reason}`
 )
 );

 await i.update({ flags: MessageFlags.IsComponentsV2, components: [kickedContainer] });
 } catch (err) {
 console.error('[ERROR] Kick failed:', err);
 await i.update({ content: 'Failed to kick this user. Verify my role has the Kick Members permission.', flags: MessageFlags.IsComponentsV2, components: [] });
 }
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 await interaction.editReply({ content: 'Confirmation timed out. Kick cancelled.', flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);
 }
 });
 }
};
