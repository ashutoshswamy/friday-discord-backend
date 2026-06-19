const {
  SlashCommandBuilder,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cockfight')
    .setDescription('Bet your server coins on a high-stakes cockfight arena simulation.')
    .addIntegerOption(opt =>
      opt.setName('bet')
        .setDescription('The amount of coins you want to bet')
        .setRequired(true)
        .setMinValue(1)),

  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) return;

    const bet = options.getInteger('bet');

    const cd = await checkCooldown('cockfight', user.id, 8);
    if (cd.onCooldown) {
      return interaction.editReply({ content: `Cockfight is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
    }

    try {
      const profile = await db.getProfile(guild.id, user.id);
      if (profile.coins < bet) {
        return interaction.editReply({
          content: `You do not have enough coins! Your current balance is ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins.`,
          ephemeral: true
        });
      }

      await db.updateCoins(guild.id, user.id, -bet);

      const playerBirdNames = ['Spitfire', 'Diablo', 'Thunderbolt', 'Razorclaw', 'Titan', 'Zeus', 'Rogue'];
      const opponentBirdNames = ['Apex', 'Viper', 'Doom', 'Shadow', 'Slayer', 'Gladiator', 'Havoc'];

      const playerBird = playerBirdNames[Math.floor(Math.random() * playerBirdNames.length)];
      const opponentBird = opponentBirdNames[Math.floor(Math.random() * opponentBirdNames.length)];

      const winScripts = [
        `**${playerBird}** enters the dust-cloud, delivering a devastating flying kick! **${opponentBird}** retreats in absolute defeat.`,
        `After a gruelling 3-minute peck-off, **${playerBird}** lands a powerful headstrike. The opponent **${opponentBird}** collapses in fatigue.`,
        `**${playerBird}** displays incredible agility, dodging a tail-swipe and counter-striking with razor claws! **${opponentBird}** flees the pit.`
      ];

      const loseScripts = [
        `**${opponentBird}** strikes first with blinding speed! Your bird **${playerBird}** is knocked out of the ring.`,
        `**${playerBird}** put up a heroic struggle, but **${opponentBird}** dominated the high ground and forced your bird to submit.`,
        `A sudden slip in the mud leaves **${playerBird}** vulnerable! **${opponentBird}** seizes the opportunity for a swift knockdown.`
      ];

      const isWin = Math.random() < 0.50;
      let multiplier = 0;

      if (isWin) {
        multiplier = parseFloat((Math.random() * 0.6 + 1.6).toFixed(2));
      }

      const finalStatus = isWin
        ? winScripts[Math.floor(Math.random() * winScripts.length)]
        : loseScripts[Math.floor(Math.random() * loseScripts.length)];

      let winnings = Math.floor(bet * multiplier);
      if (winnings > 0) await db.updateCoins(guild.id, user.id, winnings);

      const finalBalance = await db.getProfile(guild.id, user.id);

      const arenaTitle = 'Cockfight Arena';

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## ${arenaTitle}\n### ${playerBird} vs ${opponentBird} \n\n${finalStatus}\n\n` +
                (isWin ? `**Victory!** You won **${multiplier}×** your bet!` : `**Defeat!** You lost your entire bet.`)
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Your Fighter:** **${playerBird}**\n` +
            `**Your Bet:** ${EMOJIS.coin} **${bet.toLocaleString()}** coins\n` +
            `**Payout:** ${winnings > 0 ? `${EMOJIS.coin} **+${winnings.toLocaleString()}**` : `${EMOJIS.coin} **0**`}\n` +
            `**Wallet:** ${EMOJIS.coin} **${finalBalance.coins.toLocaleString()}** coins`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# High stakes cockfight arena matches. 50% chance of win or loss.')
        );

      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

    } catch (err) {
      console.error('[COCKFIGHT ERROR]', err);
      const errMsg = { content: 'Failed to process Cockfight game.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
      else await interaction.editReply(errMsg).catch(() => null);
    }
  }
};
