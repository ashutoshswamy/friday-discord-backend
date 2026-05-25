const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

// Master Sell Catalog for grinding loot
const SELL_CATALOG = {
    // Fish
    'common bass': 150,
    'salmon': 300,
    'goldfish': 500,
    'tropical coral fish': 800,
    'mythical whale': 5000,
    'junk seaweed': 20,
    'old boot': 50,

    // Hunted Animals
    'rabbit': 180,
    'duck': 250,
    'deer': 500,
    'wild boar': 800,
    'grizzly bear': 2500,

    // Dug Fossils & Treasures
    'common worm': 15,
    'dirt fossil': 200,
    'ancient vase': 800,
    'buried gold chest': 3000,

    // Prizes & Extras
    'silver ring': 1000
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sells acquired grinding loot back to the server for quick cash.')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The exact name of the item to sell')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The quantity to sell (defaults to 1)')
                .setMinValue(1)
                .setRequired(false)),

    /**
     * Executes the sell command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        const itemNameInput = interaction.options.getString('item').trim();
        const sellAmount = interaction.options.getInteger('amount') || 1;

        const normalizedName = itemNameInput.toLowerCase();
        const baseValue = SELL_CATALOG[normalizedName];

        if (baseValue === undefined) {
            return interaction.editReply({
                content: `❌ The merchant shop does not buy **${itemNameInput}**! You can only sell grinding loot (fish, animals, fossils, treasures) or list collectibles on the \`/market\`.`,
                ephemeral: true
            });
        }

        try {
            // Retrieve user inventory
            const inventory = await db.getInventory(guild.id, user.id);
            
            // Find all matching items (case-insensitive)
            const matchedItems = inventory.filter(i => i.toLowerCase() === normalizedName);

            if (matchedItems.length < sellAmount) {
                return interaction.editReply({
                    content: `❌ Insufficient inventory quantity! You only possess **${matchedItems.length}** copies of **${itemNameInput}** but tried to sell **${sellAmount}**.`,
                    ephemeral: true
                });
            }

            // Remove items row-by-row
            let removedCount = 0;
            const originalItemName = matchedItems[0]; // Keep original capitalizations

            for (let i = 0; i < sellAmount; i++) {
                const removed = await db.removeItemFromInventory(guild.id, user.id, originalItemName);
                if (removed) {
                    removedCount++;
                }
            }

            if (removedCount === 0) {
                return interaction.editReply({
                    content: `❌ Failed to execute transaction. Try again.`,
                    ephemeral: true
                });
            }

            const totalPayout = removedCount * baseValue;
            const newWallet = await db.updateCoins(guild.id, user.id, totalPayout);

            const embed = new EmbedBuilder()
                .setTitle('🛒 Merchant Trade Confirmed')
                .setColor('#00FFCC')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(
                    `You successfully traded **${removedCount}x ${originalItemName}** back to the local merchant!\n` +
                    `You earned **🪙 ${totalPayout.toLocaleString()} coins** directly in your active wallet.`
                )
                .addFields(
                    { name: 'Unit Price', value: `🪙 **${baseValue.toLocaleString()}** coins`, inline: true },
                    { name: 'Total Loot Sold', value: `📦 **${removedCount}x**`, inline: true },
                    { name: 'New Wallet Balance', value: `🪙 **${newWallet.toLocaleString()}** coins` }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[SELL ERROR]', err);
            const _errMsg = { content: '❌ An error occurred during the merchant sale transaction.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
