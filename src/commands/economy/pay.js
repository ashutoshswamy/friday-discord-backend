const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Securely transfers server coins from your wallet to another server member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to pay')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The amount of coins to transfer')
                .setMinValue(1)
                .setRequired(true)),

    /**
     * Executes the pay command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const { guild, user } = interaction;

        if (!guild) return;

        // Validation: Prevent self transfers
        if (targetUser.id === user.id) {
            return interaction.editReply({ content: '❌ You cannot transfer coins to yourself!', ephemeral: true });
        }

        // Validation: Prevent bot transfers
        if (targetUser.bot) {
            return interaction.editReply({ content: '❌ Bot accounts do not participate in currency systems.', ephemeral: true });
        }

        try {
            // Execute atomic transfer in Supabase
            const transfer = await db.transferCoins(guild.id, user.id, targetUser.id, amount);

            if (!transfer.success) {
                return interaction.editReply({ 
                    content: `❌ Transaction declined: ${transfer.reason || 'Insufficient funds.'}`, 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('💸 Secure Coin Transfer')
                .setColor('#00E6FF')
                .setDescription(`Successfully sent **${amount.toLocaleString()}** coins to ${targetUser}!`)
                .addFields(
                    { name: 'Sender', value: `${user}`, inline: true },
                    { name: 'Recipient', value: `${targetUser}`, inline: true },
                    { name: 'Amount Transferred', value: `🪙 **${amount.toLocaleString()}**`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Pay command failed:', err);
            const _errMsg = { content: '❌ Failed to process the coin transaction due to a database exception.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
