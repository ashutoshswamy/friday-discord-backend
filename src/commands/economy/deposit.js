const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription("Move active wallet coins into your secure bank vault.")
        .addStringOption(option => 
            option.setName('amount')
                .setDescription('The amount of coins to deposit (or "all")')
                .setRequired(true)),

    /**
     * Executes the deposit command.
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
                amount = profile.coins;
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
                    content: '❌ You do not have any coins in your wallet to deposit!', 
                    ephemeral: true 
                });
            }

            if (profile.coins < amount) {
                return interaction.editReply({ 
                    content: `❌ Insufficient wallet balance! You only possess 🪙 **${profile.coins.toLocaleString()}** coins.`, 
                    ephemeral: true 
                });
            }

            // Perform atomic deposit transaction
            const result = await db.depositCoins(guild.id, user.id, amount);

            const embed = new EmbedBuilder()
                .setTitle('🏦 Bank Vault Deposit')
                .setColor('#00FFCC')
                .setDescription(`Successfully deposited **🪙 ${amount.toLocaleString()}** coins into your vault!`)
                .addFields(
                    { name: '🪙 Wallet Balance', value: `🪙 **${result.coins.toLocaleString()}** coins`, inline: true },
                    { name: '🏦 Vault Balance', value: `🪙 **${result.bank.toLocaleString()}** coins`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[DEPOSIT ERROR]', err);
            const _errMsg = { content: '❌ An error occurred during the transaction. Please verify database schema columns are properly configured.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
