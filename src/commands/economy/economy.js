const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Spawn or remove server coins manually for a member (Administrator only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add/Spawn Coins', value: 'add' },
                    { name: 'Remove/Deduct Coins', value: 'remove' }
                ))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to adjust coins balance for')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The amount of coins')
                .setMinValue(1)
                .setRequired(true)),

    /**
     * Executes the economy admin command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const { guild } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not maintain coin wallets.', ephemeral: true });
        }

        try {
            // Apply addition or deduction (represented as a negative offset)
            const amountChange = action === 'add' ? amount : -amount;
            const newBalance = await db.updateCoins(guild.id, targetUser.id, amountChange);

            const embed = new EmbedBuilder()
                .setTitle('🪙 Currency Balance Manually Adjusted')
                .setColor('#FFD700')
                .setDescription(`Successfully ${action === 'add' ? 'spawned' : 'deducted'} **${amount.toLocaleString()} coins** ${action === 'add' ? 'into' : 'from'} the wallet of ${targetUser}.`)
                .addFields({
                    name: 'New Balance',
                    value: `🪙 **${newBalance.toLocaleString()}** coins`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Admin economy command failed:', err);
            const _errMsg = { content: '❌ Failed to adjust coins balance. Verify database connectivity.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
