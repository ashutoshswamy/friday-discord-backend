const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server and deletes their recent message history.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for banning this user')
                .setRequired(false))
        .addIntegerOption(option => 
            option.setName('days')
                .setDescription('Number of days of message history to delete (0-7 days)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    /**
     * Executes the ban command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days = interaction.options.getInteger('days') || 0;
        const { guild, user } = interaction;

        if (!guild) return;

        // Check if user tries to ban themselves
        if (targetUser.id === user.id) {
            return interaction.editReply({ content: 'You cannot ban yourself!', ephemeral: true });
        }

        // Try to fetch the guild member to verify role hierarchies
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (targetMember) {
            // Check if member is bannable by the bot
            if (!targetMember.bannable) {
                return interaction.editReply({ 
                    content: 'I cannot ban this user. They may have a higher role than me or I do not have permission to ban them.', 
                    ephemeral: true 
                });
            }

            // Check if executing user has role superiority
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
                return interaction.editReply({
                    content: 'You cannot ban this user because they have an equal or higher role than you.',
                    ephemeral: true
                });
            }
        }

        try {
            // Delete messages from past N days (converted to seconds)
            const deleteMessageSeconds = days * 24 * 60 * 60;

            await guild.members.ban(targetUser.id, { 
                deleteMessageSeconds, 
                reason: `${reason} | Banned by ${user.tag}` 
            });

            // Log infraction in our database utility
            await db.logInfraction(guild.id, targetUser.id, user.id, 'BAN', reason);

            const embed = new EmbedBuilder()
                .setTitle('User Banned')
                .setColor('#FF0000')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Successfully banned **${targetUser.tag}** from the server.`)
                .addFields(
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Moderator', value: `${user}`, inline: true },
                    { name: 'Deleted Message History', value: `${days} day(s)`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Ban failed:', err);
            const _errMsg = { content: 'An error occurred while attempting to ban this user. Please verify my bot role has the ', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
