const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchases an item from the server shop.')
        .addStringOption(option =>
            option.setName('item').setDescription('The exact name of the shop item to purchase').setRequired(true)),

    async execute(interaction) {
        const itemName = interaction.options.getString('item');
        const { guild, user, member } = interaction;
        if (!guild || !member) return;

        try {
            const result = await db.purchaseItem(guild.id, user.id, itemName);

            if (!result.success) {
                return interaction.editReply({ content: `❌ Purchase declined: ${result.reason || 'Transaction declined.'}`, ephemeral: true });
            }

            let roleGranted = false;
            let roleText = '';

            if (result.roleRewardId) {
                const rewardRole = guild.roles.cache.get(result.roleRewardId);
                if (rewardRole) {
                    roleText = rewardRole.name;
                    await member.roles.add(rewardRole, `Purchased shop item: ${itemName}`)
                        .then(() => { roleGranted = true; })
                        .catch(err => console.error(`[ERROR] Failed to grant role reward:`, err));
                }
            }

            let detailText = `**Cost Paid:** <:coin:1512926963239489606> **${result.cost.toLocaleString()}** coins\n**Item Added:** 📦 **${itemName}** → your inventory`;

            if (result.roleRewardId) {
                detailText += `\n**Role Reward:** ${roleGranted ? `✅ **${roleText}** granted!` : `❌ Failed to award **${roleText}** (bot role too low)`}`;
            }

            const container = new ContainerBuilder()
                .setAccentColor(0x00FF66)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## 🛒 Purchase Confirmed\nSuccessfully purchased **${itemName}**!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } catch (err) {
            console.error('[ERROR] Buy command failed:', err);
            const errMsg = { content: '❌ Failed to process the shop purchase transaction.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
            else await interaction.editReply(errMsg).catch(() => null);
        }
    }
};
