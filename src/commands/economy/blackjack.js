const {
  SlashCommandBuilder,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

const SUITS = ['', '', '', ''];
const VALUES = [
  { name: '2', val: 2 }, { name: '3', val: 3 }, { name: '4', val: 4 },
  { name: '5', val: 5 }, { name: '6', val: 6 }, { name: '7', val: 7 },
  { name: '8', val: 8 }, { name: '9', val: 9 }, { name: '10', val: 10 },
  { name: 'J', val: 10 }, { name: 'Q', val: 10 }, { name: 'K', val: 10 },
  { name: 'A', val: 11 }
];

function drawCard() {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const cardValue = VALUES[Math.floor(Math.random() * VALUES.length)];
  return { ...cardValue, suit, display: `${cardValue.name}${suit}` };
}

function calculateHand(hand) {
  let sum = hand.reduce((s, c) => s + c.val, 0);
  let aces = hand.filter(c => c.name === 'A').length;
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }
  return sum;
}

function formatHand(hand, hideSecond = false) {
  if (hideSecond) {
    return `\`[ ${hand[0].name}${hand[0].suit} ]\` \`[ Hidden ]\``;
  }
  return hand.map(c => `\`[ ${c.name}${c.suit} ]\``).join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play a high-stakes blackjack card game against Friday (Dealer).')
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setDescription('The amount of coins you want to bet')
        .setRequired(true)
        .setMinValue(1)),

  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) return;

    const bet = options.getInteger('bet');

    const cd = checkCooldown('blackjack', user.id, 10);
    if (cd.onCooldown) {
      return interaction.editReply({ content: `Blackjack is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
    }

    try {
      const profile = await db.getProfile(guild.id, user.id);
      if (profile.coins < bet) {
        return interaction.editReply({
          content: `You do not have enough coins! Your current balance is ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins.`,
          ephemeral: true
        });
      }

      // Deduct the initial bet
      await db.updateCoins(guild.id, user.id, -bet);

      const playerHand = [drawCard(), drawCard()];
      const dealerHand = [drawCard(), drawCard()];

      let playerScore = calculateHand(playerHand);
      let dealerScore = calculateHand(dealerHand);
      let currentBet = bet;
      let isDoubled = false;
      let isSurrendered = false;

      // Check if user has enough coins to double down
      const updatedProfile = await db.getProfile(guild.id, user.id);
      const canDouble = updatedProfile.coins >= bet;

      const hitBtn = new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary);
      const standBtn = new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary);
      const doubleBtn = new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(!canDouble);
      const surrenderBtn = new ButtonBuilder().setCustomId('bj_surrender').setLabel('Surrender').setStyle(ButtonStyle.Danger);

      const buildContainer = (isFinal = false, status = '', color = 0x8b5cf6, customTitle = '') => {
        const title = customTitle || `Blackjack Table`;
        return new ContainerBuilder()
          .setAccentColor(color)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## ${title}\n` +
                  (isFinal ? status : 'Choose to **Hit**, **Stand**, **Double Down** (double your bet for 1 card), or **Surrender** (get half back).')
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
          )
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Your Hand (${playerScore}):** ${formatHand(playerHand)}\n` +
              `**Dealer's Hand (${isFinal ? dealerScore : '?'}):** ${formatHand(dealerHand, !isFinal)}\n\n` +
              `-# Current Bet: ${EMOJIS.coin} ${currentBet.toLocaleString()} coins`
            )
          );
      };

      // Handle natural blackjack on initial deal
      if (playerScore === 21) {
        const payout = Math.floor(bet * 2.5);
        await db.updateCoins(guild.id, user.id, payout);
        return interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [buildContainer(true, `You got a **Natural Blackjack** right off the deal!`, 0x00FF66, `Natural Blackjack!`)]
        });
      }

      const row = new ActionRowBuilder().addComponents(hitBtn, standBtn, doubleBtn, surrenderBtn);
      const initialContainer = buildContainer();
      initialContainer.addActionRowComponents(row);

      const response = await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [initialContainer],
        fetchReply: true
      });

      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === user.id,
        time: 60000
      });

      let turnCount = 0;

      collector.on('collect', async i => {
        await i.deferUpdate();
        turnCount++;

        if (i.customId === 'bj_hit') {
          playerHand.push(drawCard());
          playerScore = calculateHand(playerHand);

          if (playerScore > 21) {
            collector.stop('bust');
          } else if (playerScore === 21) {
            collector.stop('twentyone');
          } else {
            // Hit disables Double Down and Surrender for subsequent turns
            const hitRow = new ActionRowBuilder().addComponents(
              hitBtn,
              standBtn,
              new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(true),
              new ButtonBuilder().setCustomId('bj_surrender').setLabel('Surrender').setStyle(ButtonStyle.Danger).setDisabled(true)
            );
            const updatedContainer = buildContainer();
            updatedContainer.addActionRowComponents(hitRow);
            await i.editReply({ flags: MessageFlags.IsComponentsV2, components: [updatedContainer] });
          }
        } else if (i.customId === 'bj_stand') {
          collector.stop('stand');
        } else if (i.customId === 'bj_double') {
          isDoubled = true;
          currentBet = bet * 2;
          // Deduct the second bet
          await db.updateCoins(guild.id, user.id, -bet);
          playerHand.push(drawCard());
          playerScore = calculateHand(playerHand);
          collector.stop('double');
        } else if (i.customId === 'bj_surrender') {
          isSurrendered = true;
          collector.stop('surrender');
        }
      });

      collector.on('end', async (collected, reason) => {
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(hitBtn).setDisabled(true),
          ButtonBuilder.from(standBtn).setDisabled(true),
          ButtonBuilder.from(doubleBtn).setDisabled(true),
          ButtonBuilder.from(surrenderBtn).setDisabled(true)
        );

        if (reason === 'time') {
          // Refund the bet
          await db.updateCoins(guild.id, user.id, currentBet);
          const timeoutContainer = buildContainer(true, '**Game Timed Out** — your bet has been refunded.', 0x6b7280, `Time Out`);
          timeoutContainer.addActionRowComponents(disabledRow);
          return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [timeoutContainer] }).catch(() => null);
        }

        if (reason === 'surrender') {
          const refund = Math.floor(bet / 2);
          await db.updateCoins(guild.id, user.id, refund);
          const surrenderContainer = buildContainer(true, `You surrendered your hand and lost half of your bet. Returned ${EMOJIS.coin} **${refund.toLocaleString()}** coins.`, 0x71717A, `Surrendered`);
          surrenderContainer.addActionRowComponents(disabledRow);
          return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [surrenderContainer] }).catch(() => null);
        }

        // Play Dealer turn if player didn't bust
        if (playerScore <= 21) {
          while (dealerScore < 17) {
            dealerHand.push(drawCard());
            dealerScore = calculateHand(dealerHand);
          }
        }

        let finalStatus = '';
        let color = 0x8b5cf6;
        let title = 'Game Resolved';

        if (playerScore > 21) {
          finalStatus = `**Bust!** You went over 21 score and lost your bet of ${EMOJIS.coin} **${currentBet.toLocaleString()}** coins.`;
          color = 0xFF3333;
          title = `Bust!`;
        } else if (dealerScore > 21) {
          const winnings = currentBet * 2;
          await db.updateCoins(guild.id, user.id, winnings);
          finalStatus = `**Dealer Bust!** Friday went over 21. You won ${EMOJIS.coin} **${winnings.toLocaleString()}** coins!`;
          color = 0x00FF66;
          title = `Dealer Bust!`;
        } else if (playerScore > dealerScore) {
          const winnings = currentBet * 2;
          await db.updateCoins(guild.id, user.id, winnings);
          finalStatus = `**You Win!** Your score **${playerScore}** beat Friday's **${dealerScore}**. Won ${EMOJIS.coin} **${winnings.toLocaleString()}** coins!`;
          color = 0x00FF66;
          title = `You Win!`;
        } else if (playerScore < dealerScore) {
          finalStatus = `**You Lose!** Friday's score **${dealerScore}** beat your **${playerScore}**. Lost ${EMOJIS.coin} **${currentBet.toLocaleString()}** coins.`;
          color = 0xFF3333;
          title = `You Lose!`;
        } else {
          // Push
          await db.updateCoins(guild.id, user.id, currentBet);
          finalStatus = `**Push!** You and Friday tied at **${playerScore}**. Your bet of ${EMOJIS.coin} **${currentBet.toLocaleString()}** was refunded.`;
          color = 0xFFCC00;
          title = `Push!`;
        }

        const finalContainer = buildContainer(true, finalStatus, color, title);
        finalContainer.addActionRowComponents(disabledRow);
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [finalContainer] }).catch(() => null);
      });

    } catch (err) {
      console.error('[BLACKJACK ERROR]', err);
      const errMsg = { content: 'Failed to process Blackjack game.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
      else await interaction.editReply(errMsg).catch(() => null);
    }
  }
};
