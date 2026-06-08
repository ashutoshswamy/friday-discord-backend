const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

function formatTimeRemaining(ms) {
 if (ms <= 0) return 'Drawing now...';
 const seconds = Math.floor((ms / 1000) % 60);
 const minutes = Math.floor((ms / (1000 * 60)) % 60);
 const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

 let timeStr = '';
 if (hours > 0) timeStr += `${hours}h `;
 if (minutes > 0 || hours > 0) timeStr += `${minutes}m `;
 timeStr += `${seconds}s`;
 return timeStr;
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('lottery')
  .setDescription('Participate in the global server daily lottery jackpot.')
  .addSubcommand(sub =>
   sub.setName('view')
    .setDescription('View the current lottery pool, ticket counts, and past winner.')
  )
  .addSubcommand(sub =>
   sub.setName('buy')
    .setDescription('Purchase lottery tickets to enter the jackpot draw.')
    .addIntegerOption(opt =>
     opt.setName('amount')
      .setDescription('The number of tickets to purchase (100 coins each)')
      .setRequired(true)
      .setMinValue(1)
    )
  )
  .addSubcommand(sub =>
   sub.setName('draw')
    .setDescription('Force draw the lottery immediately (Administrator only).')
  ),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const subcommand = options.getSubcommand();

  try {
   if (subcommand === 'view') {
    const state = await db.getLotteryState(guild.id, user.id);
    const { config, userTickets, totalTickets, lastWinner, drawResult } = state;

    let drawAlert = '';
    if (drawResult) {
     if (drawResult.rolledOver) {
      drawAlert = ` **Daily Draw Completed:** No tickets were purchased. The jackpot rolled over to ${EMOJIS.coin} **${drawResult.jackpotWon.toLocaleString()}** coins!\n\n`;
     } else {
      drawAlert = ` **Daily Draw Completed:** <@${drawResult.winnerId}> won the jackpot of ${EMOJIS.coin} **${drawResult.jackpotWon.toLocaleString()}** coins! Congratulations!\n\n`;
     }
    }

    const elapsed = Date.now() - new Date(config.lastDraw).getTime();
    const remainingMs = 86400000 - elapsed;
    const timeRemainingText = formatTimeRemaining(remainingMs);

    const winChance = totalTickets > 0 ? ((userTickets / totalTickets) * 100).toFixed(2) : '0.00';

    let lastWinText = 'No draws have occurred yet.';
    if (lastWinner) {
     lastWinText = ` <@${lastWinner.winnerId}> won ${EMOJIS.coin} **${lastWinner.jackpotWon.toLocaleString()}** coins (<t:${Math.floor(lastWinner.drawDate.getTime() / 1000)}:R>)`;
    }

    const container = new ContainerBuilder()
     .setAccentColor(0xFFD700) // Gold
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## ️ Friday Daily Lottery\n` +
          `${drawAlert}` +
          `Purchase tickets to increase your chances of winning the server-wide jackpot! Each ticket contributes directly to the total prize pool.\n\n` +
          `• **Current Jackpot:** ${EMOJIS.coin} **${config.jackpot.toLocaleString()}** coins\n` +
          `• **Ticket Cost:** ${EMOJIS.coin} **${config.ticketCost}** coins\n` +
          `• **Time Until Draw:** **${timeRemainingText}**\n\n` +
          `• **Your Tickets:** **${userTickets}** purchased (Odds: **${winChance}%**)\n` +
          `• **Total Tickets Sold:** **${totalTickets}** tickets\n\n` +
          `**Last Winner:**\n${lastWinText}`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Buy tickets using `/lottery buy amount:<quantity>`'));

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'buy') {
    const amount = options.getInteger('amount');
    const result = await db.buyLotteryTickets(guild.id, user.id, amount);

    if (!result.success) {
     return interaction.editReply({
      content: `Purchase failed: ${result.reason || 'Insufficient coins in wallet.'}`,
      ephemeral: true
     });
    }

    const container = new ContainerBuilder()
     .setAccentColor(0x2ECC71) // Success Green
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## ️ Tickets Purchased!\n` +
          `You successfully entered the Friday Daily Lottery draw!\n\n` +
          `• **Tickets Bought:** **${amount}** tickets\n` +
          `• **Cost Deducted:** ${EMOJIS.coin} **${result.costPaid.toLocaleString()}** coins\n` +
          `• **New Jackpot Pool:** ${EMOJIS.coin} **${result.newJackpot.toLocaleString()}** coins`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'draw') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
     return interaction.editReply({ content: 'Only server Administrators can force draw the lottery jackpot.', ephemeral: true });
    }
    const drawResult = await db.drawLottery(guild.id);

    if (drawResult.rolledOver) {
     const container = new ContainerBuilder()
      .setAccentColor(0x34495E) // Dark blue/gray
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## ️ Lottery Draw Results\n` +
         `No tickets were purchased for this draw. The jackpot of ${EMOJIS.coin} **${drawResult.jackpotWon.toLocaleString()}** coins rolled over to the next round.`
       )
      );
     return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
    }

    const container = new ContainerBuilder()
     .setAccentColor(0x00FF66)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## ️ Lottery Draw Results\n` +
          `The lottery has been drawn! Congratulations to the winner!\n\n` +
          `• **Winner:** <@${drawResult.winnerId}>\n` +
          `• **Jackpot Won:** ${EMOJIS.coin} **${drawResult.jackpotWon.toLocaleString()}** coins`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

  } catch (err) {
   console.error('[LOTTERY ERROR]', err);
   const errMsg = { content: 'Failed to execute lottery operation.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
