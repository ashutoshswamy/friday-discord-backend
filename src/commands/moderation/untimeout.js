const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Removes an active timeout from a member early.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to remove the timeout from')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for removing the timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    /**
     * Executes the untimeout command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const { guild, user } = interaction;

        if (!guild) return;

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.editReply({ content: '❌ This user is not currently in the server.', ephemeral: true });
        }

        if (!targetMember.communicationDisabledUntilTimestamp || targetMember.communicationDisabledUntilTimestamp < Date.now()) {
            return interaction.editReply({ content: '❌ This user does not currently have an active timeout.', ephemeral: true });
        }

        if (!targetMember.moderatable) {
            return interaction.editReply({
                content: '❌ I cannot remove the timeout for this user — they may outrank me or I lack permission.',
                ephemeral: true
            });
        }

        try {
            // Setting timeout to null removes it natively
            await targetMember.timeout(null, `${reason} | Timeout removed by ${user.tag}`);

            // Log infraction
            await db.logInfraction(guild.id, targetUser.id, user.id, 'UNTIMEOUT', reason);

            const embed = new EmbedBuilder()
                .setTitle('🔊 Timeout Removed')
                .setColor('#00FF66')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`**${targetUser.tag}** can now send messages and join voice channels again.`)
                .addFields(
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Moderator', value: `<@${user.id}>`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Untimeout failed:', err);
            const errMsg = { content: '❌ Failed to remove the timeout. Verify my role has the Moderate Members permission.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
