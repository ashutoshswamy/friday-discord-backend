const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Activates a consumable item from your inventory.')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The exact name of the item to use')
                .setRequired(true)),

    /**
     * Executes the use command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        const itemNameInput = interaction.options.getString('item').trim();

        try {
            // Retrieve inventory
            const inventory = await db.getInventory(guild.id, user.id);
            
            // Find item (case-insensitive)
            const matchedItem = inventory.find(i => i.toLowerCase() === itemNameInput.toLowerCase());

            if (!matchedItem) {
                return interaction.editReply({ 
                    content: `❌ You do not possess any **${itemNameInput}** in your inventory! Use \`/inventory\` to view your items.`, 
                    ephemeral: true 
                });
            }

            // Remove 1 copy of the item first to prevent race-condition exploits
            const removed = await db.removeItemFromInventory(guild.id, user.id, matchedItem);
            if (!removed) {
                return interaction.editReply({ 
                    content: `❌ An error occurred while activating **${matchedItem}**. Please try again.`, 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder().setTimestamp();
            const normalizedName = matchedItem.toLowerCase();

            // A. Pizza: XP Boost
            if (normalizedName === 'pizza') {
                const xpReward = 150;
                await db.addXp(guild.id, user.id, xpReward);

                embed.setTitle('🍕 Delicious Pizza!')
                    .setColor('#00FFCC')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .setDescription(
                        `You ate the **Pizza**! It was absolutely delicious!\n` +
                        `You gained **🏆 ${xpReward} XP** instantly towards your leveling rank.`
                    );
            }

            // B. Energy Drink: Coin Boost
            else if (normalizedName === 'energy drink' || normalizedName === 'gamer energy drink') {
                const coinReward = 300;
                await db.updateCoins(guild.id, user.id, coinReward);

                embed.setTitle('⚡ Energy Boost!')
                    .setColor('#00FFCC')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .setDescription(
                        `You gulped down the **${matchedItem}** and felt a massive surge of productivity!\n` +
                        `You earned **🪙 ${coinReward} coins** directly in your wallet.`
                    );
            }

            // C. Lootbox: Spinner Chest!
            else if (normalizedName === 'lootbox' || normalizedName === 'prize box') {
                const roll = Math.random();
                let prizeTitle = '';
                let prizeDesc = '';

                // 10% chance: Jackpot (2500 coins)
                if (roll < 0.10) {
                    const jackpot = 2500;
                    await db.updateCoins(guild.id, user.id, jackpot);
                    prizeTitle = '💎 JACKPOT WINNER!';
                    prizeDesc = `🎉 OMG! You opened the Lootbox and hit the **SUPER JACKPOT**!\n\n` +
                                `You won a massive reward of **🪙 ${jackpot.toLocaleString()} coins** directly added to your wallet!`;
                }
                // 20% chance: Rare Item (Silver Ring)
                else if (roll < 0.30) {
                    const collectable = 'Silver Ring';
                    await db.addItemToInventory(guild.id, user.id, collectable);
                    prizeTitle = '💍 Rare Item Extracted!';
                    prizeDesc = `You spun the prize wheel and extracted a rare collectable:\n\n` +
                                `🎁 **${collectable}** has been added to your \`/inventory\`!`;
                }
                // 30% chance: XP reward (100 - 300 XP)
                else if (roll < 0.60) {
                    const xpGain = Math.floor(Math.random() * 201) + 100; // 100 to 300 XP
                    await db.addXp(guild.id, user.id, xpGain);
                    prizeTitle = '🏆 Leveling Spark!';
                    prizeDesc = `The Lootbox erupted with sparkling leveling energy!\n\n` +
                                `You gained **🏆 ${xpGain} XP** towards your server rank!`;
                }
                // 40% chance: Coin reward (200 - 600 coins)
                else {
                    const coinGain = Math.floor(Math.random() * 401) + 200; // 200 to 600 coins
                    await db.updateCoins(guild.id, user.id, coinGain);
                    prizeTitle = '🪙 Coin Cache Open!';
                    prizeDesc = `The Lootbox chest opened to reveal a cache of spare coins!\n\n` +
                                `You pocketed **🪙 ${coinGain} coins** in your active wallet.`;
                }

                embed.setTitle(`🎁 Lootbox: ${prizeTitle}`)
                    .setColor('#FF00AA')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .setDescription(prizeDesc);
            }

            // D. Custom Consumables: actionType and actionValue set by admin
            else {
                const shopItems = await db.getShopItems(guild.id);
                const customConsumable = shopItems.find(i => i.name.toLowerCase() === normalizedName);

                if (customConsumable && customConsumable.actionType) {
                    const actionType = customConsumable.actionType.toUpperCase();
                    const actionValue = Number(customConsumable.actionValue || 0);

                    if (actionType === 'XP') {
                        await db.addXp(guild.id, user.id, actionValue);
                        embed.setTitle(`✨ Used ${customConsumable.name}!`)
                            .setColor('#00FFCC')
                            .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                            .setDescription(
                                `You consumed **${customConsumable.name}**!\n` +
                                `You gained **🏆 ${actionValue} XP** instantly towards your leveling rank.`
                            );
                    } else if (actionType === 'COINS') {
                        await db.updateCoins(guild.id, user.id, actionValue);
                        embed.setTitle(`🪙 Used ${customConsumable.name}!`)
                            .setColor('#FFD700')
                            .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                            .setDescription(
                                `You consumed **${customConsumable.name}**!\n` +
                                `You received **🪙 ${actionValue.toLocaleString()} coins** directly in your wallet.`
                            );
                    } else {
                        // Action type configured but not supported? Give it back
                        await db.addItemToInventory(guild.id, user.id, matchedItem);
                        return interaction.editReply({
                            content: `❌ **${matchedItem}** has an unrecognized effect type (\`${customConsumable.actionType}\`) and cannot be used.`,
                            ephemeral: true
                        });
                    }
                } else {
                    // If it's not a usable item, give it back to their inventory and show warning
                    await db.addItemToInventory(guild.id, user.id, matchedItem);
                    return interaction.editReply({
                        content: `❌ **${matchedItem}** is not a consumable item and cannot be used! You can list it on the \`/market\` or keep it as a collectible.`,
                        ephemeral: true
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[USE ERROR]', err);
            const _errMsg = { content: '❌ Failed to activate the consumable item. Please try again.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
