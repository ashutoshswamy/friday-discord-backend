const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Manage or view the server virtual coin shop.')
        
        // Subcommand: view
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the catalog of items available for purchase.'))
        
        // Subcommand: add
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
        
        // Subcommand: remove
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an item from the server shop (Administrator only).')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('The exact name of the item to delete')
                        .setRequired(true))),

    /**
     * Executes the shop command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options, member } = interaction;
        if (!guild || !member) return;

        const subcommand = options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: view
            // ------------------------------------------
            if (subcommand === 'view') {
                const items = await db.getShopItems(guild.id);

                if (items.length === 0) {
                    return interaction.editReply({ 
                        content: '📜 The server shop is currently empty. Administrators can add listings using `/shop add`.', 
                        ephemeral: false 
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🛍️ Virtual shop - ${guild.name}`)
                    .setColor('#FF8C00')
                    .setDescription('Exchanges server coins for exclusive role rewards! Use `/buy [item_name]` to purchase items.')
                    .setTimestamp();

                items.forEach(item => {
                    const roleRewardText = item.roleRewardId ? `\n• **Milestone Role:** <@&${item.roleRewardId}>` : '';
                    embed.addFields({
                        name: `🛒 ${item.name} — 🪙 ${item.cost.toLocaleString()} coins`,
                        value: `*${item.description}*${roleRewardText}`
                    });
                });

                return interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // Authorization for Admin Subcommands
            // ------------------------------------------
            if (subcommand === 'add' || subcommand === 'remove') {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.editReply({ 
                        content: '❌ You do not have administrative permissions to modify shop catalog!', 
                        ephemeral: true 
                    });
                }
            }

            // ------------------------------------------
            // B. Subcommand: add
            // ------------------------------------------
            if (subcommand === 'add') {
                const name = options.getString('name');
                const cost = options.getInteger('cost');
                const description = options.getString('description') || 'No description provided.';
                const role = options.getRole('role');
                const actionType = options.getString('action_type');
                const actionValue = options.getInteger('action_value');

                // If actionType is provided but actionValue is missing, reject
                if (actionType && !actionValue) {
                    return interaction.editReply({
                        content: '❌ You must provide an **action_value** when configuring an **action_type** consumable effect!',
                        ephemeral: true
                    });
                }

                const result = await db.addShopItem(guild.id, name, cost, description, role ? role.id : null, actionType, actionValue);

                if (!result.success) {
                    if (result.reason === 'migration_needed') {
                        const embed = new EmbedBuilder()
                            .setTitle('⚠️ Database Migration Required!')
                            .setColor('#FFCC00')
                            .setDescription(
                                `Custom consumable effects require the latest database schema updates.\n\n` +
                                `🔧 **Please execute the following SQL in your Supabase SQL Editor first:**\n` +
                                `\`\`\`sql\n` +
                                `ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_type TEXT;\n` +
                                `ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_value INT;\n` +
                                `\`\`\`\n` +
                                `*You can find this migration script at:* \`supabase/migrations/008_shop_item_actions.sql\``
                            )
                            .setTimestamp();
                        return interaction.editReply({ embeds: [embed] });
                    }
                    return interaction.editReply({ 
                        content: `❌ Failed to add item. A listing with the name \`${name}\` might already exist!`, 
                        ephemeral: true 
                    });
                }

                const actionText = actionType ? ` (Consumable effect: **${actionType}** grants **${actionValue.toLocaleString()}** on use)` : '';
                return interaction.editReply({ 
                    content: `✅ Successfully added **${name}** to the shop catalog for 🪙 **${cost.toLocaleString()}** coins!${actionText}` 
                });
            }

            // ------------------------------------------
            // C. Subcommand: remove
            // ------------------------------------------
            if (subcommand === 'remove') {
                const name = options.getString('name');

                const result = await db.removeShopItem(guild.id, name);

                if (!result.success) {
                    return interaction.editReply({ 
                        content: `❌ ${result.reason || `Could not find any item named \`${name}\` in the shop listings.`}`, 
                        ephemeral: true 
                    });
                }

                return interaction.editReply({ 
                    content: `✅ Successfully removed **${name}** from the server shop.` 
                });
            }

        } catch (err) {
            console.error('[ERROR] Shop command failed:', err);
            const _errMsg = { content: '❌ Failed to process shop operations in the database.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
