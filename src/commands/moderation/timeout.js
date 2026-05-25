const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Puts a user in a timeout (native Discord mute).')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('The duration of the timeout')
                .setRequired(true)
                .addChoices(
                    { name: '60 Seconds', value: 60 * 1000 },
                    { name: '5 Minutes', value: 5 * 60 * 1000 },
                    { name: '10 Minutes', value: 10 * 60 * 1000 },
                    { name: '1 Hour', value: 60 * 60 * 1000 },
                    { name: '1 Day', value: 24 * 60 * 60 * 1000 },
                    { name: '1 Week', value: 7 * 24 * 60 * 60 * 1000 }
                ))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for the timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    /**
     * Executes the timeout command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const { guild, user } = interaction;

        if (!guild) return;

        // Check if user tries to timeout themselves
        if (targetUser.id === user.id) {
            return interaction.editReply({ content: 'You cannot timeout yourself!', ephemeral: true });
        }

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.editReply({ content: 'This user is not currently in the server.', ephemeral: true });
        }

        // Check if member is moderatable by the bot (e.g. not owner/higher role)
        if (!targetMember.moderatable) {
            return interaction.editReply({ 
                content: 'I cannot timeout this user. They may have a higher role than me or I do not have permission to timeout them.', 
                ephemeral: true 
            });
        }

        // Check role hierarchy
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
            return interaction.editReply({
                content: 'You cannot timeout this user because they have an equal or higher role than you.',
                ephemeral: true
            });
        }

        try {
            await targetMember.timeout(duration, `${reason} | Timed out by ${user.tag}`);

            // Log infraction
            await db.logInfraction(guild.id, targetUser.id, user.id, 'TIMEOUT', reason);

            // Pre-calculate readable duration text
            const durationTexts = {
                60000: '60 Seconds',
                300000: '5 Minutes',
                600000: '10 Minutes',
                3600000: '1 Hour',
                86400000: '1 Day',
                604800000: '1 Week'
            };
            const durationText = durationTexts[duration] || `${duration / 1000}s`;

            const embed = new EmbedBuilder()
                .setTitle('User Timed Out')
                .setColor('#FFFF00')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Successfully timed out **${targetUser.tag}**.`)
                .addFields(
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Moderator', value: `${user}`, inline: true },
                    { name: 'Duration', value: durationText, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Timeout failed:', err);
            const _errMsg = { content: 'An error occurred while attempting to timeout this user. Please verify my bot role has the ', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
