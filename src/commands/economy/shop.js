const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Manage or view the server virtual coin shop.')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the catalog of items available for purchase.'))
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a new item to the server shop (Administrator only).')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('The name of the custom item (e.g. Premium Role)')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('cost')
                        .setDescription('The item cost in server coins')
                        .setMinValue(1)
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Item description or flavor text')
                        .setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('A role automatically rewarded to the user upon purchase')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('action_type')
                        .setDescription('The consumable effect type when used via /use')
                        .setRequired(false)
                        .addChoices(
                            { name: '🏆 Grant XP Boost', value: 'XP' },
                            { name: '<:coin:1512926963239489606> Grant Wallet Coins Cache', value: 'COINS' }
                        ))
                .addIntegerOption(opt =>
                    opt.setName('action_value')
                        .setDescription('The amount of XP or coins to grant')
                        .setMinValue(1)
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an item from the server shop (Administrator only).')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('The exact name of the item to delete')
                        .setRequired(true))),

    async execute(interaction) {
        const { guild, options, member, user } = interaction;
        if (!guild || !member) return;

        const subcommand = options.getSubcommand();

        try {
            if (subcommand === 'view') {
                const items = await db.getShopItems(guild.id);

                if (items.length === 0) {
                    const emptyContainer = new ContainerBuilder()
                        .setAccentColor(0xFF8C00)
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `## 🛍️ Server Shop — ${guild.name}\n📭 The server shop is currently empty.\nAdministrators can add listings using \`/shop add\`.`
                                    )
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
                        );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [emptyContainer] });
                }

                const itemsText = items.map(item => {
                    const roleText = item.roleRewardId ? `\n  🎭 Grants: <@&${item.roleRewardId}>` : '';
                    return `**🛒 ${item.name}** — <:coin:1512926963239489606> **${item.cost.toLocaleString()}** coins\n  *${item.description}*${roleText}`;
                }).join('\n\n');

                const buyOptions = items.slice(0, 25).map(item => ({
                    label: item.name,
                    description: `<:coin:1512926963239489606> ${item.cost.toLocaleString()} coins${item.roleRewardId ? ' · Grants a role' : ''}`,
                    value: `buy_${item.name}`
                }));

                const buySelect = new StringSelectMenuBuilder()
                    .setCustomId('shop_buy_select')
                    .setPlaceholder('🛒 Select an item to purchase...')
                    .addOptions(buyOptions);

                const container = new ContainerBuilder()
                    .setAccentColor(0xFF8C00)
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## 🛍️ Server Shop — ${guild.name}\nExchange server coins for exclusive items and role rewards!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(itemsText))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addActionRowComponents(new ActionRowBuilder().addComponents(buySelect));

                const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

                const collector = response.createMessageComponentCollector({
                    filter: i => i.user.id === user.id,
                    time: 120000
                });

                collector.on('collect', async i => {
                    const itemName = i.values[0].replace('buy_', '');
                    await i.deferUpdate();

                    const result = await db.purchaseItem(guild.id, user.id, itemName).catch(() => null);

                    if (!result || !result.success) {
                        return i.followUp({
                            content: `❌ Purchase failed: ${result?.reason || 'Insufficient coins or item not found.'}`,
                            ephemeral: true
                        });
                    }

                    let roleGranted = false;
                    let roleText = '';
                    if (result.roleRewardId) {
                        const rewardRole = guild.roles.cache.get(result.roleRewardId);
                        if (rewardRole) {
                            roleText = rewardRole.name;
                            await member.roles.add(rewardRole, `Purchased: ${itemName}`).then(() => { roleGranted = true; }).catch(() => null);
                        }
                    }

                    let detailText = `**Item Purchased:** 📦 **${itemName}** → your inventory\n**Cost Paid:** <:coin:1512926963239489606> **${result.cost.toLocaleString()}** coins`;

                    if (result.roleRewardId) {
                        detailText += `\n**Role Reward:** ${roleGranted ? `✅ **${roleText}** granted!` : `❌ Could not grant **${roleText}** (check bot role position).`}`;
                    }

                    const confirmContainer = new ContainerBuilder()
                        .setAccentColor(0x00FF66)
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `## ✅ Purchase Confirmed\n**${itemName}** has been added to your inventory!`
                                    )
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

                    await i.followUp({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer], ephemeral: true });
                });

                collector.on('end', async () => {
                    const disabledSelect = new StringSelectMenuBuilder()
                        .setCustomId('shop_buy_select')
                        .setPlaceholder('🛒 Shop session expired')
                        .setDisabled(true)
                        .addOptions({ label: 'Expired', value: 'expired' });

                    const expiredContainer = new ContainerBuilder()
                        .setAccentColor(0xFF8C00)
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `## 🛍️ Server Shop — ${guild.name}\nExchange server coins for exclusive items and role rewards!`
                                    )
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(itemsText))
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addActionRowComponents(new ActionRowBuilder().addComponents(disabledSelect));

                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
                });

                return;
            }

            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({
                    content: '❌ Administrator permission required to modify the shop catalog.',
                    ephemeral: true
                });
            }

            if (subcommand === 'add') {
                const name = options.getString('name');
                const cost = options.getInteger('cost');
                const description = options.getString('description') || 'No description provided.';
                const role = options.getRole('role');
                const actionType = options.getString('action_type');
                const actionValue = options.getInteger('action_value');

                if (actionType && !actionValue) {
                    return interaction.editReply({
                        content: '❌ You must provide an **action_value** when configuring an **action_type**.',
                        ephemeral: true
                    });
                }

                const result = await db.addShopItem(guild.id, name, cost, description, role ? role.id : null, actionType, actionValue);

                if (!result.success) {
                    if (result.reason === 'migration_needed') {
                        const migrationContainer = new ContainerBuilder()
                            .setAccentColor(0xFFCC00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## ⚠️ Database Migration Required\nConsumable effects require the latest schema.\n\n**Run in Supabase SQL Editor:**\n\`\`\`sql\nALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_type TEXT;\nALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_value INT;\n\`\`\``
                                )
                            );
                        return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [migrationContainer] });
                    }
                    return interaction.editReply({
                        content: `❌ Failed to add item. A listing named \`${name}\` may already exist.`,
                        ephemeral: true
                    });
                }

                let detailText =
                    `**Name:** 🛒 **${name}**\n` +
                    `**Price:** <:coin:1512926963239489606> **${cost.toLocaleString()}** coins\n` +
                    `**Description:** ${description}`;

                if (actionType) detailText += `\n**Effect:** Consumable — **${actionType}** grants **${actionValue.toLocaleString()}** on use`;
                if (role) detailText += `\n**Role Reward:** <@&${role.id}>`;

                const container = new ContainerBuilder()
                    .setAccentColor(0x00FF66)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ✅ Shop Item Added\n**${name}** is now listed in the shop.`)
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (subcommand === 'remove') {
                const name = options.getString('name');

                const confirmBtn = new ButtonBuilder()
                    .setCustomId('shop_remove_confirm')
                    .setLabel(`🗑️ Remove "${name}"`)
                    .setStyle(ButtonStyle.Danger);

                const cancelBtn = new ButtonBuilder()
                    .setCustomId('shop_remove_cancel')
                    .setLabel('✕ Cancel')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

                const confirmContainer = new ContainerBuilder()
                    .setAccentColor(0xFF4500)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ⚠️ Confirm Shop Item Removal\nRemove **${name}** from the shop? This cannot be undone.`
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addActionRowComponents(row);

                const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

                const collector = response.createMessageComponentCollector({
                    filter: i => i.user.id === user.id,
                    time: 30000,
                    max: 1
                });

                collector.on('collect', async i => {
                    if (i.customId === 'shop_remove_cancel') {
                        return i.update({ content: '✅ Removal cancelled.', flags: MessageFlags.IsComponentsV2, components: [] });
                    }

                    const result = await db.removeShopItem(guild.id, name);
                    if (!result.success) {
                        return i.update({
                            content: `❌ ${result.reason || `Could not find \`${name}\` in the shop.`}`,
                            flags: MessageFlags.IsComponentsV2,
                            components: []
                        });
                    }

                    const removedContainer = new ContainerBuilder()
                        .setAccentColor(0xFF4500)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## 🗑️ Item Removed\n**${name}** has been removed from the server shop.`
                            )
                        );

                    await i.update({ flags: MessageFlags.IsComponentsV2, components: [removedContainer] });
                });

                collector.on('end', async (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        await interaction.editReply({ content: '⏰ Confirmation timed out.', flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);
                    }
                });
            }

        } catch (err) {
            console.error('[ERROR] Shop command failed:', err);
            const errMsg = { content: '❌ Failed to process shop operations.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
