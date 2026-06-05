const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                            { name: '🪙 Grant Wallet Coins Cache', value: 'COINS' }
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
            // ── view ──────────────────────────────────────────────────────
            if (subcommand === 'view') {
                const items = await db.getShopItems(guild.id);

                if (items.length === 0) {
                    const emptyEmbed = new EmbedBuilder()
                        .setTitle(`🛍️ Server Shop — ${guild.name}`)
                        .setColor('#FF8C00')
                        .setDescription('📭 The server shop is currently empty.\nAdministrators can add listings using `/shop add`.')
                        .setTimestamp();
                    return interaction.editReply({ embeds: [emptyEmbed] });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🛍️ Server Shop — ${guild.name}`)
                    .setColor('#FF8C00')
                    .setDescription('Exchange server coins for exclusive items and role rewards!')
                    .setThumbnail(guild.iconURL({ forceStatic: true }))
                    .setFooter({ text: 'Select an item below to purchase it instantly' })
                    .setTimestamp();

                items.forEach(item => {
                    const roleText = item.roleRewardId ? `\n🎭 Grants: <@&${item.roleRewardId}>` : '';
                    embed.addFields({
                        name: `🛒 ${item.name} — 🪙 ${item.cost.toLocaleString()} coins`,
                        value: `*${item.description}*${roleText}`
                    });
                });

                // Quick Buy select menu
                const buyOptions = items.slice(0, 25).map(item => ({
                    label: item.name,
                    description: `🪙 ${item.cost.toLocaleString()} coins${item.roleRewardId ? ' · Grants a role' : ''}`,
                    value: `buy_${item.name}`
                }));

                const buySelect = new StringSelectMenuBuilder()
                    .setCustomId('shop_buy_select')
                    .setPlaceholder('🛒 Select an item to purchase...')
                    .addOptions(buyOptions);

                const row = new ActionRowBuilder().addComponents(buySelect);

                const response = await interaction.editReply({ embeds: [embed], components: [row] });

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

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('✅ Purchase Confirmed')
                        .setColor('#00FF66')
                        .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                        .setDescription(`**${itemName}** has been added to your inventory!`)
                        .addFields({ name: 'Cost Paid', value: `🪙 **${result.cost.toLocaleString()}** coins`, inline: true });

                    if (result.roleRewardId) {
                        confirmEmbed.addFields({
                            name: 'Role Reward',
                            value: roleGranted ? `✅ **${roleText}** granted!` : `❌ Could not grant **${roleText}** (check bot role position).`,
                            inline: true
                        });
                    }

                    confirmEmbed.setTimestamp();
                    await i.followUp({ embeds: [confirmEmbed], ephemeral: true });
                });

                collector.on('end', async () => {
                    const disabledSelect = new StringSelectMenuBuilder()
                        .setCustomId('shop_buy_select')
                        .setPlaceholder('🛒 Shop session expired')
                        .setDisabled(true)
                        .addOptions({ label: 'Expired', value: 'expired' });
                    await interaction.editReply({ components: [new ActionRowBuilder().addComponents(disabledSelect)] }).catch(() => null);
                });

                return;
            }

            // ── admin gate ────────────────────────────────────────────────
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({
                    content: '❌ Administrator permission required to modify the shop catalog.',
                    ephemeral: true
                });
            }

            // ── add ───────────────────────────────────────────────────────
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
                        const embed = new EmbedBuilder()
                            .setTitle('⚠️ Database Migration Required')
                            .setColor('#FFCC00')
                            .setDescription(
                                `Consumable effects require the latest schema.\n\n` +
                                `**Run in Supabase SQL Editor:**\n` +
                                `\`\`\`sql\nALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_type TEXT;\nALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_value INT;\n\`\`\``
                            )
                            .setTimestamp();
                        return interaction.editReply({ embeds: [embed] });
                    }
                    return interaction.editReply({
                        content: `❌ Failed to add item. A listing named \`${name}\` may already exist.`,
                        ephemeral: true
                    });
                }

                const actionText = actionType ? ` — Consumable: **${actionType}** grants **${actionValue.toLocaleString()}** on use` : '';

                const embed = new EmbedBuilder()
                    .setTitle('✅ Shop Item Added')
                    .setColor('#00FF66')
                    .setDescription(`**${name}** is now listed in the shop.`)
                    .addFields(
                        { name: 'Price', value: `🪙 **${cost.toLocaleString()}** coins`, inline: true },
                        { name: 'Description', value: description, inline: false }
                    )
                    .setTimestamp();

                if (actionType) embed.addFields({ name: 'Effect', value: actionText.replace(' — ', ''), inline: false });
                if (role) embed.addFields({ name: 'Role Reward', value: `<@&${role.id}>`, inline: true });

                return interaction.editReply({ embeds: [embed] });
            }

            // ── remove ────────────────────────────────────────────────────
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

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Confirm Shop Item Removal')
                    .setColor('#FF4500')
                    .setDescription(`Remove **${name}** from the shop? This cannot be undone.`);

                const response = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

                const collector = response.createMessageComponentCollector({
                    filter: i => i.user.id === user.id,
                    time: 30000,
                    max: 1
                });

                collector.on('collect', async i => {
                    if (i.customId === 'shop_remove_cancel') {
                        return i.update({ content: '✅ Removal cancelled.', embeds: [], components: [] });
                    }

                    const result = await db.removeShopItem(guild.id, name);
                    if (!result.success) {
                        return i.update({
                            content: `❌ ${result.reason || `Could not find \`${name}\` in the shop.`}`,
                            embeds: [],
                            components: []
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('🗑️ Item Removed')
                        .setColor('#FF4500')
                        .setDescription(`**${name}** has been removed from the server shop.`)
                        .setTimestamp();

                    await i.update({ embeds: [embed], components: [] });
                });

                collector.on('end', async (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        await interaction.editReply({ content: '⏰ Confirmation timed out.', embeds: [], components: [] }).catch(() => null);
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
