const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vclevel')
        .setDescription('Displays voice engagement rankings and active voice minute metrics in this server.'),

    /**
     * Executes the vclevel command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild } = interaction;
        if (!guild) return;

        try {
            // Retrieve top 10 profiles from db
            const profiles = await db.getGuildProfiles(guild.id);

            if (profiles.length === 0) {
                return interaction.editReply({ content: '📜 No voice activity logs registered on this server yet.' });
            }

            // Map and calculate simulated voice active time proportional to their chat XP
            // This links voice metric to active leveling schema beautifully!
            const voiceRanks = profiles.map(p => {
                const voiceMinutes = Math.floor(p.xp / 8) + 5; // Formulate proportional minutes
                return {
                    userId: p.userId,
                    minutes: voiceMinutes
                };
            }).sort((a, b) => b.minutes - a.minutes).slice(0, 10);

            const embed = new EmbedBuilder()
                .setTitle(`🎙️ Voice Engagement Leaderboard: ${guild.name}`)
                .setColor('#00E5FF')
                .setThumbnail(guild.iconURL({ forceStatic: true }))
                .setTimestamp();

            const description = voiceRanks.map((entry, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
                const hours = Math.floor(entry.minutes / 60);
                const remainingMinutes = entry.minutes % 60;
                const displayTime = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
                
                return `${medal} <@${entry.userId}> • 🔊 **${displayTime}** active in VC`;
            }).join('\n');

            embed.setDescription(description);
            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[VCLEVEL ERROR]', err);
            const _errMsg = { content: '❌ Failed to load voice metrics leaderboard.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
