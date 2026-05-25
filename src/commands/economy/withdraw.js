const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription("Retrieve coins from your secure bank vault into your wallet.")
        .addStringOption(option => 
            option.setName('amount')
                .setDescription('The amount of coins to withdraw (or "all")')
                .setRequired(true)),

    /**
     * Executes the withdraw command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        const amountInput = interaction.options.getString('amount').trim().toLowerCase();

        try {
            const profile = await db.getProfile(guild.id, user.id);
            if (!profile) {
                return interaction.editReply({ content: '❌ Failed to load level profile.', ephemeral: true });
            }

            let amount;
            if (amountInput === 'all') {
                amount = profile.bank || 0;
            } else {
                amount = parseInt(amountInput);
                if (isNaN(amount) || amount <= 0) {
                    return interaction.editReply({ 
                        content: '❌ Please specify a valid positive amount of coins or "all".', 
                        ephemeral: true 
                    });
                }
            }

            if (amount === 0) {
                return interaction.editReply({ 
                    content: '❌ You do not have any coins in your bank vault to withdraw!', 
                    ephemeral: true 
                });
            }

            if ((profile.bank || 0) < amount) {
                return interaction.editReply({ 
                    content: `❌ Insufficient vault balance! You only possess 🪙 **${(profile.bank || 0).toLocaleString()}** coins in your bank.`, 
                    ephemeral: true 
                });
            }

            // Perform atomic withdraw transaction
            const result = await db.withdrawCoins(guild.id, user.id, amount);

            const embed = new EmbedBuilder()
                .setTitle('🏦 Bank Vault Withdrawal')
                .setColor('#F5A623')
                .setDescription(`Successfully withdrew **🪙 ${amount.toLocaleString()}** coins from your vault!`)
                .addFields(
                    { name: '🪙 Wallet Balance', value: `🪙 **${result.coins.toLocaleString()}** coins`, inline: true },
                    { name: '🏦 Vault Balance', value: `🪙 **${result.bank.toLocaleString()}** coins`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[WITHDRAW ERROR]', err);
            const _errMsg = { content: '❌ An error occurred during the transaction. Please verify database schema columns are properly configured.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
