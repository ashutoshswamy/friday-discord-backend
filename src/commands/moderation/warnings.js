const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription("Displays a user's formal infraction and warning history.")
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to view warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    /**
     * Executes the warnings command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const { guild } = interaction;

        if (!guild) return;

        try {
            // Retrieve warnings from local database wrapper
            const warnings = await db.getWarnings(guild.id, targetUser.id);

            if (warnings.length === 0) {
                return interaction.editReply({ 
                    content: `✅ **${targetUser.tag}** has a clean history. No warnings found.`, 
                    ephemeral: false 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Infraction Record: ${targetUser.tag}`)
                .setColor('#FF4500')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`This user has **${warnings.length}** warning(s) in this server.`)
                .setTimestamp();

            // Display latest 10 warnings (reverse chronological order) to respect Embed size limits
            const latestWarnings = warnings.slice().reverse().slice(0, 10);

            latestWarnings.forEach((warn, index) => {
                // Using Discord's native relative timestamp syntax (<t:timestamp:R>)
                const relativeTimestamp = `<t:${Math.floor(warn.timestamp / 1000)}:R>`;
                const formattedDate = `<t:${Math.floor(warn.timestamp / 1000)}:f>`;

                embed.addFields({
                    name: `⚠️ Warning ID: \`${warn.id}\``,
                    value: `• **Moderator:** <@${warn.moderatorId}>\n` +
                           `• **Date:** ${formattedDate} (${relativeTimestamp})\n` +
                           `• **Reason:** ${warn.reason}`
                });
            });

            if (warnings.length > 10) {
                embed.setFooter({ text: `Showing the latest 10 of ${warnings.length} warnings. Use /clearwarn to manage warnings.` });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Warnings command failed:', err);
            const _errMsg = { content: 'An error occurred while attempting to fetch warnings.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
