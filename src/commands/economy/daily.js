const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claims your daily reward of 200 server coins.'),

    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        try {
            const result = await db.claimDaily(guild.id, user.id);

            if (!result.success) {
                const nextClaimUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);

                const embed = new EmbedBuilder()
                    .setTitle('🪙 Daily Already Claimed')
                    .setColor('#FF8C00')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .setDescription(`You have already collected your daily coins today.`)
                    .addFields(
                        { name: '⏳ Next Claim', value: `<t:${nextClaimUnix}:R> (at <t:${nextClaimUnix}:t>)`, inline: false }
                    )
                    .setFooter({ text: 'Come back tomorrow for your next reward!' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            const profile = await db.getProfile(guild.id, user.id);

            const workBtn = new ButtonBuilder()
                .setCustomId('daily_work_reminder')
                .setLabel('💼 Work for More')
                .setStyle(ButtonStyle.Success);

            const shopBtn = new ButtonBuilder()
                .setCustomId('daily_shop_reminder')
                .setLabel('🛍️ Visit Shop')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(workBtn, shopBtn);

            const embed = new EmbedBuilder()
                .setTitle('🪙 Daily Reward Claimed!')
                .setColor('#FFD700')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Your daily allowance has been deposited into your wallet.`)
                .addFields(
                    { name: '🎁 Reward', value: `🪙 **+${result.reward.toLocaleString()}** coins`, inline: true },
                    { name: '💰 Wallet Balance', value: `🪙 **${result.newBalance.toLocaleString()}** coins`, inline: true },
                    { name: '⏭️ Next Claim', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: 'Tip: Use /work every hour and /beg every 45s for extra coins!' })
                .setTimestamp();

            const response = await interaction.editReply({ embeds: [embed], components: [row] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async i => {
                if (i.customId === 'daily_work_reminder') {
                    await i.reply({ content: '💼 Use `/work` to earn coins every hour! Your pay scales with your job tier.', ephemeral: true });
                } else if (i.customId === 'daily_shop_reminder') {
                    await i.reply({ content: '🛍️ Use `/shop view` to browse items you can purchase with your coins!', ephemeral: true });
                }
            });

            collector.on('end', async () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(workBtn).setDisabled(true),
                    ButtonBuilder.from(shopBtn).setDisabled(true)
                );
                await interaction.editReply({ components: [disabledRow] }).catch(() => null);
            });

        } catch (err) {
            console.error('[ERROR] Daily command failed:', err);
            const errMsg = { content: '❌ Failed to claim daily allowance. Please try again later.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
