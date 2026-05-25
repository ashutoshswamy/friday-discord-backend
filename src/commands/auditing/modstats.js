const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modstats')
        .setDescription('Displays moderation metrics and execution stats for a staff member.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addUserOption(opt => 
            opt.setName('moderator')
                .setDescription('The staff member whose metrics you want to see (defaults to you)')
                .setRequired(false)),

    /**
     * Executes the modstats command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const targetMod = options.getUser('moderator') || user;

        try {
            // Retrieve stats from db
            const stats = await db.getModeratorStats(guild.id, targetMod.id);

            const totalActions = stats.WARN + stats.TIMEOUT + stats.KICK + stats.BAN;

            const embed = new EmbedBuilder()
                .setTitle(`📊 Staff Metrics: ${targetMod.username}`)
                .setThumbnail(targetMod.displayAvatarURL({ forceStatic: true }))
                .setColor('#FF9900')
                .addFields(
                    { name: 'Staff Member', value: `${targetMod}`, inline: true },
                    { name: 'Staff ID', value: `\`${targetMod.id}\``, inline: true },
                    { name: 'Total Actions Logged', value: `📈 **${totalActions}** actions`, inline: true },
                    { name: 'Warnings Issued', value: `⚠️ **${stats.WARN}** warns`, inline: true },
                    { name: 'Timeouts Applied', value: `🤐 **${stats.TIMEOUT}** mutes`, inline: true },
                    { name: 'Members Kicked', value: `👢 **${stats.KICK}** kicks`, inline: true },
                    { name: 'Permanent Bans', value: `🔨 **${stats.BAN}** bans`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[MODSTATS ERROR]', err);
            const _errMsg = { content: '❌ Failed to load staff metrics.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
