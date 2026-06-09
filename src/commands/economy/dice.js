const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

const DICE_FACES = ['1', '2', '3', '4', '5', '6'];

function rollDie() {
 const value = Math.floor(Math.random() * 6) + 1;
 return { value, face: DICE_FACES[value - 1] };
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll two dice against Friday. Highest total wins.')
  .addIntegerOption(opt =>
   opt.setName('bet')
    .setDescription('The amount of coins to wager')
    .setRequired(true)
    .setMinValue(1)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const bet = options.getInteger('bet');

  const cd = checkCooldown('dice', user.id, 5);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `Dice is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
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

   const [p1, p2] = [rollDie(), rollDie()];
   const [d1, d2] = [rollDie(), rollDie()];
   const playerTotal = p1.value + p2.value;
   const dealerTotal = d1.value + d2.value;

   let resultText, color, payout;

   if (playerTotal > dealerTotal) {
    payout = bet * 2;
    await db.updateCoins(guild.id, user.id, payout);
    resultText = `**You Win!** Your **${playerTotal}** beat Friday's **${dealerTotal}**. Won ${EMOJIS.coin} **${payout.toLocaleString()}** coins!`;
    color = 0x00FF66;
   } else if (playerTotal < dealerTotal) {
    payout = 0;
    resultText = `**You Lose!** Friday's **${dealerTotal}** beat your **${playerTotal}**. Lost ${EMOJIS.coin} **${bet.toLocaleString()}** coins.`;
    color = 0xFF3333;
   } else {
    payout = bet;
    await db.updateCoins(guild.id, user.id, bet);
    resultText = `**Tie!** Both rolled **${playerTotal}**. Your bet of ${EMOJIS.coin} **${bet.toLocaleString()}** was refunded.`;
    color = 0xFFCC00;
   }

   const finalProfile = await db.getProfile(guild.id, user.id);

   const container = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## Dice Roll\n${resultText}`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**Your Roll:** ${p1.face} ${p2.face} — **${playerTotal}**\n` +
      `**Friday's Roll:** ${d1.face} ${d2.face} — **${dealerTotal}**\n\n` +
      `**Wallet:** ${EMOJIS.coin} **${finalProfile.coins.toLocaleString()}**`
     )
    )
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent('-# Roll higher to win 2× your bet • Tie returns your bet')
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[DICE ERROR]', err);
   const errMsg = { content: 'Failed to process dice roll.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
