const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../utils/db');

async function buildBalanceEmbed(guild, targetUser) {
    const profile = await db.getProfile(guild.id, targetUser.id);
    if (!profile) return null;

    const stocksData = await db.getUserStocksTotalValue(guild.id, targetUser.id).catch(() => ({ totalValue: 0 }));
    const intradayData = await db.getUserIntradayTotalValue(guild.id, targetUser.id).catch(() => ({ totalValue: 0 }));
    const totalStockAssets = Math.round((stocksData.totalValue || 0) + (intradayData.totalValue || 0));
    const netWorth = profile.coins + (profile.bank || 0) + totalStockAssets;

    const embed = new EmbedBuilder()
        .setTitle(`👛 Finance Balance: ${targetUser.username}`)
        .setColor('#00FFCC')
        .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
        .setDescription(`Financial breakdown in **${guild.name}**`)
        .addFields(
            { name: '🪙 Active Wallet', value: `🪙 **${profile.coins.toLocaleString()}** coins`, inline: true },
            { name: '🏦 Bank Vault', value: `🪙 **${(profile.bank || 0).toLocaleString()}** coins`, inline: true },
            { name: '📈 Stock Portfolio', value: `🪙 **${totalStockAssets.toLocaleString()}** coins`, inline: true },
            { name: '📊 Net Worth', value: `🪙 **${netWorth.toLocaleString()}** coins` }
        )
        .setTimestamp();

    return { embed, profile };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Checks a member's wallet balance of server coins.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check balance for (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { guild, user } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not hold virtual currencies.', ephemeral: true });
        }

        try {
            const result = await buildBalanceEmbed(guild, targetUser);
            if (!result) {
                return interaction.editReply({ content: '❌ Failed to retrieve balance records.', ephemeral: true });
            }

            const { embed, profile } = result;
            const isSelf = targetUser.id === user.id;

            let components = [];
            if (isSelf) {
                const depositBtn = new ButtonBuilder()
                    .setCustomId('bal_deposit_all')
                    .setLabel('💰 Deposit All')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(profile.coins <= 0);

                const withdrawBtn = new ButtonBuilder()
                    .setCustomId('bal_withdraw_all')
                    .setLabel('🏧 Withdraw All')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((profile.bank || 0) <= 0);

                const shopBtn = new ButtonBuilder()
                    .setCustomId('bal_view_shop')
                    .setLabel('🛍️ View Shop')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, shopBtn);
                components = [row];
            }

            const response = await interaction.editReply({ embeds: [embed], components });

            if (!isSelf) return;

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === 'bal_deposit_all') {
                    const currentProfile = await db.getProfile(guild.id, user.id);
                    if (currentProfile.coins <= 0) {
                        return i.reply({ content: '❌ Your wallet is empty!', ephemeral: true });
                    }
                    await db.depositCoins(guild.id, user.id, currentProfile.coins);

                    const updated = await buildBalanceEmbed(guild, targetUser);
                    await i.update({ embeds: [updated.embed] });

                } else if (i.customId === 'bal_withdraw_all') {
                    const currentProfile = await db.getProfile(guild.id, user.id);
                    if ((currentProfile.bank || 0) <= 0) {
                        return i.reply({ content: '❌ Your vault is empty!', ephemeral: true });
                    }
                    await db.withdrawCoins(guild.id, user.id, currentProfile.bank);

                    const updated = await buildBalanceEmbed(guild, targetUser);
                    await i.update({ embeds: [updated.embed] });

                } else if (i.customId === 'bal_view_shop') {
                    await i.reply({ content: '🛍️ Use `/shop view` to browse the server shop!', ephemeral: true });
                }
            });

            collector.on('end', async () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bal_deposit_all').setLabel('💰 Deposit All').setStyle(ButtonStyle.Success).setDisabled(true),
                    new ButtonBuilder().setCustomId('bal_withdraw_all').setLabel('🏧 Withdraw All').setStyle(ButtonStyle.Primary).setDisabled(true),
                    new ButtonBuilder().setCustomId('bal_view_shop').setLabel('🛍️ View Shop').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                await interaction.editReply({ components: [disabledRow] }).catch(() => null);
            });

        } catch (err) {
            console.error('[ERROR] Balance command failed:', err);
            const errMsg = { content: '❌ Failed to retrieve balance records from database.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
