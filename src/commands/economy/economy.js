const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Spawn or remove server coins manually for a member (Administrator only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add/Spawn Coins', value: 'add' },
                    { name: 'Remove/Deduct Coins', value: 'remove' }
                ))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to adjust coins balance for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of coins')
                .setMinValue(1)
                .setRequired(true)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const { guild } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not maintain coin wallets.', ephemeral: true });
        }

        try {
            const amountChange = action === 'add' ? amount : -amount;
            const newBalance = await db.updateCoins(guild.id, targetUser.id, amountChange);

            const actionVerb = action === 'add' ? 'Spawned' : 'Deducted';
            const actionIcon = action === 'add' ? '➕' : '➖';

            const container = new ContainerBuilder()
                .setAccentColor(0xFFD700)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## <:coin:1512926963239489606> Currency Balance Adjusted\n${actionVerb} **${amount.toLocaleString()}** coins ${action === 'add' ? 'into' : 'from'} ${targetUser}'s wallet.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Action:** ${actionIcon} **${actionVerb}**\n` +
                        `**Amount:** <:coin:1512926963239489606> **${amount.toLocaleString()}** coins\n` +
                        `**Target:** ${targetUser}\n` +
                        `**New Wallet Balance:** <:coin:1512926963239489606> **${newBalance.toLocaleString()}** coins`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } catch (err) {
            console.error('[ERROR] Admin economy command failed:', err);
            const _errMsg = { content: '❌ Failed to adjust coins balance. Verify database connectivity.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
