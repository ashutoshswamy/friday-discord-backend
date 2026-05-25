const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for kicking this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    /**
     * Executes the kick command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const { guild, user } = interaction;

        if (!guild) return;

        // Check if user tries to kick themselves
        if (targetUser.id === user.id) {
            return interaction.editReply({ content: 'You cannot kick yourself!', ephemeral: true });
        }

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.editReply({ content: 'This user is not currently in the server.', ephemeral: true });
        }

        // Check if member is kickable by the bot
        if (!targetMember.kickable) {
            return interaction.editReply({ 
                content: 'I cannot kick this user. They may have a higher role than me or I do not have permission to kick them.', 
                ephemeral: true 
            });
        }

        // Check if executing user has role superiority
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
            return interaction.editReply({
                content: 'You cannot kick this user because they have an equal or higher role than you.',
                ephemeral: true
            });
        }

        try {
            await targetMember.kick(`${reason} | Kicked by ${user.tag}`);

            // Log infraction
            await db.logInfraction(guild.id, targetUser.id, user.id, 'KICK', reason);

            const embed = new EmbedBuilder()
                .setTitle('User Kicked')
                .setColor('#FFA500')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Successfully kicked **${targetUser.tag}** from the server.`)
                .addFields(
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Moderator', value: `${user}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Kick failed:', err);
            const _errMsg = { content: 'An error occurred while attempting to kick this user. Please verify my bot role has the ', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
