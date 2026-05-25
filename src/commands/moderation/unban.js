const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unbans a user from the server by their user ID.')
        .addStringOption(option => 
            option.setName('user_id')
                .setDescription('The Discord ID of the user to unban')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for unbanning this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    /**
     * Executes the unban command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetId = interaction.options.getString('user_id');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const { guild, user } = interaction;

        if (!guild) return;

        try {
            // Check if the user is actually banned first
            const ban = await guild.bans.fetch(targetId).catch(() => null);

            if (!ban) {
                return interaction.editReply({ 
                    content: `No active ban found for user ID \`${targetId}\` in this server.`, 
                    ephemeral: true 
                });
            }

            await guild.members.unban(targetId, `${reason} | Unbanned by ${user.tag}`);

            // Log infraction
            await db.logInfraction(guild.id, targetId, user.id, 'UNBAN', reason);

            const embed = new EmbedBuilder()
                .setTitle('User Unbanned')
                .setColor('#00FF00')
                .setDescription(`Successfully unbanned **${ban.user.tag}** (\`${targetId}\`) from the server.`)
                .addFields(
                    { name: 'Moderator', value: `${user}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Unban failed:', err);
            const _errMsg = { content: 'Failed to unban this user. Please ensure the user ID is correct and that my bot role has the ', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
