const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
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
 { name: ' LONG (Bullish)', value: 'LONG' },
 { name: ' SHORT (Bearish)', value: 'SHORT' }
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

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const subcommand = interaction.options.getSubcommand();
 const targetUser = interaction.options.getUser('user') || user;

 if (targetUser.bot) {
 return interaction.editReply({ content: 'Bots do not trade or hold assets.', ephemeral: true });
 }

 try {
 if (subcommand === 'view') {
 const stocksData = await db.getUserStocksTotalValue(guild.id, targetUser.id);
 const intradayData = await db.getUserIntradayTotalValue(guild.id, targetUser.id);

 let stocksStr = '';
 if (stocksData.holdings.length > 0) {
 for (const h of stocksData.holdings) {
 const sign = h.pnl >= 0 ? '+' : '';
 const pnlColor = h.pnl >= 0 ? ' `+' : ' `';
 stocksStr += `• **${h.symbol}** (${h.market})\n Shares: \`${h.shares.toFixed(3)}\` | Avg: \`${h.currency}${h.averageBuyPrice.toFixed(2)}\` | Cur: \`${h.currency}${h.currentPrice.toFixed(2)}\`\n PnL: ${pnlColor}${h.pnl.toFixed(2)} (${sign}${h.pnlPercent.toFixed(2)}%)\` | Value: **${h.currency}${h.currentValue.toFixed(2)}**\n\n`;
 }
 } else {
 stocksStr = '*No active long-term investments. Buy stocks using `/stock buy`.*\n\n';
 }

 let intradayStr = '';
 if (intradayData.positions.length > 0) {
 for (const p of intradayData.positions) {
 const sign = p.pnl >= 0 ? '+' : '';
 const pnlColor = p.pnl >= 0 ? ' `+' : ' `';
 const typeEmoji = p.type === 'LONG' ? '' : '';
 intradayStr += `• **${p.symbol}** | ${typeEmoji} **${p.type}** (${p.leverage}x)\n Margin: \`${EMOJIS.coin} ${p.margin.toLocaleString()}\` | Entry: \`${p.currency}${p.entryPrice.toFixed(2)}\` | Cur: \`${p.currency}${p.currentPrice.toFixed(2)}\`\n PnL: ${pnlColor}${p.pnl.toFixed(2)} (${sign}${p.pnlPercent.toFixed(2)}%)\` | Return: **${EMOJIS.coin} ${p.currentValue.toFixed(2)}**\n\n`;
 }
 } else {
 intradayStr = '*No active intraday positions. Open trades using `/portfolio open`.*\n\n';
 }

 const totalCost = (stocksData.totalCost || 0) + (intradayData.totalMargin || 0);
 const totalValue = (stocksData.totalValue || 0) + (intradayData.totalValue || 0);
 const overallPnL = totalValue - totalCost;
 const overallPnLPercent = totalCost > 0 ? (overallPnL / totalCost) * 100 : 0;
 const pnlSign = overallPnL >= 0 ? '+' : '';

 const summaryText =
 `• Total Invested: **${EMOJIS.coin} ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** coins\n` +
 `• Current Value: **${EMOJIS.coin} ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** coins\n` +
 `• Unrealized PnL: **${overallPnL >= 0 ? '' : ''} ${pnlSign}${overallPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pnlSign}${overallPnLPercent.toFixed(2)}%)**`;

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Asset Portfolio\n${targetUser.username}'s investment holdings and active trades.`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Long-term Investments**\n${stocksStr}`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Leveraged Intraday Trades (5x)**\n${intradayStr}`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Portfolio Summary**\n${summaryText}`)
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `-# Fictional simulation — prices do not reflect real markets. Not financial advice.`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'open') {
 if (targetUser.id !== user.id) {
 return interaction.editReply({ content: 'You can only open intraday positions for yourself.', ephemeral: true });
 }

 const type = interaction.options.getString('type');
 const symbol = interaction.options.getString('symbol').toUpperCase();
 const margin = interaction.options.getInteger('margin');

 const result = await db.openIntradayPosition(guild.id, user.id, symbol, type, margin, 5);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Leveraged Position Opened!\nYou opened a **5x leveraged ${type}** on **${result.symbol}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Symbol:** **${result.symbol}**\n` +
 `**Order Type:** ${result.type === 'LONG' ? ' LONG' : ' SHORT'}\n` +
 `**Leverage:** **${result.leverage}x**\n` +
 `**Margin Collateral:** ${EMOJIS.coin} **${result.margin.toLocaleString()}** coins\n` +
 `**Entry Price:** ${result.currency}${result.entryPrice.toLocaleString()}\n` +
 `**Position Size:** \`${result.shares.toFixed(4)}\` shares`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `-# Leveraged trading amplifies both profits and losses. Fictional simulation — not financial advice.`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'close') {
 if (targetUser.id !== user.id) {
 return interaction.editReply({ content: 'You can only close intraday positions for yourself.', ephemeral: true });
 }

 const symbol = interaction.options.getString('symbol').toUpperCase();
 const result = await db.closeIntradayPosition(guild.id, user.id, symbol);

 const pnlSign = result.pnl >= 0 ? '+' : '';
 const pnlPercent = (result.pnl / result.margin) * 100;
 const accentColor = result.pnl >= 0 ? 0x00FF66 : 0xFF3333;

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${result.pnl >= 0 ? '' : ''} Position Settled: ${result.symbol}\nYour leveraged position has been closed and PnL settled.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Symbol:** **${result.symbol}**\n` +
 `**Order Type:** ${result.type === 'LONG' ? ' LONG' : ' SHORT'}\n` +
 `**Entry Price:** ${result.currency}${result.entryPrice.toFixed(2)}\n` +
 `**Settlement Price:** ${result.currency}${result.exitPrice.toFixed(2)}\n` +
 `**Initial Margin:** ${EMOJIS.coin} **${result.margin.toLocaleString()}** coins\n` +
 `**Realized PnL:** **${result.pnl >= 0 ? '' : ''} ${pnlSign}${result.pnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(2)}%)**\n` +
 `**Cash Returned:** ${EMOJIS.coin} **${result.totalReturn.toFixed(2)}** coins\n` +
 `**New Wallet:** ${EMOJIS.coin} **${result.newBalance.toLocaleString()}** coins`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `-# Settlement proceeds immediately updated in your wallet. · Fictional simulation — not financial advice.`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 } catch (err) {
 console.error(`[ERROR] Portfolio command failed for /portfolio ${subcommand}:`, err);
 const errMsg = { content: `Transaction failed: ${err.message}`, ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
