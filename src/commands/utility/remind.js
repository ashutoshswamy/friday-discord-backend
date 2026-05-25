const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function parseTime(timeStr) {
    const regex = /^(\d+)([smhd])$/;
    const match = timeStr.match(regex);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Schedules a deferred background timer notification.')
        .addStringOption(opt => 
            opt.setName('time')
                .setDescription('When to remind you (e.g. 10s, 5m, 2h, 1d)')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('message')
                .setDescription('The reminder note to notify you with')
                .setRequired(true)),

    /**
     * Executes the remind command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { user, options } = interaction;
        const timeInput = options.getString('time').trim().toLowerCase();
        const message = options.getString('message');

        try {
            const durationMs = parseTime(timeInput);
            if (!durationMs || durationMs < 5000) {
                return interaction.editReply({
                    content: '❌ Invalid time formatting! Use structures like: `10s` (10 seconds), `5m` (5 minutes), `2h` (2 hours), or `1d` (1 day). Minimum reminder is 5s.',
                    ephemeral: true
                });
            }

            // Cap reminder at 14 days
            if (durationMs > 14 * 24 * 60 * 60 * 1000) {
                return interaction.editReply({
                    content: '❌ Cooldown limit: Reminders cannot exceed 14 days!',
                    ephemeral: true
                });
            }

            const alertTimeUnix = Math.floor((Date.now() + durationMs) / 1000);

            const embed = new EmbedBuilder()
                .setTitle('⏰ Reminder Scheduled')
                .setColor('#8b5cf6')
                .setDescription(`I will DM you a reminder **<t:${alertTimeUnix}:R>** (at <t:${alertTimeUnix}:F>).`)
                .addFields({ name: 'Reminder Note', value: `*"${message}"*` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Deferred task trigger
            setTimeout(async () => {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⏰ REMINDER NOTIFICATION!')
                    .setColor('#8b5cf6')
                    .setDescription(`You scheduled a reminder for now!`)
                    .addFields(
                        { name: 'Your Note', value: `*"${message}"*` },
                        { name: 'Originally set at', value: `<t:${Math.floor((Date.now() - durationMs) / 1000)}:f>` }
                    )
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] }).catch(() => {
                    // Fallback to active system channel if DM closed
                    console.log(`[REMINDER WARNING] Could not DM user ${user.id} (DMs closed).`);
                });
            }, durationMs);

        } catch (err) {
            console.error('[REMINDER ERROR]', err);
            const _errMsg = { content: '❌ Failed to register reminder task.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
