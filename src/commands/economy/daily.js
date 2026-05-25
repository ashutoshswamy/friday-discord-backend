const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claims your daily reward of 200 server coins.'),

    /**
     * Executes the daily command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;

        if (!guild) return;

        try {
            const result = await db.claimDaily(guild.id, user.id);

            if (!result.success) {
                const nextClaimTimeUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
                return interaction.editReply({
                    content: `⏳ You have already claimed your daily coins! You can claim again **<t:${nextClaimTimeUnix}:R>** (at <t:${nextClaimTimeUnix}:t>).`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🪙 Daily Allowance Claimed!')
                .setColor('#FFD700')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Successfully claimed your daily allowance reward.`)
                .addFields(
                    { name: 'Reward Added', value: `🪙 **+${result.reward}** coins`, inline: true },
                    { name: 'New Wallet Balance', value: `🪙 **${result.newBalance.toLocaleString()}** coins`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Daily command failed:', err);
            const _errMsg = { content: '❌ Failed to claim daily allowance reward. Please check database connectivity.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
