const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchases an item from the server shop.')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The exact name of the shop item to purchase')
                .setRequired(true)),

    /**
     * Executes the buy command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const itemName = interaction.options.getString('item');
        const { guild, user, member } = interaction;

        if (!guild || !member) return;

        try {
            // Process the transaction securely inside our Supabase db utility
            const result = await db.purchaseItem(guild.id, user.id, itemName);

            if (!result.success) {
                return interaction.editReply({ 
                    content: `❌ Purchase declined: ${result.reason || 'Transaction declined.'}`, 
                    ephemeral: true 
                });
            }

            let roleGranted = false;
            let roleText = '';

            // If the purchased item includes a Role Reward, attempt to grant it
            if (result.roleRewardId) {
                const rewardRole = guild.roles.cache.get(result.roleRewardId);
                if (rewardRole) {
                    roleText = rewardRole.name;
                    await member.roles.add(rewardRole, `Purchased shop item: ${itemName}`)
                        .then(() => {
                            roleGranted = true;
                        })
                        .catch(err => {
                            console.error(`[ERROR] Failed to grant role reward ${rewardRole.name} upon purchase:`, err);
                        });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🛒 Purchase Confirmed')
                .setColor('#00FF66')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Successfully purchased **${itemName}**! The item has been added to your inventory.`)
                .addFields({
                    name: 'Cost Paid',
                    value: `🪙 **${result.cost.toLocaleString()}** coins`,
                    inline: true
                })
                .setTimestamp();

            if (result.roleRewardId) {
                embed.addFields({
                    name: 'Role Reward',
                    value: roleGranted ? `✅ Role **${roleText}** granted!` : `❌ Failed to award **${roleText}** role (bot role position too low). Contact admins.`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Buy command failed:', err);
            const errMsg = { content: '❌ Failed to process the shop purchase transaction.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
