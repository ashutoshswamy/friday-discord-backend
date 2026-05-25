const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Sets the slowmode delay for the current channel.')
        .addIntegerOption(option => 
            option.setName('seconds')
                .setDescription('Slowmode delay in seconds (0 to disable, max 21600 / 6 hours)')
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    /**
     * Executes the slowmode command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const seconds = interaction.options.getInteger('seconds');
        const { channel, user } = interaction;

        if (!channel) return;

        // Verify slowmode is supported on this channel type
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
            return interaction.editReply({ 
                content: '❌ You can only set slowmode on text or announcement channels!', 
                ephemeral: true 
            });
        }

        try {
            await channel.setRateLimitPerUser(seconds, `Slowmode set by ${user.tag}`);

            if (seconds === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🐢 Slowmode Disabled')
                    .setColor('#00FF00')
                    .setDescription('Slowmode has been successfully disabled for this channel.')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } else {
                // Helper to format seconds into a friendly human-readable string
                let readableTime = '';
                if (seconds >= 3600) {
                    const hours = Math.floor(seconds / 3600);
                    const remainingMins = Math.floor((seconds % 3600) / 60);
                    readableTime = `${hours} hour(s)${remainingMins > 0 ? ` and ${remainingMins} minute(s)` : ''}`;
                } else if (seconds >= 60) {
                    const minutes = Math.floor(seconds / 60);
                    const remainingSecs = seconds % 60;
                    readableTime = `${minutes} minute(s)${remainingSecs > 0 ? ` and ${remainingSecs} second(s)` : ''}`;
                } else {
                    readableTime = `${seconds} second(s)`;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🐢 Slowmode Enabled')
                    .setColor('#FFFF00')
                    .setDescription(`Slowmode for this channel has been set to **${readableTime}**.`)
                    .setFooter({ text: `Moderator: ${user.tag}` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[ERROR] Slowmode command failed:', err);
            const _errMsg = { content: '❌ Failed to update slowmode. Verify my bot role has the ', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
