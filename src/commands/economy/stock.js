const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags
} = require('discord.js');
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
 { name: '[US] NASDAQ', value: 'NASDAQ' },
 { name: '[IN] NSE', value: 'NSE' },
 { name: '[UK] London (LSE)', value: 'LSE' },
 { name: 'Crypto Currency', value: 'CRYPTO' },
 { name: '[JP] Tokyo (TYO)', value: 'TYO' },
 { name: '[AU] Australia (ASX)', value: 'ASX' }
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

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const subcommand = interaction.options.getSubcommand();
 const symbol = interaction.options.getString('symbol')?.toUpperCase();

 const getFlag = mkt => mkt === 'NASDAQ' ? '[US]' : mkt === 'NSE' ? '[IN]' : mkt === 'LSE' ? '[UK]' : mkt === 'CRYPTO' ? '<:coin:1512926963239489606>' : mkt === 'TYO' ? '[JP]' : '[AU]';

 try {
 if (subcommand === 'list') {
 const marketFilter = interaction.options.getString('market');

 const markets = {};
 for (const sym of Object.keys(db.STOCK_CATALOG)) {
 const quote = db.getStockPrice(sym);
 if (!quote) continue;
 if (!markets[quote.market]) markets[quote.market] = [];
 markets[quote.market].push(quote);
 }

 if (!marketFilter) {
 let marketSummary = '';
 for (const mkt of ['NASDAQ', 'NSE', 'LSE', 'CRYPTO', 'TYO', 'ASX']) {
 const mktQuotes = markets[mkt] || [];
 if (mktQuotes.length === 0) continue;
 const flag = getFlag(mkt);
 const preview = mktQuotes.slice(0, 3).map(q => {
 const trendIcon = q.changePercent >= 0 ? '' : '';
 return `• **${q.symbol}**: **${q.currency}${q.price.toLocaleString()}** (${trendIcon} \`${q.changePercent >= 0 ? '+' : ''}${q.changePercent}%\`)`;
 }).join('\n');
 const remaining = mktQuotes.length - 3;
 marketSummary += `**${flag} ${mkt}**\n${preview}${remaining > 0 ? `\n*...and ${remaining} more assets.*` : ''}\n\n`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(0xFF007F)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Global Financial Markets Exchange Portal\nStateless, 24/7 deterministic real-time global asset streams.\n\n *Use \`/stock list market:[Market]\` to see all listed assets.*`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(marketSummary))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Fictional simulation — prices do not reflect real markets. Not financial advice.`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 const mkt = marketFilter;
 const mktQuotes = markets[mkt] || [];
 const flag = getFlag(mkt);

 const chunkSize = 10;
 let listStr = '';
 for (const q of mktQuotes) {
 const trendIcon = q.changePercent >= 0 ? '' : '';
 listStr += `• **${q.symbol}** (${q.name})\n Price: **${q.currency}${q.price.toLocaleString()}** | 24h: ${trendIcon} \`${q.changePercent >= 0 ? '+' : ''}${q.changePercent}%\`\n\n`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(0xFF007F)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${flag} ${mkt} Market Assets Directory\nShowing all active real-time listings on the ${mkt} exchange.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(listStr || '*No assets listed.*'))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Fictional simulation — prices do not reflect real markets. Not financial advice.`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'quote') {
 const quote = db.getStockPrice(symbol);
 if (!quote) {
 return interaction.editReply({ content: `Stock symbol **${symbol}** not found in the global catalog.`, ephemeral: true });
 }

 const trendIcon = quote.changePercent >= 0 ? ' ' : ' ';
 const trendText = quote.changePercent >= 0 ? `+${quote.changePercent}%` : `${quote.changePercent}%`;
 const isUp = quote.changePercent >= 0;
 const accentColor = isUp ? 0x00FF66 : 0xFF3333;

 const chartData = db.getStockChartData(symbol);
 const prices = chartData.points.map(p => p.price);
 const labels = chartData.points.map(p => {
 const d = new Date(p.ts);
 return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
 });
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

 const container = new ContainerBuilder()
 .setAccentColor(accentColor)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Market Feed: ${quote.symbol}\n**${quote.name}** — ${getFlag(quote.market)} ${quote.market}`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Current Price:** **${quote.currency}${quote.price.toLocaleString()}**\n` +
 `**24h Change:** **${trendIcon} ${trendText}**\n` +
 `**Reference Price:** ${quote.currency}${quote.basePrice.toLocaleString()}\n` +
 `**Currency:** \`${quote.currency}\`\n` +
 `**Last Updated:** <t:${Math.floor(Date.now() / 1000)}:R>`
 )
 );

 if (chartUrl) {
 container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 container.addMediaGalleryComponents(
 new MediaGalleryBuilder().addItems(
 new MediaGalleryItemBuilder().setURL(chartUrl).setDescription('1-Day Price Chart · 30-min intervals')
 )
 );
 }

 container.addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Fictional simulation — prices do not reflect real markets. Not financial advice.`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'buy') {
 const shares = interaction.options.getNumber('shares');
 const result = await db.buyStock(guild.id, user.id, symbol, shares);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Long-term Stock Purchased!\nSuccessfully purchased shares and added them to your long-term portfolio.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Asset Symbol:** **${result.symbol}**\n` +
 `**Price/Share:** ${result.currency}${result.price.toLocaleString()}\n` +
 `**Shares Bought:** **${result.shares}**\n` +
 `**Total Cost:** <:coin:1512926963239489606> **${result.cost.toLocaleString()}** coins\n` +
 `**Remaining Wallet:** <:coin:1512926963239489606> **${result.newBalance.toLocaleString()}** coins`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Fictional simulation — not financial advice. Prices do not reflect real markets.`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'sell') {
 const shares = interaction.options.getNumber('shares');
 const result = await db.sellStock(guild.id, user.id, symbol, shares);

 const container = new ContainerBuilder()
 .setAccentColor(0xFFCC00)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Stock Position Liquidated!\nSuccessfully liquidated shares from your long-term portfolio.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Asset Symbol:** **${result.symbol}**\n` +
 `**Price/Share:** ${result.currency}${result.price.toLocaleString()}\n` +
 `**Shares Sold:** **${result.shares}**\n` +
 `**Total Revenue:** <:coin:1512926963239489606> **${result.revenue.toLocaleString()}** coins\n` +
 `**New Wallet Balance:** <:coin:1512926963239489606> **${result.newBalance.toLocaleString()}** coins`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Fictional simulation — not financial advice. Prices do not reflect real markets.`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 } catch (err) {
 console.error(`[ERROR] Stock command failed for /stock ${subcommand}:`, err);
 const errMsg = { content: `Transaction failed: ${err.message}`, ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
