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
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const CHAIN_MULTIPLIERS = [1.4, 1.8, 2.4, 3.2, 4.5];

function drawCard() {
 const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
 const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
 return { rank, suit, value: RANK_VALUES[rank], display: `\`[ ${rank}${suit} ]\`` };
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('highlow')
  .setDescription('Guess if the next card is higher or lower. Chain correct guesses for bigger multipliers.')
  .addIntegerOption(opt =>
   opt.setName('bet')
    .setDescription('The amount of coins to wager')
    .setRequired(true)
    .setMinValue(1)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const bet = options.getInteger('bet');

  const cd = await checkCooldown('highlow', user.id, 8);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `High-Low is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
  }

  try {
   const profile = await db.getProfile(guild.id, user.id);
   if (profile.coins < bet) {
    return interaction.editReply({
     content: `Insufficient balance! You only have ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins.`,
     ephemeral: true
    });
   }

   await db.updateCoins(guild.id, user.id, -bet);

   let currentCard = drawCard();
   let chain = 0;

   function buildPanel(status = '', color = 0x8B5CF6, disabled = false) {
    const multiplier = chain < CHAIN_MULTIPLIERS.length ? CHAIN_MULTIPLIERS[chain] : CHAIN_MULTIPLIERS[CHAIN_MULTIPLIERS.length - 1];
    const potentialPayout = Math.floor(bet * multiplier);
    const chainStr = chain > 0 ? ` (Chain **${chain}×**)` : '';

    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## High-Low\n${status || `Current card: ${currentCard.display}\nWill the next card be **Higher** or **Lower**?${chainStr}`}`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `**Bet:** ${EMOJIS.coin} **${bet.toLocaleString()}**\n` +
       `**Next Multiplier:** **${multiplier}×** → ${EMOJIS.coin} **${potentialPayout.toLocaleString()}** payout\n` +
       `-# Max chain: 5 • Tie = draw new card (no chain loss)`
      )
     );

    if (!disabled) {
     container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
       new ButtonBuilder().setCustomId('hl_higher').setLabel('Higher').setStyle(ButtonStyle.Success),
       new ButtonBuilder().setCustomId('hl_lower').setLabel('Lower').setStyle(ButtonStyle.Danger),
       new ButtonBuilder().setCustomId('hl_cashout').setLabel('Cash Out').setStyle(ButtonStyle.Secondary).setDisabled(chain === 0)
      )
     );
    }

    return container;
   }

   const response = await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [buildPanel()],
    fetchReply: true
   });

   const collector = response.createMessageComponentCollector({
    filter: i => i.user.id === user.id,
    time: 60000
   });

   collector.on('collect', async (i) => {
    await i.deferUpdate();

    if (i.customId === 'hl_cashout') {
     collector.stop('cashout');
     return;
    }

    const nextCard = drawCard();
    const guessedHigher = i.customId === 'hl_higher';
    const actuallyHigher = nextCard.value > currentCard.value;
    const isTie = nextCard.value === currentCard.value;

    if (isTie) {
     currentCard = nextCard;
     return i.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildPanel(`Draw! The next card was also ${nextCard.display}. Draw a new card — no chain lost.`, 0xFFCC00)] });
    }

    const correct = guessedHigher === actuallyHigher;

    if (!correct) {
     collector.stop('wrong');
     const lostPanel = new ContainerBuilder()
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(
          `## Wrong!\nYou guessed **${guessedHigher ? 'Higher' : 'Lower'}** but the next card was ${nextCard.display} — **${actuallyHigher ? 'Higher' : 'Lower'}**.\n` +
          `You lost ${EMOJIS.coin} **${bet.toLocaleString()}** coins.`
         )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
      );
     return i.editReply({ flags: MessageFlags.IsComponentsV2, components: [lostPanel] });
    }

    chain++;
    currentCard = nextCard;

    if (chain >= CHAIN_MULTIPLIERS.length) {
     collector.stop('maxchain');
     return;
    }

    await i.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildPanel(`Correct! Next card was ${nextCard.display}. Keep going or cash out!`, 0x00FF99)] });
   });

   collector.on('end', async (_, reason) => {
    if (reason === 'time') {
     await db.updateCoins(guild.id, user.id, bet);
     const panel = buildPanel('**Timed out** — your original bet was refunded.', 0x6B7280, true);
     return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [panel] }).catch(() => {});
    }

    if (reason === 'wrong') return;

    const multiplier = chain > 0 ? CHAIN_MULTIPLIERS[Math.min(chain, CHAIN_MULTIPLIERS.length) - 1] : 1;
    const payout = reason === 'cashout' || reason === 'maxchain' ? Math.floor(bet * multiplier) : bet;
    await db.updateCoins(guild.id, user.id, payout);
    const finalProfile = await db.getProfile(guild.id, user.id);

    const isMaxChain = reason === 'maxchain';
    const title = isMaxChain ? 'MAX CHAIN!' : 'Cashed Out!';
    const msg = isMaxChain
     ? `Max chain reached! Collected ${EMOJIS.coin} **${payout.toLocaleString()}** coins at **${multiplier}×** multiplier!`
     : `Cashed out at chain **${chain}** with **${multiplier}×** multiplier. Won ${EMOJIS.coin} **${payout.toLocaleString()}** coins!`;

    const cashoutPanel = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${title}\n${msg}`)
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Wallet:** ${EMOJIS.coin} **${finalProfile.coins.toLocaleString()}**`)
     );

    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [cashoutPanel] }).catch(() => {});
   });

  } catch (err) {
   console.error('[HIGHLOW ERROR]', err);
   const errMsg = { content: 'Failed to process High-Low game.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
