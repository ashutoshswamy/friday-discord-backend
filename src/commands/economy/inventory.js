const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS, EMOJI_IDS, getEmoji, getEmojiId } = require('../../utils/emojis');

// Align sellable prices with sell.js catalog
const SELLABLE_ITEMS = {
    // ── Fish ──
    'junk seaweed': 20, 'old boot': 50,
    'clam': 100, 'common bass': 150,
    'pufferfish': 350, 'salmon': 300,
    'goldfish': 500, 'lobster': 900,
    'tropical coral fish': 800,
    'shark tooth': 2000,
    'ancient pearl': 6000,
    'mythical whale': 5000,
    // ── Hunt ──
    'rabbit': 180, 'eagle feather': 400,
    'duck': 250, 'deer': 500,
    'deer antler': 600, 'wild boar': 800,
    'wolf pelt': 1200,
    'grizzly bear': 2500,
    'dragon scale': 8000,
    // ── Dig ──
    'common worm': 15, 'old coin': 300,
    'cracked geode': 150, 'dirt fossil': 200,
    'ancient vase': 800,
    'sapphire': 2500, 'ruby': 4000,
    'diamond': 9000,
    'buried gold chest': 3000,
    // ── Collectibles ──
    'silver ring': 1000,
    'common gem': 750,
    'rare gem': 3500,
    'legendary gem': 12000,
    'lootbox': 300
};

const INV_PAGE_SIZE = 10;

function buildInventoryContainer(targetUser, itemCounts, items, extraText, sellBtn, useBtn, sellableOwned, pageOpts = null) {
    const uniqueEntries = Object.entries(itemCounts);
    const totalUniqueItems = uniqueEntries.length;

    let displayEntries = uniqueEntries;
    let pageHeader = '';
    if (pageOpts && pageOpts.totalPages > 1) {
        const { page, totalPages } = pageOpts;
        displayEntries = uniqueEntries.slice(page * INV_PAGE_SIZE, (page + 1) * INV_PAGE_SIZE);
        pageHeader = ` — Page ${page + 1}/${totalPages}`;
    }

    const listText = displayEntries.length > 0
        ? displayEntries.map(([name, count]) => `• ${getEmoji(name)} **${name}**${count > 1 ? ` ×${count}` : ''}`).join('\n')
        : '*Inventory is now empty*';

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Inventory: ${targetUser.username}${pageHeader}\n${items.length} item(s) total`)
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

    if (pageOpts && pageOpts.totalPages > 1) {
        const { page, totalPages, disabled } = pageOpts;
        const prevBtn = new ButtonBuilder()
            .setCustomId('inv_page_prev')
            .setLabel('← Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0 || !!disabled);
        const pageIndBtn = new ButtonBuilder()
            .setCustomId('inv_page_ind')
            .setLabel(`${page + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        const nextBtn = new ButtonBuilder()
            .setCustomId('inv_page_next')
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1 || !!disabled);
        container.addActionRowComponents(new ActionRowBuilder().addComponents(prevBtn, pageIndBtn, nextBtn));
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
            const botErrContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('Bots do not maintain item inventories.')
                );
            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [botErrContainer] });
        }

        try {
            const items = await db.getInventory(guild.id, targetUser.id);

            if (items.length === 0) {
                const emptyContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**${targetUser.username}** has an empty inventory. Purchase items using \`/buy\` or go \`/hunt\`, \`/fish\`, or \`/dig\`!`)
                    );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [emptyContainer] });
            }

            const itemCounts = {};
            items.forEach(name => { itemCounts[name] = (itemCounts[name] || 0) + 1; });

            const isSelf = targetUser.id === user.id;
            if (!isSelf) {
                const container = buildInventoryContainer(targetUser, itemCounts, items, null, null, null, []);
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            let currentPage = 0;

            const buildSelfView = (currentItems, extraText, disabledAll = false) => {
                const counts = {};
                currentItems.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
                const uniqueNames = Object.keys(counts);
                const totalPages = Math.ceil(uniqueNames.length / INV_PAGE_SIZE);

                const sBtn = new ButtonBuilder()
                    .setCustomId('inv_sell_all_junk')
                    .setLabel('Sell All Junk')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(disabledAll);
                const uBtn = new ButtonBuilder()
                    .setCustomId('inv_use_item')
                    .setLabel('Use an Item')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(disabledAll);

                const pageOpts = totalPages > 1 ? { page: currentPage, totalPages, disabled: disabledAll } : null;
                const c = buildInventoryContainer(user, counts, currentItems, extraText, sBtn, uBtn, uniqueNames, pageOpts);

                const sellableNow = uniqueNames.filter(n => SELLABLE_ITEMS[n.toLowerCase()] !== undefined);
                if (sellableNow.length > 0) {
                    const opts = sellableNow.slice(0, 25).map(name => ({
                        label: `${name} (×${counts[name]})`,
                        description: `Sells for ${SELLABLE_ITEMS[name.toLowerCase()]} coins each`,
                        value: `sell_${name}`,
                        emoji: getEmojiId(name) || EMOJI_IDS.coin
                    }));
                    const sel = new StringSelectMenuBuilder()
                        .setCustomId('inv_sell_select')
                        .setPlaceholder(disabledAll ? 'Session expired' : 'Sell a specific item...')
                        .setDisabled(disabledAll)
                        .addOptions(disabledAll ? [{ label: 'Expired', value: 'expired' }] : opts);
                    c.addActionRowComponents(new ActionRowBuilder().addComponents(sel));
                }
                return c;
            };

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildSelfView(items, null)] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === 'inv_page_prev' || i.customId === 'inv_page_next') {
                    await i.deferUpdate();
                    const latestItems = await db.getInventory(guild.id, user.id);
                    const uniqueCount = new Set(latestItems.map(n => n.toLowerCase())).size;
                    const totalPages = Math.ceil(uniqueCount / INV_PAGE_SIZE);
                    if (i.customId === 'inv_page_prev') currentPage = Math.max(0, currentPage - 1);
                    else currentPage = Math.min(Math.max(0, totalPages - 1), currentPage + 1);
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildSelfView(latestItems, null)] });
                } else if (i.customId === 'inv_sell_all_junk') {
                    await i.deferUpdate();

                    const junkItems = ['Common Worm', 'Junk Seaweed', 'Old Boot'];
                    let totalEarned = 0;
                    let soldCount = 0;

                    for (const junk of junkItems) {
                        const currentItems = await db.getInventory(guild.id, user.id);
                        const owned = currentItems.filter(n => n.toLowerCase() === junk.toLowerCase()).length;
                        const originalName = currentItems.find(n => n.toLowerCase() === junk.toLowerCase()) || junk;
                        if (owned > 0) {
                            const price = SELLABLE_ITEMS[junk.toLowerCase()] || 0;
                            for (let k = 0; k < owned; k++) {
                                await db.removeItemFromInventory(guild.id, user.id, originalName);
                            }
                            totalEarned += price * owned;
                            soldCount += owned;
                        }
                    }

                    if (soldCount === 0) {
                        const noJunkContainer = new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('You have no junk items to sell (Common Worm, Junk Seaweed, Old Boot).')
                            );
                        return i.followUp({ flags: MessageFlags.IsComponentsV2, components: [noJunkContainer], ephemeral: true });
                    }

                    await db.updateCoins(guild.id, user.id, totalEarned);

                    const refreshedItems = await db.getInventory(guild.id, user.id);
                    const extraText = `**Junk Sold:** ${soldCount} item(s) for ${EMOJIS.coin} **+${totalEarned.toLocaleString()}** coins!`;
                    currentPage = 0;
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildSelfView(refreshedItems, extraText)] });

                } else if (i.customId === 'inv_use_item') {
                    const useInfoContainer = new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('Use `/use [item]` to consume items from your inventory!')
                        );
                    await i.reply({ flags: MessageFlags.IsComponentsV2, components: [useInfoContainer], ephemeral: true });

                } else if (i.customId === 'inv_sell_select') {
                    await i.deferUpdate();

                    const itemName = i.values[0].replace('sell_', '');
                    const price = SELLABLE_ITEMS[itemName.toLowerCase()];

                    if (!price) {
                        const errContainer = new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**${itemName}** cannot be sold.`)
                            );
                        return i.followUp({ flags: MessageFlags.IsComponentsV2, components: [errContainer], ephemeral: true });
                    }

                    const currentItems = await db.getInventory(guild.id, user.id);
                    const owned = currentItems.filter(n => n.toLowerCase() === itemName.toLowerCase()).length;

                    if (owned === 0) {
                        const errContainer = new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`You don't have **${itemName}** in your inventory.`)
                            );
                        return i.followUp({ flags: MessageFlags.IsComponentsV2, components: [errContainer], ephemeral: true });
                    }

                    // Display confirmation screen with quantity buttons
                    const confirmContainer = new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`## Sell Item: ${itemName}\nHow many would you like to sell?`)
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Item:** **${itemName}**\n` +
                                `**Unit Price:** ${EMOJIS.coin} **${price}** coins\n` +
                                `**You Own:** **${owned}**\n\n` +
                                `*Select a quantity below to confirm the trade.*`
                            )
                        );

                    const qty1Btn = new ButtonBuilder()
                        .setCustomId(`inv_sell_qty_1_${itemName}`)
                        .setLabel('Sell 1')
                        .setStyle(ButtonStyle.Success);

                    const qty5Btn = new ButtonBuilder()
                        .setCustomId(`inv_sell_qty_5_${itemName}`)
                        .setLabel('Sell 5')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(owned < 5);

                    const qtyAllBtn = new ButtonBuilder()
                        .setCustomId(`inv_sell_qty_all_${itemName}`)
                        .setLabel(`Sell All (${owned})`)
                        .setStyle(ButtonStyle.Danger);

                    const cancelBtn = new ButtonBuilder()
                        .setCustomId('inv_sell_qty_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary);

                    confirmContainer.addActionRowComponents(
                        new ActionRowBuilder().addComponents(qty1Btn, qty5Btn, qtyAllBtn, cancelBtn)
                    );

                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

                } else if (i.customId.startsWith('inv_sell_qty_')) {
                    await i.deferUpdate();

                    if (i.customId === 'inv_sell_qty_cancel') {
                        const currentItems = await db.getInventory(guild.id, user.id);
                        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildSelfView(currentItems, 'Transaction cancelled.')] });
                        return;
                    }

                    const parts = i.customId.replace('inv_sell_qty_', '').split('_');
                    const qtyType = parts[0];
                    const itemName = parts.slice(1).join('_');
                    const price = SELLABLE_ITEMS[itemName.toLowerCase()];

                    if (!price) {
                        const errContainer = new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**${itemName}** cannot be sold.`)
                            );
                        return i.followUp({ flags: MessageFlags.IsComponentsV2, components: [errContainer], ephemeral: true });
                    }

                    const currentItems = await db.getInventory(guild.id, user.id);
                    const ownedCount = currentItems.filter(n => n.toLowerCase() === itemName.toLowerCase()).length;
                    const originalItemName = currentItems.find(n => n.toLowerCase() === itemName.toLowerCase()) || itemName;

                    let sellQty = 1;
                    if (qtyType === '5') sellQty = 5;
                    if (qtyType === 'all') sellQty = ownedCount;

                    if (ownedCount < sellQty || sellQty <= 0) {
                        const errContainer = new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`You do not have enough **${itemName}** to sell!`)
                            );
                        return i.followUp({ flags: MessageFlags.IsComponentsV2, components: [errContainer], ephemeral: true });
                    }

                    let removedCount = 0;
                    for (let k = 0; k < sellQty; k++) {
                        const removed = await db.removeItemFromInventory(guild.id, user.id, originalItemName);
                        if (removed) removedCount++;
                    }

                    const totalPayout = removedCount * price;
                    await db.updateCoins(guild.id, user.id, totalPayout);

                    const refreshedItems = await db.getInventory(guild.id, user.id);
                    const sellExtraText = `**Sold ${removedCount}x ${originalItemName}** for ${EMOJIS.coin} **+${totalPayout.toLocaleString()}** coins!`;
                    currentPage = 0;
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildSelfView(refreshedItems, sellExtraText)] });
                }
            });

            collector.on('end', async () => {
                const currentItems = await db.getInventory(guild.id, user.id).catch(() => items);
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildSelfView(currentItems, null, true)] }).catch(() => null);
            });

        } catch (err) {
            console.error('[ERROR] Inventory command failed:', err);
            const errMsg = { content: 'Failed to load inventory records from database.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
