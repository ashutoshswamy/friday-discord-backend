const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serveractivity')
        .setDescription('Displays a link to the visual telemetry charts and metrics on the web dashboard.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    /**
     * Executes the serveractivity command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        try {
            const dashboardUrl = process.env.DASHBOARD_REDIRECT_URI || 'http://localhost:5173/';

            const embed = new EmbedBuilder()
                .setTitle(`📊 Server Activity Telemetry: ${guild.name}`)
                .setColor('#8b5cf6')
                .setThumbnail(guild.iconURL({ forceStatic: true }))
                .setDescription(
                    `To view detailed real-time active telemetry graphs, user growth analytics, ` +
                    `and visual charts, click the button link below to visit the **Friday Web Admin Dashboard**.\n\n` +
                    `🔗 **[Access Web Dashboard](${dashboardUrl})**`
                )
                .addFields(
                    { name: 'Total Members Count', value: `👥 **${guild.memberCount}** members`, inline: true },
                    { name: 'Channels Count', value: `📺 **${guild.channels.cache.size}** channels`, inline: true },
                    { name: 'Roles Registered', value: `🎭 **${guild.roles.cache.size}** roles`, inline: true }
                )
                .setFooter({ text: 'Telemetry analysis provided by Friday Bot' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[SERVERACTIVITY ERROR]', err);
            const _errMsg = { content: '❌ Failed to load server activity information.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
