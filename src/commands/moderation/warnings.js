const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');

const PAGE_SIZE = 5;

function buildWarningsEmbed(targetUser, warnings, page, totalPages) {
    const start = page * PAGE_SIZE;
    const slice = warnings.slice(start, start + PAGE_SIZE);

    const embed = new EmbedBuilder()
        .setTitle(`⚠️ Warning History: ${targetUser.tag}`)
        .setColor('#FF4500')
        .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
        .setDescription(`**${warnings.length}** warning(s) on record.`)
        .setFooter({ text: `Page ${page + 1} of ${totalPages} · Use /clearwarn to manage records` })
        .setTimestamp();

    slice.forEach(warn => {
        const relativeTs = `<t:${Math.floor(warn.timestamp / 1000)}:R>`;
        const fullTs = `<t:${Math.floor(warn.timestamp / 1000)}:f>`;
        embed.addFields({
            name: `⚠️ Warning ID: \`${warn.id}\``,
            value: `**Moderator:** <@${warn.moderatorId}>\n**Date:** ${fullTs} (${relativeTs})\n**Reason:** ${warn.reason}`
        });
    });

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription("Displays a user's formal infraction and warning history.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const { guild } = interaction;

        if (!guild) return;

        try {
            const warnings = await db.getWarnings(guild.id, targetUser.id);

            if (warnings.length === 0) {
                const cleanEmbed = new EmbedBuilder()
                    .setTitle(`⚠️ Warning History: ${targetUser.tag}`)
                    .setColor('#00FF66')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription('✅ This user has a clean record — no warnings on file.')
                    .setTimestamp();
                return interaction.editReply({ embeds: [cleanEmbed] });
            }

            const sorted = warnings.slice().sort((a, b) => b.timestamp - a.timestamp);
            const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
            let page = 0;

            const prevBtn = new ButtonBuilder()
                .setCustomId('warns_prev')
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const nextBtn = new ButtonBuilder()
                .setCustomId('warns_next')
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(totalPages <= 1);

            const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
            const components = totalPages > 1 ? [row] : [];

            const response = await interaction.editReply({
                embeds: [buildWarningsEmbed(targetUser, sorted, page, totalPages)],
                components
            });

            if (totalPages <= 1) return;

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 120000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId === 'warns_prev') page = Math.max(0, page - 1);
                if (i.customId === 'warns_next') page = Math.min(totalPages - 1, page + 1);

                const updatedPrev = new ButtonBuilder().setCustomId('warns_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
                const updatedNext = new ButtonBuilder().setCustomId('warns_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1);

                await i.editReply({
                    embeds: [buildWarningsEmbed(targetUser, sorted, page, totalPages)],
                    components: [new ActionRowBuilder().addComponents(updatedPrev, updatedNext)]
                });
            });

            collector.on('end', async () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(prevBtn).setDisabled(true),
                    ButtonBuilder.from(nextBtn).setDisabled(true)
                );
                await interaction.editReply({ components: [disabledRow] }).catch(() => null);
            });

        } catch (err) {
            console.error('[ERROR] Warnings command failed:', err);
            const errMsg = { content: '❌ Failed to fetch warning records.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
