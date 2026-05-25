const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Global stock market investment portal')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List available stocks and real-time prices')
                .addStringOption(opt =>
                    opt.setName('market')
                        .setDescription('Filter by specific market')
                        .setRequired(false)
                        .addChoices(
                            { name: '🇺🇸 NASDAQ', value: 'NASDAQ' },
                            { name: '🇮🇳 NSE', value: 'NSE' },
                            { name: '🇬🇧 London (LSE)', value: 'LSE' },
                            { name: '🪙 Crypto Currency', value: 'CRYPTO' },
                            { name: '🇯🇵 Tokyo (TYO)', value: 'TYO' },
                            { name: '🇦🇺 Australia (ASX)', value: 'ASX' }
                        )))
        .addSubcommand(sub =>
            sub.setName('quote')
                .setDescription('Get detailed quote for a specific stock symbol')
                .addStringOption(opt =>
                    opt.setName('symbol')
                        .setDescription('The stock symbol (e.g., AAPL, RELIANCE, BP)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy long-term investment shares of a stock')
                .addStringOption(opt =>
                    opt.setName('symbol')
                        .setDescription('The stock symbol to purchase')
                        .setRequired(true))
                .addNumberOption(opt =>
                    opt.setName('shares')
                        .setDescription('Number of shares to purchase (supports decimals)')
                        .setRequired(true)
                        .setMinValue(0.001)))
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell long-term investment shares of a stock')
                .addStringOption(opt =>
                    opt.setName('symbol')
                        .setDescription('The stock symbol to sell')
                        .setRequired(true))
                .addNumberOption(opt =>
                    opt.setName('shares')
                        .setDescription('Number of shares to sell (supports decimals)')
                        .setRequired(true)
                        .setMinValue(0.001))),

    /**
     * Executes the stock command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        const subcommand = interaction.options.getSubcommand();
        const symbol = interaction.options.getString('symbol')?.toUpperCase();

        try {
            if (subcommand === 'list') {
                const marketFilter = interaction.options.getString('market');

                // Group stocks by market
                const markets = {};
                for (const sym of Object.keys(db.STOCK_CATALOG)) {
                    const quote = db.getStockPrice(sym);
                    if (!quote) continue;
                    if (!markets[quote.market]) {
                        markets[quote.market] = [];
                    }
                    markets[quote.market].push(quote);
                }

                if (!marketFilter) {
                    // Render market summary preview
                    const embed = new EmbedBuilder()
                        .setTitle('🏛️ Global Financial Markets Exchange Portal')
                        .setColor('#FF007F')
                        .setDescription('Stateless, 24/7 deterministic real-time global asset streams. Select a specific market using the command options to view all 20+ listed assets.\n\n💡 *Use `/stock list market:[Market]` to see all available assets.*')
                        .setFooter({ text: 'Fictional simulation — prices do not reflect real markets. Not financial advice.' })
                        .setTimestamp();

                    for (const mkt of ['NASDAQ', 'NSE', 'LSE', 'CRYPTO', 'TYO', 'ASX']) {
                        const mktQuotes = markets[mkt] || [];
                        if (mktQuotes.length === 0) continue;

                        const previewQuotes = mktQuotes.slice(0, 3);
                        let previewStr = '';
                        for (const q of previewQuotes) {
                            const trendIcon = q.changePercent >= 0 ? '📈' : '📉';
                            const changeColor = q.changePercent >= 0 ? '`+' : '`';
                            previewStr += `• **${q.symbol}**: **${q.currency}${q.price.toLocaleString()}** (${trendIcon} ${changeColor}${q.changePercent}%\`)\n`;
                        }
                        const countRemaining = mktQuotes.length - previewQuotes.length;
                        if (countRemaining > 0) {
                            previewStr += `*...and ${countRemaining} more assets listed.*`;
                        }

                        const flag = mkt === 'NASDAQ' ? '🇺🇸' : mkt === 'NSE' ? '🇮🇳' : mkt === 'LSE' ? '🇬🇧' : mkt === 'CRYPTO' ? '🪙' : mkt === 'TYO' ? '🇯🇵' : '🇦🇺';
                        embed.addFields({
                            name: `${flag} ${mkt} Market`,
                            value: previewStr || '*No assets listed.*',
                            inline: true
                        });
                    }

                    return interaction.editReply({ embeds: [embed] });
                }

                const mkt = marketFilter;
                const mktQuotes = markets[mkt] || [];
                
                const flag = mkt === 'NASDAQ' ? '🇺🇸' : mkt === 'NSE' ? '🇮🇳' : mkt === 'LSE' ? '🇬🇧' : mkt === 'CRYPTO' ? '🪙' : mkt === 'TYO' ? '🇯🇵' : '🇦🇺';
                
                const embed = new EmbedBuilder()
                    .setTitle(`${flag} ${mkt} Market Assets Directory`)
                    .setColor('#FF007F')
                    .setDescription(`Showing all active real-time listings on the ${mkt} exchange.`)
                    .setFooter({ text: 'Fictional simulation — prices do not reflect real markets. Not financial advice.' })
                    .setTimestamp();

                // Divide stocks into chunks of 10 so they are perfectly clean and within character bounds
                const chunkSize = 10;
                for (let i = 0; i < mktQuotes.length; i += chunkSize) {
                    const chunk = mktQuotes.slice(i, i + chunkSize);
                    let listStr = '';
                    for (const q of chunk) {
                        const trendIcon = q.changePercent >= 0 ? '📈' : '📉';
                        const changeColor = q.changePercent >= 0 ? '`+' : '`';
                        listStr += `• **${q.symbol}** (${q.name})\n  Price: **${q.currency}${q.price.toLocaleString()}** | 24h: ${trendIcon} ${changeColor}${q.changePercent}%\`\n\n`;
                    }
                    embed.addFields({
                        name: `📋 Asset Listings (Part ${Math.floor(i / chunkSize) + 1})`,
                        value: listStr || '*No assets listed.*',
                        inline: false
                    });
                }

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'quote') {
                const quote = db.getStockPrice(symbol);
                if (!quote) {
                    return interaction.editReply({ content: `❌ Stock symbol **${symbol}** not found in the global catalog.`, ephemeral: true });
                }

                const trendIcon = quote.changePercent >= 0 ? '🟢 📈' : '🔴 📉';
                const trendText = quote.changePercent >= 0 ? `+${quote.changePercent}%` : `${quote.changePercent}%`;

                // Generate 24h price history (24 hourly points)
                const chartData = db.getStockChartData(symbol);
                const prices = chartData.points.map(p => p.price);
                const labels = chartData.points.map(p => {
                    const d = new Date(p.ts);
                    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                });
                const isUp = quote.changePercent >= 0;
                const lineColor = isUp ? 'rgba(0,255,102,1)' : 'rgba(255,51,51,1)';
                const fillColor = isUp ? 'rgba(0,255,102,0.15)' : 'rgba(255,51,51,0.15)';

                const chartConfig = {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: quote.symbol,
                            data: prices,
                            borderColor: lineColor,
                            backgroundColor: fillColor,
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        legend: { display: false },
                        scales: {
                            xAxes: [{ ticks: { fontColor: '#888', maxTicksLimit: 6 }, gridLines: { color: '#222' } }],
                            yAxes: [{ ticks: { fontColor: '#888' }, gridLines: { color: '#222' } }]
                        }
                    }
                };

                let chartUrl = null;
                try {
                    const qcRes = await fetch('https://quickchart.io/chart/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chart: chartConfig, width: 600, height: 200, backgroundColor: '#0d1117' })
                    });
                    const qcJson = await qcRes.json();
                    chartUrl = qcJson.url ?? null;
                } catch { /* chart optional */ }

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Market Feed: ${quote.symbol} (${quote.name})`)
                    .setColor(isUp ? '#00FF66' : '#FF3333')
                    .addFields(
                        { name: '🏛️ Market Exchange', value: quote.market, inline: true },
                        { name: '💱 Currency', value: `\`${quote.currency}\``, inline: true },
                        { name: '📈 Current Price', value: `**${quote.currency}${quote.price.toLocaleString()}**`, inline: true },
                        { name: '↕️ 24h Change', value: `**${trendIcon} ${trendText}**`, inline: true },
                        { name: '⏳ Reference Price', value: `${quote.currency}${quote.basePrice.toLocaleString()}`, inline: true },
                        { name: '🕒 Last Updated', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true }
                    )
                    .setFooter({ text: '1-Day Price Chart · 30-min intervals · Fictional simulation — not financial advice.' })
                    .setTimestamp();
                if (chartUrl) embed.setImage(chartUrl);

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'buy') {
                const shares = interaction.options.getNumber('shares');
                const result = await db.buyStock(guild.id, user.id, symbol, shares);

                const embed = new EmbedBuilder()
                    .setTitle('💸 Long-term Stock Purchased!')
                    .setColor('#00FF66')
                    .setDescription(`You successfully purchased stock shares and added them to your long-term portfolio.`)
                    .addFields(
                        { name: '🗂️ Asset Symbol', value: `**${result.symbol}**`, inline: true },
                        { name: '🏷️ Price/Share', value: `${result.currency}${result.price.toLocaleString()}`, inline: true },
                        { name: '📦 Shares Bought', value: `**${result.shares}**`, inline: true },
                        { name: '💰 Total Cost', value: `🪙 **${result.cost.toLocaleString()}** coins`, inline: true },
                        { name: '👛 Remaining Wallet', value: `🪙 **${result.newBalance.toLocaleString()}** coins`, inline: true }
                    )
                    .setFooter({ text: 'Fictional simulation — not financial advice. Prices do not reflect real markets.' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'sell') {
                const shares = interaction.options.getNumber('shares');
                const result = await db.sellStock(guild.id, user.id, symbol, shares);

                const embed = new EmbedBuilder()
                    .setTitle('💵 Stock Position Liquidated!')
                    .setColor('#FFCC00')
                    .setDescription(`You successfully liquidated shares from your long-term portfolio.`)
                    .addFields(
                        { name: '🗂️ Asset Symbol', value: `**${result.symbol}**`, inline: true },
                        { name: '🏷️ Price/Share', value: `${result.currency}${result.price.toLocaleString()}`, inline: true },
                        { name: '📦 Shares Sold', value: `**${result.shares}**`, inline: true },
                        { name: '💰 Total Revenue', value: `🪙 **${result.revenue.toLocaleString()}** coins`, inline: true },
                        { name: '👛 New Wallet Balance', value: `🪙 **${result.newBalance.toLocaleString()}** coins`, inline: true }
                    )
                    .setFooter({ text: 'Fictional simulation — not financial advice. Prices do not reflect real markets.' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (err) {
            console.error(`[ERROR] Stock command failed for /stock ${subcommand}:`, err);
            const errMsg = { content: `❌ Transaction failed: ${err.message}`, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
