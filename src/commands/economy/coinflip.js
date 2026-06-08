const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS, EMOJI_IDS } = require('../../utils/emojis');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('coinflip')
 .setDescription('Flip a coin — pick Heads or Tails and optionally bet coins on it.')
 .addIntegerOption(opt =>
 opt.setName('bet')
 .setDescription('Coins to wager on the flip')
 .setRequired(false)
 .setMinValue(1)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 const bet = options.getInteger('bet') ?? 0;

 if (bet > 0) {
 const cd = checkCooldown('coinflip', user.id, 5);
 if (cd.onCooldown) {
 return interaction.editReply({ content: `Coinflip is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
 }

 if (guild) {
 const profile = await db.getProfile(guild.id, user.id);
 if (profile.coins < bet) {
 return interaction.editReply({
 content: `Not enough coins! Balance: ${EMOJIS.coin} **${profile.coins.toLocaleString()}**`,
 ephemeral: true
 });
 }
 await db.updateCoins(guild.id, user.id, -bet);
 }
 }

 const headsBtn = new ButtonBuilder().setCustomId('cf_heads').setLabel('Heads').setEmoji(EMOJI_IDS.coin).setStyle(ButtonStyle.Primary);
 const tailsBtn = new ButtonBuilder().setCustomId('cf_tails').setLabel('Tails').setStyle(ButtonStyle.Secondary);
 const skipBtn = new ButtonBuilder().setCustomId('cf_skip').setLabel('Just Flip').setStyle(ButtonStyle.Secondary);

 const betLine = bet > 0 ? `\n${EMOJIS.coin} **${bet.toLocaleString()} coins** on the line!` : '';

 const promptContainer = new ContainerBuilder()
 .setAccentColor(0xFFD700)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${EMOJIS.coin} Coin Flip\nMake your call before the flip, or just watch it land!${betLine}`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Choose within 20 seconds'))
 .addActionRowComponents(new ActionRowBuilder().addComponents(headsBtn, tailsBtn, skipBtn));

 const response = await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [promptContainer]
 });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 20000,
 max: 1
 });

 collector.on('collect', async i => {
 await i.deferUpdate();

 const guess = i.customId === 'cf_skip' ? null : i.customId.replace('cf_', '');
 const result = Math.random() < 0.5 ? 'heads' : 'tails';
 const resultEmoji = result === 'heads' ? EMOJIS.coin : '';
 const resultLabel = result.charAt(0).toUpperCase() + result.slice(1);

 let color = 0xFFD700;
 let outcomeText = `${resultEmoji} The coin landed on **${resultLabel}**!`;
 let coinDelta = 0;

 if (guess) {
 const won = guess === result;
 if (bet > 0 && guild) {
 if (won) {
 coinDelta = bet * 2;
 await db.updateCoins(guild.id, user.id, coinDelta);
 }
 }
 const guessLabel = guess.charAt(0).toUpperCase() + guess.slice(1);
 if (won) {
 outcomeText += `\n\n You called **${guessLabel}** — **You win!**`;
 if (bet > 0) outcomeText += `\n${EMOJIS.coin} **+${coinDelta.toLocaleString()} coins**`;
 color = 0x00FF66;
 } else {
 outcomeText += `\n\n You called **${guessLabel}** — **Better luck next time!**`;
 if (bet > 0) outcomeText += `\n${EMOJIS.coin} **-${bet.toLocaleString()} coins**`;
 color = 0xFF3333;
 }
 } else if (bet > 0 && guild) {
 await db.updateCoins(guild.id, user.id, bet);
 outcomeText += `\n\n No guess — bet refunded.`;
 }

 let balanceLine = '';
 if (bet > 0 && guild) {
 const profile = await db.getProfile(guild.id, user.id);
 balanceLine = `\n Balance: ${EMOJIS.coin} **${profile.coins.toLocaleString()}**`;
 }

 const disabledHeads = ButtonBuilder.from(headsBtn).setDisabled(true).setStyle(guess === 'heads' ? ButtonStyle.Primary : ButtonStyle.Secondary);
 const disabledTails = ButtonBuilder.from(tailsBtn).setDisabled(true).setStyle(guess === 'tails' ? ButtonStyle.Primary : ButtonStyle.Secondary);
 const disabledSkip = ButtonBuilder.from(skipBtn).setDisabled(true);

 const resultContainer = new ContainerBuilder()
 .setAccentColor(color)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## ${EMOJIS.coin} Coin Flip Result\n${outcomeText}${balanceLine}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(disabledHeads, disabledTails, disabledSkip)
 );

 await i.editReply({ flags: MessageFlags.IsComponentsV2, components: [resultContainer] });
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 if (bet > 0 && guild) await db.updateCoins(guild.id, user.id, bet);
 const timeoutContainer = new ContainerBuilder()
 .setAccentColor(0x6b7280)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent('Timed out — bet refunded.')
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(
 ButtonBuilder.from(headsBtn).setDisabled(true),
 ButtonBuilder.from(tailsBtn).setDisabled(true),
 ButtonBuilder.from(skipBtn).setDisabled(true)
 )
 );
 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [timeoutContainer] }).catch(() => null);
 }
 });
 }
};
