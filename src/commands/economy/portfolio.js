const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('Manage your stock portfolio and leveraged intraday trades')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View your active stock holdings and active intraday positions')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to view portfolio for (defaults to yourself)')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('open')
                .setDescription('Open a leveraged 5x intraday long or short position')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('LONG (buy rising) or SHORT (sell falling)')
                        .setRequired(true)
                        .addChoices(
                            { name: '🟢 LONG (Bullish)', value: 'LONG' },
                            { name: '🔴 SHORT (Bearish)', value: 'SHORT' }
                        ))
                .addStringOption(opt =>
                    opt.setName('symbol')
                        .setDescription('The stock symbol to trade')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('margin')
                        .setDescription('Coins to collateralize as margin')
                        .setRequired(true)
                        .setMinValue(10)))
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close an active leveraged intraday position and settle PnL')
                .addStringOption(opt =>
                    opt.setName('symbol')
                        .setDescription('The stock symbol of the position to close')
                        .setRequired(true))),

    /**
     * Executes the portfolio command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user') || user;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not trade or hold assets.', ephemeral: true });
        }

        try {
            if (subcommand === 'view') {
                const stocksData = await db.getUserStocksTotalValue(guild.id, targetUser.id);
                const intradayData = await db.getUserIntradayTotalValue(guild.id, targetUser.id);

                const embed = new EmbedBuilder()
                    .setTitle(`📈 Asset Portfolio: ${targetUser.username}`)
                    .setColor('#00E5FF') // Brilliant neon cyan
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setTimestamp();

                // 1. Long-term Holdings
                let stocksStr = '';
                if (stocksData.holdings.length > 0) {
                    for (const h of stocksData.holdings) {
                        const sign = h.pnl >= 0 ? '+' : '';
                        const pnlColor = h.pnl >= 0 ? '🟢 `+' : '🔴 `';
                        stocksStr += `• **${h.symbol}** (${h.market})\n  Shares: \`${h.shares.toFixed(3)}\` | Avg: \`${h.currency}${h.averageBuyPrice.toFixed(2)}\` | Cur: \`${h.currency}${h.currentPrice.toFixed(2)}\`\n  PnL: ${pnlColor}${h.pnl.toFixed(2)} (${sign}${h.pnlPercent.toFixed(2)}%)\` | Value: **${h.currency}${h.currentValue.toFixed(2)}**\n\n`;
                    }
                } else {
                    stocksStr = '*No active long-term investments. Buy stocks using `/stock buy`.*\n\n';
                }

                // 2. Intraday Positions
                let intradayStr = '';
                if (intradayData.positions.length > 0) {
                    for (const p of intradayData.positions) {
                        const sign = p.pnl >= 0 ? '+' : '';
                        const pnlColor = p.pnl >= 0 ? '🟢 `+' : '🔴 `';
                        const typeEmoji = p.type === 'LONG' ? '🟢' : '🔴';
                        intradayStr += `• **${p.symbol}** | ${typeEmoji} **${p.type}** (${p.leverage}x)\n  Margin: \`🪙 ${p.margin.toLocaleString()}\` | Entry: \`${p.currency}${p.entryPrice.toFixed(2)}\` | Cur: \`${p.currency}${p.currentPrice.toFixed(2)}\`\n  PnL: ${pnlColor}${p.pnl.toFixed(2)} (${sign}${p.pnlPercent.toFixed(2)}%)\` | Return: **🪙 ${p.currentValue.toFixed(2)}**\n\n`;
                    }
                } else {
                    intradayStr = '*No active intraday positions. Open trades using `/portfolio open`.*\n\n';
                }

                embed.addFields(
                    { name: '🏛️ Long-term Investments (LONG Only)', value: stocksStr, inline: false },
                    { name: '⚡ Leveraged Intraday Trades (5x Max Leverage)', value: intradayStr, inline: false }
                );

                // Financial Overview
                const totalCost = (stocksData.totalCost || 0) + (intradayData.totalMargin || 0);
                const totalValue = (stocksData.totalValue || 0) + (intradayData.totalValue || 0);
                const overallPnL = totalValue - totalCost;
                const overallPnLPercent = totalCost > 0 ? (overallPnL / totalCost) * 100 : 0;
                const pnlSign = overallPnL >= 0 ? '+' : '';

                embed.addFields({
                    name: '💼 Portfolio Balance Summary',
                    value: `• Total Invested Assets: **🪙 ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** coins\n• Portfolio Current Value: **🪙 ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** coins\n• Cumulative Unrealized PnL: **${overallPnL >= 0 ? '🟢' : '🔴'} ${pnlSign}${overallPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pnlSign}${overallPnLPercent.toFixed(2)}%)**`,
                    inline: false
                });

                embed.setFooter({ text: 'Fictional simulation — prices do not reflect real markets. Not financial advice.' });

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'open') {
                if (targetUser.id !== user.id) {
                    return interaction.editReply({ content: '❌ You can only open intraday positions for yourself.', ephemeral: true });
                }

                const type = interaction.options.getString('type');
                const symbol = interaction.options.getString('symbol').toUpperCase();
                const margin = interaction.options.getInteger('margin');

                const result = await db.openIntradayPosition(guild.id, user.id, symbol, type, margin, 5);

                const embed = new EmbedBuilder()
                    .setTitle('⚡ Intraday Leveraged Position Opened!')
                    .setColor('#00E5FF')
                    .setDescription(`You successfully opened a **5x leveraged ${type}** position on **${result.symbol}** using your wallet balance.`)
                    .addFields(
                        { name: '🗂️ Symbol', value: `**${result.symbol}**`, inline: true },
                        { name: '🧭 Order Type', value: result.type === 'LONG' ? '🟢 LONG' : '🔴 SHORT', inline: true },
                        { name: '⚖️ Leverage', value: `**${result.leverage}x**`, inline: true },
                        { name: '💵 Margin Collateral', value: `🪙 **${result.margin.toLocaleString()}** coins`, inline: true },
                        { name: '🏷️ Entry Price', value: `${result.currency}${result.entryPrice.toLocaleString()}`, inline: true },
                        { name: '📦 Leveraged Position Size', value: `\`${result.shares.toFixed(4)}\` shares`, inline: true }
                    )
                    .setFooter({ text: 'Warning: Leveraged trading amplifies both profits and losses. · Fictional simulation — not financial advice.' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'close') {
                if (targetUser.id !== user.id) {
                    return interaction.editReply({ content: '❌ You can only close intraday positions for yourself.', ephemeral: true });
                }

                const symbol = interaction.options.getString('symbol').toUpperCase();
                const result = await db.closeIntradayPosition(guild.id, user.id, symbol);

                const pnlSign = result.pnl >= 0 ? '+' : '';
                const pnlPercent = (result.pnl / result.margin) * 100;

                const embed = new EmbedBuilder()
                    .setTitle('Settled: Intraday Position Closed!')
                    .setColor(result.pnl >= 0 ? '#00FF66' : '#FF3333')
                    .setDescription(`Your leveraged position on **${result.symbol}** has been settled and closed.`)
                    .addFields(
                        { name: '🗂️ Symbol', value: `**${result.symbol}**`, inline: true },
                        { name: '🧭 Order Type', value: result.type === 'LONG' ? '🟢 LONG' : '🔴 SHORT', inline: true },
                        { name: '🏷️ Entry Price', value: `${result.currency}${result.entryPrice.toFixed(2)}`, inline: true },
                        { name: '🏷️ Settlement Price', value: `${result.currency}${result.exitPrice.toFixed(2)}`, inline: true },
                        { name: '💵 Initial Margin', value: `🪙 **${result.margin.toLocaleString()}** coins`, inline: true },
                        { name: '📈 Realized PnL', value: `**${result.pnl >= 0 ? '🟢' : '🔴'} ${pnlSign}${result.pnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(2)}%)**`, inline: true },
                        { name: '👛 Settled Cash Returned', value: `🪙 **${result.totalReturn.toFixed(2)}** coins`, inline: true },
                        { name: '👛 Wallet Balance', value: `🪙 **${result.newBalance.toLocaleString()}** coins`, inline: true }
                    )
                    .setFooter({ text: 'Settlement proceeds are immediately updated in your active wallet. · Fictional simulation — not financial advice.' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (err) {
            console.error(`[ERROR] Portfolio command failed for /portfolio ${subcommand}:`, err);
            const errMsg = { content: `❌ Transaction failed: ${err.message}`, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
