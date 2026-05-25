const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription("Displays a member's purchased virtual items inventory.")
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check inventory for (defaults to yourself)')
                .setRequired(false)),

    /**
     * Executes the inventory command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { guild } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not maintain item inventories.', ephemeral: true });
        }

        try {
            // Retrieve item names list from user_inventory in Supabase
            const items = await db.getInventory(guild.id, targetUser.id);

            if (items.length === 0) {
                return interaction.editReply({ 
                    content: `🎒 **${targetUser.username}** has an empty inventory. Purchase items using \`/buy\`.`, 
                    ephemeral: false 
                });
            }

            // Consolidate duplicate items to render quantity indicators cleanly (e.g. VIP Role x2)
            const itemCounts = {};
            items.forEach(itemName => {
                itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
            });

            const listText = Object.entries(itemCounts).map(([name, count]) => {
                return `• **${name}** ${count > 1 ? `x${count}` : ''}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`🎒 Inventory: ${targetUser.username}`)
                .setColor('#FF8C00')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(listText)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
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
