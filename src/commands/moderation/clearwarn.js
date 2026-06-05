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
                        content: `ℹ️ **${targetUser.tag}** has no active warnings to clear.`,
                        ephemeral: true
                    });
                }

                // Log cleanup infraction
                await db.logInfraction(guild.id, targetUser.id, user.id, 'CLEAR_ALL_WARNS', `Cleared all (${countDeleted}) warnings`);

                const embed = new EmbedBuilder()
                    .setTitle('🧹 All Warnings Cleared')
                    .setColor('#00FF66')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription(`Cleared **${countDeleted}** warning(s) for **${targetUser.tag}**.`)
                    .addFields(
                        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Moderator', value: `<@${user.id}>`, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Case 2: Clear specific warning ID
            if (warningId) {
                const targetWarnId = warningId.toUpperCase().trim();
                const deleted = await db.deleteWarning(guild.id, targetUser.id, targetWarnId);

                if (!deleted) {
                    return interaction.editReply({
                        content: `❌ Could not find warning ID \`${targetWarnId}\` for **${targetUser.tag}**. Verify with \`/warnings\`.`,
                        ephemeral: true
                    });
                }

                await db.logInfraction(guild.id, targetUser.id, user.id, 'CLEAR_WARN', `Cleared warning ID ${targetWarnId}`);

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Warning Removed')
                    .setColor('#00FF66')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription(`Warning \`${targetWarnId}\` has been removed from **${targetUser.tag}**'s record.`)
                    .addFields(
                        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Moderator', value: `<@${user.id}>`, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[ERROR] Clear warn failed:', err);
            const errMsg = { content: '❌ Failed to clear warning records.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
