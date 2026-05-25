const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Checks a member's wallet balance of server coins.")
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check balance for (defaults to yourself)')
                .setRequired(false)),

    /**
     * Executes the balance command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { guild } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not hold virtual currencies.', ephemeral: true });
        }

        try {
            // Load user profile coins balance from user_profiles in Supabase
            const profile = await db.getProfile(guild.id, targetUser.id);

            if (!profile) {
                return interaction.editReply({ content: '❌ Failed to retrieve coin balance.', ephemeral: true });
            }

            // Retrieve stock portfolio values
            const stocksData = await db.getUserStocksTotalValue(guild.id, targetUser.id).catch(() => ({ totalValue: 0 }));
            const intradayData = await db.getUserIntradayTotalValue(guild.id, targetUser.id).catch(() => ({ totalValue: 0 }));
            const stocksVal = stocksData.totalValue || 0;
            const intradayVal = intradayData.totalValue || 0;
            const totalStockAssets = Math.round(stocksVal + intradayVal);
            
            const netWorth = profile.coins + (profile.bank || 0) + totalStockAssets;

            const embed = new EmbedBuilder()
                .setTitle(`👛 Finance Balance: ${targetUser.username}`)
                .setColor('#00FFCC')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Current financial breakdown in **${guild.name}**:`)
                .addFields(
                    { name: '🪙 Active Wallet', value: `🪙 **${profile.coins.toLocaleString()}** coins`, inline: true },
                    { name: '🏦 Bank Vault', value: `🪙 **${(profile.bank || 0).toLocaleString()}** coins`, inline: true },
                    { name: '📈 Stock Portfolio', value: `🪙 **${totalStockAssets.toLocaleString()}** coins`, inline: true },
                    { name: '📊 Net Worth', value: `🪙 **${netWorth.toLocaleString()}** coins` }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Balance command failed:', err);
            const _errMsg = { content: '❌ Failed to retrieve balance records from database.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
