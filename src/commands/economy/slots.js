const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const SYMBOLS = ['7️⃣', '🎰', '💎', '🍒', '⭐', '🔔', '🍇'];

module.exports = {
 data: new SlashCommandBuilder()
 .setName('slots')
 .setDescription('Spin the virtual slot machine to win big coin multipliers.')
 .addIntegerOption(opt =>
 opt.setName('bet')
 .setDescription('The amount of coins you want to bet')
 .setRequired(true)
 .setMinValue(1)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const bet = options.getInteger('bet');

 const cd = checkCooldown('slots', user.id, 5);
 if (cd.onCooldown) {
 return interaction.editReply({ content: `Slots is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
 }

 try {
 const profile = await db.getProfile(guild.id, user.id);
 if (profile.coins < bet) {
 return interaction.editReply({
 content: `You do not have enough coins! Your current balance is <:coin:1512926963239489606> **${profile.coins.toLocaleString()}** coins.`,
 ephemeral: true
 });
 }

 await db.updateCoins(guild.id, user.id, -bet);

 const reel1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
 const reel2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
 const reel3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

 let multiplier = 0;
 let winStatus = '';

 if (reel1 === reel2 && reel2 === reel3) {
 if (reel1 === SYMBOLS[0]) { multiplier = 10; winStatus = '**MEGA JACKPOT!** Triple 7s!'; }
 else if (reel1 === SYMBOLS[2]) { multiplier = 8; winStatus = '**SUPER JACKPOT!** Triple Gems!'; }
 else { multiplier = 5; winStatus = '**TRIPLE JACKPOT!**'; }
 } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
 multiplier = 2;
 winStatus = '**DOUBLE WIN!**';
 } else {
 winStatus = '**YOU LOSE.** Better luck next spin.';
 }

 let winnings = bet * multiplier;
 if (winnings > 0) await db.updateCoins(guild.id, user.id, winnings);

 const finalBalance = await db.getProfile(guild.id, user.id);
 const isWin = winnings > 0;

 const container = new ContainerBuilder()
 .setAccentColor(isWin ? 0xFFD700 : 0xFF3333)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Slot Machine\n### ${reel1} | ${reel2} | ${reel3}\n\n${winStatus}`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Your Bet:** <:coin:1512926963239489606> **${bet.toLocaleString()}** coins\n` +
 `**Payout:** ${isWin ? `<:coin:1512926963239489606> **+${winnings.toLocaleString()}**` : '<:coin:1512926963239489606> **0**'}\n` +
 `**Wallet:** <:coin:1512926963239489606> **${finalBalance.coins.toLocaleString()}**`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent('-# Match 2 for 2×, Match 3 for 5×, / for Mega Jackpots!')
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[SLOTS ERROR]', err);
 const errMsg = { content: 'Failed to process Slots game.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
