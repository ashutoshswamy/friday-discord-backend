const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function spinWheel() {
    const num = Math.floor(Math.random() * 37);
    let color = 'green';
    if (RED_NUMBERS.includes(num)) color = 'red';
    if (BLACK_NUMBERS.includes(num)) color = 'black';
    return { num, color };
}

function calcWinnings(bet, betType, betTarget, rolled) {
    if (betType === 'COLOR') {
        if (betTarget === rolled.color) return bet * (rolled.color === 'green' ? 35 : 2);
    } else {
        if (betTarget === rolled.num) return bet * 35;
    }
    return 0;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Place a bet on the virtual roulette wheel.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(opt =>
            opt.setName('space')
                .setDescription('Where to place your bet: red, black, green, or a number 0–36 (leave blank for interactive)')
                .setRequired(false)),

    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const bet = options.getInteger('bet');
        const spaceArg = options.getString('space')?.trim().toLowerCase();

        const cd = checkCooldown('roulette', user.id, 5);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Roulette is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getProfile(guild.id, user.id);
            if (profile.coins < bet) {
                return interaction.editReply({
                    content: `❌ Insufficient coins. Your wallet has 🪙 **${profile.coins.toLocaleString()}** coins.`,
                    ephemeral: true
                });
            }

            // If space arg provided, resolve immediately
            if (spaceArg) {
                let betType, betTarget;
                if (['red', 'black', 'green'].includes(spaceArg)) {
                    betType = 'COLOR';
                    betTarget = spaceArg;
                } else {
                    const n = parseInt(spaceArg);
                    if (isNaN(n) || n < 0 || n > 36) {
                        return interaction.editReply({
                            content: '❌ Invalid bet space. Use `red`, `black`, `green`, or a number `0–36`.',
                            ephemeral: true
                        });
                    }
                    betType = 'NUMBER';
                    betTarget = n;
                }

                await db.updateCoins(guild.id, user.id, -bet);
                const rolled = spinWheel();
                const winnings = calcWinnings(bet, betType, betTarget, rolled);
                if (winnings > 0) await db.updateCoins(guild.id, user.id, winnings);

                const finalBalance = await db.getProfile(guild.id, user.id);
                const colorSquare = rolled.color === 'red' ? '🔴' : rolled.color === 'black' ? '⚫' : '🟢';
                const isWin = winnings > 0;

                const embed = new EmbedBuilder()
                    .setTitle('🎡 Roulette')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .setColor(isWin ? '#00FF66' : '#FF3333')
                    .setDescription(
                        `The ball lands on ${colorSquare} **${rolled.num} (${rolled.color.toUpperCase()})**\n\n` +
                        (isWin ? `🎉 **Win!** Your bet on \`${spaceArg.toUpperCase()}\` paid out!` : `❌ **Loss.** Your bet on \`${spaceArg.toUpperCase()}\` missed.`)
                    )
                    .addFields(
                        { name: 'Bet', value: `🪙 **${bet.toLocaleString()}**`, inline: true },
                        { name: 'Payout', value: isWin ? `🪙 **+${winnings.toLocaleString()}**` : '🪙 **0**', inline: true },
                        { name: 'Wallet', value: `🪙 **${finalBalance.coins.toLocaleString()}**`, inline: true }
                    )
                    .setFooter({ text: '🔴 Red (2×) | ⚫ Black (2×) | 🟢 Green (35×) | Number (35×)' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Interactive mode — show color buttons + number select
            const redBtn = new ButtonBuilder()
                .setCustomId('rl_red')
                .setLabel('🔴 Red (2×)')
                .setStyle(ButtonStyle.Danger);

            const blackBtn = new ButtonBuilder()
                .setCustomId('rl_black')
                .setLabel('⚫ Black (2×)')
                .setStyle(ButtonStyle.Secondary);

            const greenBtn = new ButtonBuilder()
                .setCustomId('rl_green')
                .setLabel('🟢 Green (35×)')
                .setStyle(ButtonStyle.Success);

            const numberOptions = Array.from({ length: 37 }, (_, n) => ({
                label: `${n === 0 ? '🟢' : RED_NUMBERS.includes(n) ? '🔴' : '⚫'} Number ${n}`,
                value: `num_${n}`,
                description: `${n === 0 ? 'Green' : RED_NUMBERS.includes(n) ? 'Red' : 'Black'} — Pays 35×`
            }));

            const numberSelect = new StringSelectMenuBuilder()
                .setCustomId('rl_number')
                .setPlaceholder('🎲 Or pick a specific number (0–36)...')
                .addOptions(numberOptions.slice(0, 25));

            const numberSelect2 = new StringSelectMenuBuilder()
                .setCustomId('rl_number2')
                .setPlaceholder('🎲 Numbers 25–36...')
                .addOptions(numberOptions.slice(25));

            const row1 = new ActionRowBuilder().addComponents(redBtn, blackBtn, greenBtn);
            const row2 = new ActionRowBuilder().addComponents(numberSelect);
            const row3 = new ActionRowBuilder().addComponents(numberSelect2);

            const promptEmbed = new EmbedBuilder()
                .setTitle('🎡 Roulette Table')
                .setColor('#8b5cf6')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(
                    `**Bet:** 🪙 **${bet.toLocaleString()}** coins\n\n` +
                    `Choose a color or pick a specific number to place your bet.\n` +
                    `🔴 Red / ⚫ Black pays **2×** · 🟢 Green / Numbers pay **35×**`
                )
                .setFooter({ text: 'You have 30 seconds to place your bet' });

            const response = await interaction.editReply({
                embeds: [promptEmbed],
                components: [row1, row2, row3]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                let betType, betTarget, betLabel;
                if (['rl_red', 'rl_black', 'rl_green'].includes(i.customId)) {
                    betType = 'COLOR';
                    betTarget = i.customId.replace('rl_', '');
                    betLabel = betTarget.toUpperCase();
                } else {
                    const numStr = (i.values[0]).replace('num_', '');
                    betType = 'NUMBER';
                    betTarget = parseInt(numStr);
                    betLabel = `Number ${betTarget}`;
                }

                await db.updateCoins(guild.id, user.id, -bet);
                const rolled = spinWheel();
                const winnings = calcWinnings(bet, betType, betTarget, rolled);
                if (winnings > 0) await db.updateCoins(guild.id, user.id, winnings);

                const finalBalance = await db.getProfile(guild.id, user.id);
                const colorSquare = rolled.color === 'red' ? '🔴' : rolled.color === 'black' ? '⚫' : '🟢';
                const isWin = winnings > 0;

                const resultEmbed = new EmbedBuilder()
                    .setTitle('🎡 Roulette Result')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .setColor(isWin ? '#00FF66' : '#FF3333')
                    .setDescription(
                        `The ball lands on ${colorSquare} **${rolled.num} (${rolled.color.toUpperCase()})**\n\n` +
                        (isWin ? `🎉 **Win!** Your bet on **${betLabel}** paid out!` : `❌ **Loss.** Your bet on **${betLabel}** missed.`)
                    )
                    .addFields(
                        { name: 'Bet Space', value: `\`${betLabel}\``, inline: true },
                        { name: 'Bet Amount', value: `🪙 **${bet.toLocaleString()}**`, inline: true },
                        { name: 'Payout', value: isWin ? `🪙 **+${winnings.toLocaleString()}**` : '🪙 **0**', inline: true },
                        { name: 'Wallet', value: `🪙 **${finalBalance.coins.toLocaleString()}**`, inline: true }
                    )
                    .setFooter({ text: '🔴 Red (2×) | ⚫ Black (2×) | 🟢 Green (35×) | Number (35×)' })
                    .setTimestamp();

                await i.editReply({ embeds: [resultEmbed], components: [] });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    await interaction.editReply({
                        content: '⏰ No bet placed. The table has cleared.',
                        embeds: [],
                        components: []
                    }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[ROULETTE ERROR]', err);
            const errMsg = { content: '❌ Failed to process Roulette game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
