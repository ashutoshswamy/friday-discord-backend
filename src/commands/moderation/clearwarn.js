const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarn')
        .setDescription('Deletes specific or all warnings for a user.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to clear warnings for')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('id')
                .setDescription('The specific Warning ID to clear (e.g. warn_1A2B3C)')
                .setRequired(false))
        .addBooleanOption(option => 
            option.setName('all')
                .setDescription('Set to true to clear all warnings for this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    /**
     * Executes the clearwarn command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const warningId = interaction.options.getString('id');
        const clearAll = interaction.options.getBoolean('all');
        const { guild, user } = interaction;

        if (!guild) return;

        // Validation: The moderator must provide either ID or ALL, but not neither
        if (!warningId && !clearAll) {
            return interaction.editReply({
                content: '❌ Please specify either a **Warning ID** (using the `id` option) or set **`all`** to `True` to wipe warning history.',
                ephemeral: true
            });
        }

        try {
            // Case 1: Clear all warnings
            if (clearAll) {
                const countDeleted = await db.clearAllWarnings(guild.id, targetUser.id);

                if (countDeleted === 0) {
                    return interaction.editReply({
                        content: `**${targetUser.tag}** has no active warnings in this server.`,
                        ephemeral: true
                    });
                }

                // Log cleanup infraction
                await db.logInfraction(guild.id, targetUser.id, user.id, 'CLEAR_ALL_WARNS', `Cleared all (${countDeleted}) warnings`);

                const embed = new EmbedBuilder()
                    .setTitle('Warnings Cleared')
                    .setColor('#00FF00')
                    .setDescription(`Successfully cleared **all (${countDeleted})** warning records for **${targetUser.tag}**.`)
                    .addFields({ name: 'Moderator', value: `${user}`, inline: true })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Case 2: Clear specific warning ID
            if (warningId) {
                // Ensure casing matches
                const targetWarnId = warningId.toUpperCase().trim();
                const deleted = await db.deleteWarning(guild.id, targetUser.id, targetWarnId);

                if (!deleted) {
                    return interaction.editReply({
                        content: `❌ Could not find a warning with ID \`${targetWarnId}\` for user **${targetUser.tag}**. Double check using \`/warnings\`.`,
                        ephemeral: true
                    });
                }

                // Log cleanup infraction
                await db.logInfraction(guild.id, targetUser.id, user.id, 'CLEAR_WARN', `Cleared warning ID ${targetWarnId}`);

                const embed = new EmbedBuilder()
                    .setTitle('Warning Cleared')
                    .setColor('#00FF00')
                    .setDescription(`Successfully deleted warning ID \`${targetWarnId}\` for **${targetUser.tag}**.`)
                    .addFields({ name: 'Moderator', value: `${user}`, inline: true })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[ERROR] Clear warn failed:', err);
            const _errMsg = { content: 'An error occurred while attempting to clear warning records.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
