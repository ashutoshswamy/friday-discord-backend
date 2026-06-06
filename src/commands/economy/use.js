const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');

const BUILT_IN_CONSUMABLES = new Set(['pizza', 'energy drink', 'gamer energy drink', 'lootbox', 'prize box']);

async function processItem(guild, user, matchedItem, shopItems) {
    const embed = new EmbedBuilder().setTimestamp();
    const normalizedName = matchedItem.toLowerCase();

    if (normalizedName === 'pizza') {
        await db.addXp(guild.id, user.id, 150);
        embed.setTitle('🍕 Delicious Pizza!')
            .setColor('#00FFCC')
            .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
            .setDescription('You ate the **Pizza**! It was absolutely delicious!\nYou gained **🏆 150 XP** instantly towards your rank.');
        return { embed };
    }

    if (normalizedName === 'energy drink' || normalizedName === 'gamer energy drink') {
        await db.updateCoins(guild.id, user.id, 300);
        embed.setTitle('⚡ Energy Boost!')
            .setColor('#00FFCC')
            .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
            .setDescription(`You gulped down the **${matchedItem}** and felt a surge of productivity!\nYou earned **🪙 300 coins** directly in your wallet.`);
        return { embed };
    }

    if (normalizedName === 'lootbox' || normalizedName === 'prize box') {
        const roll = Math.random();
        let prizeTitle, prizeDesc;

        if (roll < 0.10) {
            await db.updateCoins(guild.id, user.id, 2500);
            prizeTitle = '💎 JACKPOT WINNER!';
            prizeDesc = `🎉 You hit the **SUPER JACKPOT**!\nYou won a massive **🪙 2,500 coins** directly in your wallet!`;
        } else if (roll < 0.30) {
            await db.addItemToInventory(guild.id, user.id, 'Silver Ring');
            prizeTitle = '💍 Rare Item!';
            prizeDesc = `You extracted a rare collectible:\n🎁 **Silver Ring** added to your \`/inventory\`!`;
        } else if (roll < 0.60) {
            const xpGain = Math.floor(Math.random() * 201) + 100;
            await db.addXp(guild.id, user.id, xpGain);
            prizeTitle = '🏆 Leveling Spark!';
            prizeDesc = `The Lootbox erupted with leveling energy!\nYou gained **🏆 ${xpGain.toLocaleString()} XP** towards your rank!`;
        } else {
            const coinGain = Math.floor(Math.random() * 401) + 200;
            await db.updateCoins(guild.id, user.id, coinGain);
            prizeTitle = '🪙 Coin Cache!';
            prizeDesc = `The chest opened to reveal spare coins!\nYou pocketed **🪙 ${coinGain.toLocaleString()} coins** in your wallet.`;
        }

        embed.setTitle(`🎁 Lootbox: ${prizeTitle}`)
            .setColor('#FF00AA')
            .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
            .setDescription(prizeDesc);
        return { embed };
    }

    // Custom consumables
    const customConsumable = shopItems.find(i => i.name.toLowerCase() === normalizedName);
    if (customConsumable?.actionType) {
        const actionType = customConsumable.actionType.toUpperCase();
        const actionValue = Number(customConsumable.actionValue || 0);

        if (actionType === 'XP') {
            await db.addXp(guild.id, user.id, actionValue);
            embed.setTitle(`✨ Used ${customConsumable.name}!`)
                .setColor('#00FFCC')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`You consumed **${customConsumable.name}**!\nYou gained **🏆 ${actionValue.toLocaleString()} XP** towards your rank.`);
            return { embed };
        } else if (actionType === 'COINS') {
            await db.updateCoins(guild.id, user.id, actionValue);
            embed.setTitle(`🪙 Used ${customConsumable.name}!`)
                .setColor('#FFD700')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`You consumed **${customConsumable.name}**!\nYou received **🪙 ${actionValue.toLocaleString()} coins** in your wallet.`);
            return { embed };
        } else {
            return { error: `❌ **${matchedItem}** has an unrecognized effect type and cannot be used.`, refund: true };
        }
    }

    return { error: `❌ **${matchedItem}** is not a consumable item. List it on the \`/market\` or keep it as a collectible.`, refund: true };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Activates a consumable item from your inventory.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The exact name of the item to use (leave blank for interactive picker)')
                .setRequired(false)),

    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        const itemNameInput = interaction.options.getString('item')?.trim();

        try {
            const inventory = await db.getInventory(guild.id, user.id);
            const shopItems = await db.getShopItems(guild.id);

            // Determine all usable items in inventory
            const customConsumableNames = shopItems
                .filter(i => i.actionType)
                .map(i => i.name.toLowerCase());

            const usableItems = [...new Set(inventory.filter(name =>
                BUILT_IN_CONSUMABLES.has(name.toLowerCase()) || customConsumableNames.includes(name.toLowerCase())
            ))];

            // Direct use if item name provided
            if (itemNameInput) {
                const matchedItem = inventory.find(i => i.toLowerCase() === itemNameInput.toLowerCase());
                if (!matchedItem) {
                    return interaction.editReply({
                        content: `❌ You do not have **${itemNameInput}** in your inventory. Use \`/inventory\` to check your items.`,
                        ephemeral: true
                    });
                }

                const removed = await db.removeItemFromInventory(guild.id, user.id, matchedItem);
                if (!removed) {
                    return interaction.editReply({ content: `❌ Failed to activate **${matchedItem}**. Try again.`, ephemeral: true });
                }

                const result = await processItem(guild, user, matchedItem, shopItems);
                if (result.error) {
                    if (result.refund) await db.addItemToInventory(guild.id, user.id, matchedItem);
                    return interaction.editReply({ content: result.error, ephemeral: true });
                }

                return interaction.editReply({ embeds: [result.embed] });
            }

            // Interactive picker — show consumable select menu
            if (usableItems.length === 0) {
                return interaction.editReply({
                    content: '❌ You have no consumable items in your inventory. Visit `/shop view` to buy consumables like Pizza, Energy Drink, or Lootboxes.',
                    ephemeral: true
                });
            }

            const itemCounts = {};
            inventory.forEach(name => { itemCounts[name] = (itemCounts[name] || 0) + 1; });

            const selectOptions = usableItems.slice(0, 25).map(name => ({
                label: `${name}${itemCounts[name] > 1 ? ` ×${itemCounts[name]}` : ''}`,
                description: BUILT_IN_CONSUMABLES.has(name.toLowerCase())
                    ? 'Built-in consumable'
                    : (shopItems.find(i => i.name.toLowerCase() === name.toLowerCase())?.description || 'Custom consumable'),
                value: name
            }));

            const select = new StringSelectMenuBuilder()
                .setCustomId('use_item_select')
                .setPlaceholder('⚡ Choose a consumable to use...')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(select);

            const promptEmbed = new EmbedBuilder()
                .setTitle('⚡ Use a Consumable Item')
                .setColor('#00FFCC')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`You have **${usableItems.length}** consumable item(s) available.\nSelect one from the menu below to activate it.`)
                .setFooter({ text: 'Select within 30 seconds' });

            const response = await interaction.editReply({ embeds: [promptEmbed], components: [row] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                const chosenItem = i.values[0];
                const matchedItem = inventory.find(n => n === chosenItem);

                if (!matchedItem) {
                    return i.followUp({ content: `❌ Could not find **${chosenItem}** in your inventory.`, ephemeral: true });
                }

                const removed = await db.removeItemFromInventory(guild.id, user.id, matchedItem);
                if (!removed) {
                    return i.followUp({ content: `❌ Failed to activate **${matchedItem}**. Try again.`, ephemeral: true });
                }

                const result = await processItem(guild, user, matchedItem, shopItems);
                if (result.error) {
                    if (result.refund) await db.addItemToInventory(guild.id, user.id, matchedItem);
                    return i.followUp({ content: result.error, ephemeral: true });
                }

                await i.editReply({ embeds: [result.embed], components: [] });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    const disabledSelect = new StringSelectMenuBuilder()
                        .setCustomId('use_item_select')
                        .setPlaceholder('⚡ Session expired')
                        .setDisabled(true)
                        .addOptions({ label: 'Expired', value: 'expired' });
                    await interaction.editReply({ components: [new ActionRowBuilder().addComponents(disabledSelect)] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[USE ERROR]', err);
            const errMsg = { content: '❌ Failed to activate the consumable item.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
