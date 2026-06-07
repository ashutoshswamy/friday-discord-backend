const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const SELLABLE_ITEMS = {
    'rabbit': 80, 'duck': 150, 'deer': 400, 'wild boar': 800, 'grizzly bear': 2000,
    'common bass': 60, 'salmon': 180, 'goldfish': 350, 'tropical coral fish': 900, 'mythical whale': 5000,
    'junk seaweed': 5, 'old boot': 10, 'common worm': 15,
    'dirt fossil': 200, 'ancient vase': 600, 'buried gold chest': 1500,
    'silver ring': 250, 'lootbox': 300
};

function buildInventoryContainer(targetUser, itemCounts, items, extraText, sellBtn, useBtn, sellableOwned) {
    const listText = Object.keys(itemCounts).length > 0
        ? Object.entries(itemCounts).map(([name, count]) => `• **${name}**${count > 1 ? ` ×${count}` : ''}`).join('\n')
        : '*Inventory is now empty*';

    const container = new ContainerBuilder()
        .setAccentColor(0xFF8C00)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## 🎒 Inventory: ${targetUser.username}\n${items.length} item(s) total`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(listText));

    if (extraText) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(extraText));
    }

    if (sellBtn && useBtn) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(sellBtn, useBtn));
    }

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription("Displays a member's purchased virtual items inventory.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check inventory for (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { guild, user } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not maintain item inventories.', ephemeral: true });
        }

        try {
            const items = await db.getInventory(guild.id, targetUser.id);

            if (items.length === 0) {
                return interaction.editReply({
                    content: `🎒 **${targetUser.username}** has an empty inventory. Purchase items using \`/buy\` or go \`/hunt\`, \`/fish\`, or \`/dig\`!`,
                    ephemeral: false
                });
            }

            const itemCounts = {};
            items.forEach(name => { itemCounts[name] = (itemCounts[name] || 0) + 1; });

            const isSelf = targetUser.id === user.id;
            if (!isSelf) {
                const container = buildInventoryContainer(targetUser, itemCounts, items, null, null, null, []);
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            const uniqueItems = Object.keys(itemCounts);
            const sellableOwned = uniqueItems.filter(n => SELLABLE_ITEMS[n.toLowerCase()] !== undefined);

            const sellBtn = new ButtonBuilder()
                .setCustomId('inv_sell_all_junk')
                .setLabel('💰 Sell All Junk')
                .setStyle(ButtonStyle.Success);

            const useBtn = new ButtonBuilder()
                .setCustomId('inv_use_item')
                .setLabel('⚡ Use an Item')
                .setStyle(ButtonStyle.Primary);

            const container = buildInventoryContainer(user, itemCounts, items, null, sellBtn, useBtn, sellableOwned);

            if (sellableOwned.length > 0) {
                const sellOptions = sellableOwned.slice(0, 25).map(name => ({
                    label: `${name} (×${itemCounts[name]})`,
                    description: `Sells for <:coin:1512926963239489606> ${SELLABLE_ITEMS[name.toLowerCase()]} each`,
                    value: `sell_${name}`
                }));

                const sellSelect = new StringSelectMenuBuilder()
                    .setCustomId('inv_sell_select')
                    .setPlaceholder('🗑️ Sell a specific item...')
                    .addOptions(sellOptions);

                container.addActionRowComponents(new ActionRowBuilder().addComponents(sellSelect));
            }

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === 'inv_sell_all_junk') {
                    await i.deferUpdate();

                    const junkItems = ['Common Worm', 'Junk Seaweed', 'Old Boot'];
                    let totalEarned = 0;
                    let soldCount = 0;

                    for (const junk of junkItems) {
                        const currentItems = await db.getInventory(guild.id, user.id);
                        const owned = currentItems.filter(n => n === junk).length;
                        if (owned > 0) {
                            const price = SELLABLE_ITEMS[junk.toLowerCase()] || 0;
                            for (let k = 0; k < owned; k++) {
                                await db.removeItemFromInventory(guild.id, user.id, junk);
                            }
                            totalEarned += price * owned;
                            soldCount += owned;
                        }
                    }

                    if (soldCount === 0) {
                        return i.followUp({ content: '❌ You have no junk items to sell (Common Worm, Junk Seaweed, Old Boot).', ephemeral: true });
                    }

                    await db.updateCoins(guild.id, user.id, totalEarned);

                    const refreshedItems = await db.getInventory(guild.id, user.id);
                    const refreshedCounts = {};
                    refreshedItems.forEach(name => { refreshedCounts[name] = (refreshedCounts[name] || 0) + 1; });

                    const extraText = `💰 **Junk Sold:** ${soldCount} item(s) for <:coin:1512926963239489606> **+${totalEarned.toLocaleString()}** coins!`;
                    const refreshedSellable = Object.keys(refreshedCounts).filter(n => SELLABLE_ITEMS[n.toLowerCase()] !== undefined);

                    const newSellBtn = new ButtonBuilder()
                        .setCustomId('inv_sell_all_junk')
                        .setLabel('💰 Sell All Junk')
                        .setStyle(ButtonStyle.Success);
                    const newUseBtn = new ButtonBuilder()
                        .setCustomId('inv_use_item')
                        .setLabel('⚡ Use an Item')
                        .setStyle(ButtonStyle.Primary);

                    const refreshedContainer = buildInventoryContainer(user, refreshedCounts, refreshedItems, extraText, newSellBtn, newUseBtn, refreshedSellable);

                    if (refreshedSellable.length > 0) {
                        const newSellOptions = refreshedSellable.slice(0, 25).map(name => ({
                            label: `${name} (×${refreshedCounts[name]})`,
                            description: `Sells for <:coin:1512926963239489606> ${SELLABLE_ITEMS[name.toLowerCase()]} each`,
                            value: `sell_${name}`
                        }));
                        const newSellSelect = new StringSelectMenuBuilder()
                            .setCustomId('inv_sell_select')
                            .setPlaceholder('🗑️ Sell a specific item...')
                            .addOptions(newSellOptions);
                        refreshedContainer.addActionRowComponents(new ActionRowBuilder().addComponents(newSellSelect));
                    }

                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [refreshedContainer] });

                } else if (i.customId === 'inv_use_item') {
                    await i.reply({ content: '⚡ Use `/use [item]` to consume items from your inventory!', ephemeral: true });

                } else if (i.customId === 'inv_sell_select') {
                    await i.deferUpdate();

                    const itemName = i.values[0].replace('sell_', '');
                    const price = SELLABLE_ITEMS[itemName.toLowerCase()];

                    if (!price) {
                        return i.followUp({ content: `❌ **${itemName}** cannot be sold.`, ephemeral: true });
                    }

                    const currentItems = await db.getInventory(guild.id, user.id);
                    const owned = currentItems.filter(n => n === itemName).length;

                    if (owned === 0) {
                        return i.followUp({ content: `❌ You don't have **${itemName}** in your inventory.`, ephemeral: true });
                    }

                    await db.removeItemFromInventory(guild.id, user.id, itemName);
                    await db.updateCoins(guild.id, user.id, price);

                    const refreshedItems = await db.getInventory(guild.id, user.id);
                    const refreshedCounts = {};
                    refreshedItems.forEach(name => { refreshedCounts[name] = (refreshedCounts[name] || 0) + 1; });

                    const extraText = `💰 **Item Sold:** 1× **${itemName}** for <:coin:1512926963239489606> **+${price.toLocaleString()}** coins!`;
                    const refreshedSellable = Object.keys(refreshedCounts).filter(n => SELLABLE_ITEMS[n.toLowerCase()] !== undefined);

                    const newSellBtn = new ButtonBuilder()
                        .setCustomId('inv_sell_all_junk')
                        .setLabel('💰 Sell All Junk')
                        .setStyle(ButtonStyle.Success);
                    const newUseBtn = new ButtonBuilder()
                        .setCustomId('inv_use_item')
                        .setLabel('⚡ Use an Item')
                        .setStyle(ButtonStyle.Primary);

                    const refreshedContainer = buildInventoryContainer(user, refreshedCounts, refreshedItems, extraText, newSellBtn, newUseBtn, refreshedSellable);

                    if (refreshedSellable.length > 0) {
                        const newSellOptions = refreshedSellable.slice(0, 25).map(name => ({
                            label: `${name} (×${refreshedCounts[name]})`,
                            description: `Sells for <:coin:1512926963239489606> ${SELLABLE_ITEMS[name.toLowerCase()]} each`,
                            value: `sell_${name}`
                        }));
                        const newSellSelect = new StringSelectMenuBuilder()
                            .setCustomId('inv_sell_select')
                            .setPlaceholder('🗑️ Sell a specific item...')
                            .addOptions(newSellOptions);
                        refreshedContainer.addActionRowComponents(new ActionRowBuilder().addComponents(newSellSelect));
                    }

                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [refreshedContainer] });
                }
            });

            collector.on('end', async () => {
                const disabledSellBtn = new ButtonBuilder()
                    .setCustomId('inv_sell_all_junk')
                    .setLabel('💰 Sell All Junk')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true);
                const disabledUseBtn = new ButtonBuilder()
                    .setCustomId('inv_use_item')
                    .setLabel('⚡ Use an Item')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                const currentItems = await db.getInventory(guild.id, user.id).catch(() => items);
                const currentCounts = {};
                currentItems.forEach(name => { currentCounts[name] = (currentCounts[name] || 0) + 1; });

                const expiredContainer = buildInventoryContainer(user, currentCounts, currentItems, null, disabledSellBtn, disabledUseBtn, []);

                if (sellableOwned.length > 0) {
                    const disabledSelect = new StringSelectMenuBuilder()
                        .setCustomId('inv_sell_select')
                        .setPlaceholder('🗑️ Session expired')
                        .setDisabled(true)
                        .addOptions({ label: 'Expired', value: 'expired' });
                    expiredContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledSelect));
                }

                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
            });

        } catch (err) {
            console.error('[ERROR] Inventory command failed:', err);
            const errMsg = { content: '❌ Failed to load inventory records from database.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
