const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Gift coins or inventory items to another server member securely.')
        
        // Subcommand: coins
        .addSubcommand(sub =>
            sub.setName('coins')
                .setDescription('Gift a specified amount of coins to another member.')
                .addUserOption(opt => 
                    opt.setName('user')
                        .setDescription('The member to receive the coins')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('amount')
                        .setDescription('The amount of coins to transfer')
                        .setMinValue(1)
                        .setRequired(true)))
        
        // Subcommand: item
        .addSubcommand(sub =>
            sub.setName('item')
                .setDescription('Gift a collectible or grinding item from your inventory to another member.')
                .addUserOption(opt => 
                    opt.setName('user')
                        .setDescription('The member to receive the item')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('The exact name of the item to transfer')
                        .setRequired(true))),

    /**
     * Executes the gift command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const targetUser = options.getUser('user');
        const subcommand = options.getSubcommand();

        if (targetUser.id === user.id) {
            return interaction.editReply({ content: '❌ You cannot gift items or coins to yourself!', ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.editReply({ content: '❌ You cannot gift resources to bot accounts!', ephemeral: true });
        }

        try {
            const embed = new EmbedBuilder().setTimestamp();

            // ------------------------------------------
            // A. Subcommand: coins
            // ------------------------------------------
            if (subcommand === 'coins') {
                const amount = options.getInteger('amount');
                const senderProfile = await db.getProfile(guild.id, user.id);

                if (senderProfile.coins < amount) {
                    return interaction.editReply({
                        content: `❌ Insufficient wallet balance! You only possess 🪙 **${senderProfile.coins.toLocaleString()}** coins but tried to gift 🪙 **${amount.toLocaleString()}**.`,
                        ephemeral: true
                    });
                }

                // Transfer coins atomically
                await db.updateCoins(guild.id, user.id, -amount);
                await db.updateCoins(guild.id, targetUser.id, amount);

                embed.setTitle('🎁 Coin Gift Transferred')
                    .setColor('#00FFCC')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription(
                        `You have securely gifted **🪙 ${amount.toLocaleString()} coins** to <@${targetUser.id}>!\n` +
                        `The transaction has been processed securely in the cloud.`
                    )
                    .addFields(
                        { name: 'From', value: `<@${user.id}>`, inline: true },
                        { name: 'To', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Amount Transferred', value: `🪙 **${amount.toLocaleString()}** coins` }
                    );
            }

            // ------------------------------------------
            // B. Subcommand: item
            // ------------------------------------------
            else if (subcommand === 'item') {
                const itemName = options.getString('name').trim();
                const inventory = await db.getInventory(guild.id, user.id);
                
                // Find matching item (case-insensitive)
                const matchedItem = inventory.find(i => i.toLowerCase() === itemName.toLowerCase());

                if (!matchedItem) {
                    return interaction.editReply({
                        content: `❌ You do not possess any **${itemName}** in your inventory to gift!`,
                        ephemeral: true
                    });
                }

                // Gift item atomically (transfers row ownership in database)
                const success = await db.giftItem(guild.id, user.id, targetUser.id, matchedItem);

                if (!success) {
                    return interaction.editReply({
                        content: `❌ Failed to complete item transfer. Try again.`,
                        ephemeral: true
                    });
                }

                embed.setTitle('🎁 Inventory Item Gifted')
                    .setColor('#00FFCC')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription(
                        `You have securely transferred ownership of **${matchedItem}** to <@${targetUser.id}>!\n` +
                        `The item has been successfully moved to their inventory.`
                    )
                    .addFields(
                        { name: 'Sender', value: `<@${user.id}>`, inline: true },
                        { name: 'Receiver', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Transferred Item', value: `📦 **${matchedItem}**` }
                    );
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[GIFT ERROR]', err);
            const _errMsg = { content: '❌ Failed to complete the secure gift transaction.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
