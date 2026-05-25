const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Interact with the player-driven server item market.')
        
        // Subcommand: view
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View active item listings posted by other players.'))
        
        // Subcommand: list
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Post an item from your inventory up for sale on the global market.')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('The exact name of the item from your inventory')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('price')
                        .setDescription('The custom price in coins to sell the item for')
                        .setMinValue(1)
                        .setRequired(true)))
        
        // Subcommand: buy
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Purchase an item listing from the market.')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('The ID of the market listing to buy')
                        .setRequired(true)))
        
        // Subcommand: cancel
        .addSubcommand(sub =>
            sub.setName('cancel')
                .setDescription('Cancel an active listing you posted and reclaim the item.')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('The ID of your market listing to cancel')
                        .setRequired(true))),

    /**
     * Executes the market command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();

        try {
            const embed = new EmbedBuilder().setTimestamp();

            // ------------------------------------------
            // A. Subcommand: view
            // ------------------------------------------
            if (subcommand === 'view') {
                const listings = await db.getMarketListings(guild.id);

                if (listings.length === 0) {
                    return interaction.editReply({
                        content: '📜 The player-driven market is currently empty! Use `/market list` to post your collectibles.',
                        ephemeral: false
                    });
                }

                embed.setTitle(`⚖️ Player-Driven Market - ${guild.name}`)
                    .setColor('#00E5FF')
                    .setDescription(
                        `Welcome to the server bazaar! Buy items from other players or list your own collectibles.\n\n` +
                        `Use \`/market buy [listing_id]\` to purchase items.\n` +
                        `Use \`/market cancel [listing_id]\` to cancel your own listings.`
                    );

                listings.forEach(listing => {
                    embed.addFields({
                        name: `📦 Listing #${listing.id}: **${listing.itemName}**`,
                        value: `• **Price:** 🪙 \`${listing.price.toLocaleString()}\` coins\n• **Seller:** <@${listing.sellerId}>\n• **Posted:** <t:${Math.floor(new Date(listing.createdAt).getTime() / 1000)}:R>`
                    });
                });

                return interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // B. Subcommand: list
            // ------------------------------------------
            else if (subcommand === 'list') {
                const itemName = options.getString('item').trim();
                const price = options.getInteger('price');

                const inventory = await db.getInventory(guild.id, user.id);
                // Find matching item (case-insensitive)
                const matchedItem = inventory.find(i => i.toLowerCase() === itemName.toLowerCase());

                if (!matchedItem) {
                    return interaction.editReply({
                        content: `❌ You do not possess any **${itemName}** in your inventory to list for sale!`,
                        ephemeral: true
                    });
                }

                // List the item (removes from inventory, inserts to market_listings table)
                const success = await db.listMarketItem(guild.id, user.id, matchedItem, price);

                if (!success) {
                    return interaction.editReply({
                        content: '❌ Failed to list item on the market. Please try again.',
                        ephemeral: true
                    });
                }

                embed.setTitle('⚖️ Market Listing Created')
                    .setColor('#00E5FF')
                    .setDescription(
                        `Successfully posted **${matchedItem}** up for sale on the global bazaar!\n` +
                        `Other players can now buy it using its listing ID.`
                    )
                    .addFields(
                        { name: 'Item Listed', value: `📦 **${matchedItem}**`, inline: true },
                        { name: 'Price Set', value: `🪙 **${price.toLocaleString()}** coins`, inline: true },
                        { name: 'Seller', value: `<@${user.id}>` }
                    );

                await interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // C. Subcommand: buy
            // ------------------------------------------
            else if (subcommand === 'buy') {
                const listingId = options.getInteger('id');

                // Process atomic transaction in DB utility
                const result = await db.buyMarketItem(guild.id, user.id, listingId);

                if (!result.success) {
                    return interaction.editReply({
                        content: `❌ Transaction declined: ${result.reason || 'Invalid transaction.'}`,
                        ephemeral: true
                    });
                }

                embed.setTitle('⚖️ Market Purchase Confirmed')
                    .setColor('#00FF66')
                    .setDescription(
                        `Successfully purchased **${result.itemName}** from the server bazaar!\n` +
                        `The item has been added to your inventory, and coins have been transferred.`
                    )
                    .addFields(
                        { name: 'Item Acquired', value: `📦 **${result.itemName}**`, inline: true },
                        { name: 'Price Paid', value: `🪙 **${result.price.toLocaleString()}** coins`, inline: true },
                        { name: 'Seller Compensated', value: `<@${result.sellerId}>` }
                    );

                await interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // D. Subcommand: cancel
            // ------------------------------------------
            else if (subcommand === 'cancel') {
                const listingId = options.getInteger('id');

                // Reclaim the item (deletes listing, restores item to seller inventory)
                const success = await db.cancelMarketListing(guild.id, user.id, listingId);

                if (!success) {
                    return interaction.editReply({
                        content: `❌ Could not cancel listing. Verify listing ID exists and was posted by you.`,
                        ephemeral: true
                    });
                }

                embed.setTitle('⚖️ Market Listing Cancelled')
                    .setColor('#9CA3AF')
                    .setDescription(
                        `Successfully removed listing **#${listingId}** from the server bazaar!\n` +
                        `The item has been safely returned to your inventory.`
                    );

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (err) {
            console.error('[MARKET ERROR]', err);
            const _errMsg = { content: '❌ Failed to process market bazaar operations. Please verify database columns.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
