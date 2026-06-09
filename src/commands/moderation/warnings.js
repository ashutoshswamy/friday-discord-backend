const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const PAGE_SIZE = 5;

function buildWarningsContainer(targetUser, warnings, page, totalPages) {
 const start = page * PAGE_SIZE;
 const slice = warnings.slice(start, start + PAGE_SIZE);

 const warningsText = slice.map(warn => {
 const relativeTs = `<t:${Math.floor(warn.timestamp / 1000)}:R>`;
 const fullTs = `<t:${Math.floor(warn.timestamp / 1000)}:f>`;
 return `**Warning ID: \`${warn.id}\`**\n**Moderator:** <@${warn.moderatorId}>\n**Date:** ${fullTs} (${relativeTs})\n**Reason:** ${warn.reason}`;
 }).join('\n\n');

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Warning History: ${targetUser.tag}\n**${warnings.length}** warning(s) on record.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(warningsText))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Page ${page + 1} of ${totalPages} · Use /clearwarn to manage records`)
 );

 return container;
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('warnings')
 .setDescription("Displays a user's formal infraction and warning history.")
 .addUserOption(option =>
 option.setName('user').setDescription('The user to view warnings for').setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user');
 const { guild } = interaction;

 if (!guild) return;

 try {
 const warnings = await db.getWarnings(guild.id, targetUser.id);

 if (warnings.length === 0) {
 const cleanContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Warning History: ${targetUser.tag}\n This user has a clean record — no warnings on file.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 );
 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [cleanContainer] });
 }

 const sorted = warnings.slice().sort((a, b) => b.timestamp - a.timestamp);
 const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
 let page = 0;

 const prevBtn = new ButtonBuilder().setCustomId('warns_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true);
 const nextBtn = new ButtonBuilder().setCustomId('warns_next').setLabel('Next ').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1);

 const container = buildWarningsContainer(targetUser, sorted, page, totalPages);

 if (totalPages > 1) {
 container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 container.addActionRowComponents(new ActionRowBuilder().addComponents(prevBtn, nextBtn));
 }

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 if (totalPages <= 1) return;

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === interaction.user.id,
 time: 120000
 });

 collector.on('collect', async i => {
 await i.deferUpdate();

 if (i.customId === 'warns_prev') page = Math.max(0, page - 1);
 if (i.customId === 'warns_next') page = Math.min(totalPages - 1, page + 1);

 const updatedPrev = new ButtonBuilder().setCustomId('warns_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
 const updatedNext = new ButtonBuilder().setCustomId('warns_next').setLabel('Next ').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1);

 const updatedContainer = buildWarningsContainer(targetUser, sorted, page, totalPages);
 updatedContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 updatedContainer.addActionRowComponents(new ActionRowBuilder().addComponents(updatedPrev, updatedNext));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [updatedContainer] });
 });

 collector.on('end', async () => {
 const disabledPrev = new ButtonBuilder().setCustomId('warns_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true);
 const disabledNext = new ButtonBuilder().setCustomId('warns_next').setLabel('Next ').setStyle(ButtonStyle.Secondary).setDisabled(true);

 const expiredContainer = buildWarningsContainer(targetUser, sorted, page, totalPages);
 expiredContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 expiredContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledPrev, disabledNext));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
 });

 } catch (err) {
 console.error('[ERROR] Warnings command failed:', err);
 const errMsg = { content: 'Failed to fetch warning records.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
