const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const DURATION_LABELS = {
 60000: '60 Seconds', 300000: '5 Minutes', 600000: '10 Minutes',
 3600000: '1 Hour', 86400000: '1 Day', 604800000: '1 Week'
};

module.exports = {
 data: new SlashCommandBuilder()
 .setName('timeout')
 .setDescription('Puts a user in a timeout (native Discord mute).')
 .addUserOption(option =>
 option.setName('user').setDescription('The user to timeout').setRequired(true))
 .addIntegerOption(option =>
 option.setName('duration').setDescription('The duration of the timeout').setRequired(true)
 .addChoices(
 { name: '60 Seconds', value: 60 * 1000 },
 { name: '5 Minutes', value: 5 * 60 * 1000 },
 { name: '10 Minutes', value: 10 * 60 * 1000 },
 { name: '1 Hour', value: 60 * 60 * 1000 },
 { name: '1 Day', value: 24 * 60 * 60 * 1000 },
 { name: '1 Week', value: 7 * 24 * 60 * 60 * 1000 }
 ))
 .addStringOption(option =>
 option.setName('reason').setDescription('The reason for the timeout').setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user');
 const duration = interaction.options.getInteger('duration');
 const reason = interaction.options.getString('reason') || 'No reason provided';
 const { guild, user } = interaction;

 if (!guild) return;

 if (targetUser.id === user.id) {
 return interaction.editReply({ content: 'You cannot timeout yourself.', ephemeral: true });
 }

 const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

 if (!targetMember) {
 return interaction.editReply({ content: 'This user is not currently in the server.', ephemeral: true });
 }

 if (!targetMember.moderatable) {
 return interaction.editReply({ content: 'I cannot timeout this user — they may outrank me or I lack permission.', ephemeral: true });
 }

 if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
 return interaction.editReply({ content: 'You cannot timeout this user — they have an equal or higher role.', ephemeral: true });
 }

 const durationLabel = DURATION_LABELS[duration] || `${duration / 1000}s`;
 const expiresUnix = Math.floor((Date.now() + duration) / 1000);

 const confirmBtn = new ButtonBuilder().setCustomId('to_confirm').setLabel(`Timeout for ${durationLabel}`).setStyle(ButtonStyle.Danger);
 const cancelBtn = new ButtonBuilder().setCustomId('to_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
 const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

 const confirmContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Confirm Timeout\nYou are about to mute <@${targetUser.id}> in **${guild.name}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
 `**Duration:** **${durationLabel}**\n` +
 `**Expires:** <t:${expiresUnix}:R>\n` +
 `**Reason:** ${reason}`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Confirm within 30 seconds.`))
 .addActionRowComponents(row);

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 30000,
 max: 1
 });

 collector.on('collect', async i => {
 if (i.customId === 'to_cancel') {
 return i.update({ content: 'Timeout cancelled.', flags: MessageFlags.IsComponentsV2, components: [] });
 }

 try {
 await targetMember.timeout(duration, `${reason} | Timed out by ${user.tag}`);
 await db.logInfraction(guild.id, targetUser.id, user.id, 'TIMEOUT', reason);

 const timedOutContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## User Timed Out\n**${targetUser.tag}** has been timed out in **${guild.name}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**User ID:** \`${targetUser.id}\`\n` +
 `**Moderator:** <@${user.id}>\n` +
 `**Duration:** **${durationLabel}**\n` +
 `**Expires:** <t:${expiresUnix}:R>\n` +
 `**Reason:** ${reason}`
 )
 );

 await i.update({ flags: MessageFlags.IsComponentsV2, components: [timedOutContainer] });
 } catch (err) {
 console.error('[ERROR] Timeout failed:', err);
 await i.update({ content: 'Failed to timeout this user. Verify my role has the Moderate Members permission.', flags: MessageFlags.IsComponentsV2, components: [] });
 }
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 await interaction.editReply({ content: 'Confirmation timed out. No action taken.', flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);
 }
 });
 }
};
