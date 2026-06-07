const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle,
 StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
 MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function spinWheel() {
 const num = Math.floor(Math.random() * 37);
 let color = 'green';
 if (RED_NUMBERS.includes(num)) color = 'red';
 if (BLACK_NUMBERS.includes(num)) color = 'black';
 return { num, color };
}

function calcWinnings(bet, betType, betTarget, rolled) {
 if (betType === 'COLOR') {
 if (betTarget === rolled.color) return bet * (rolled.color === 'green' ? 35 : 2);
 } else {
 if (betTarget === rolled.num) return bet * 35;
 }
 return 0;
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('roulette')
 .setDescription('Place a bet on the virtual roulette wheel.')
 .addIntegerOption(opt =>
 opt.setName('bet')
 .setDescription('Amount of coins to bet')
 .setRequired(true)
 .setMinValue(1))
 .addStringOption(opt =>
 opt.setName('space')
 .setDescription('Where to place your bet: red, black, green, or a number 0–36 (leave blank for interactive)')
 .setRequired(false)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const bet = options.getInteger('bet');
 const spaceArg = options.getString('space')?.trim().toLowerCase();

 const cd = checkCooldown('roulette', user.id, 5);
 if (cd.onCooldown) {
 return interaction.editReply({ content: `Roulette is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
 }

 const buildResultContainer = (rolled, betLabel, winnings, isWin, finalCoins) => {
 const colorSquare = rolled.color === 'red' ? '' : rolled.color === 'black' ? '' : '';
 return new ContainerBuilder()
 .setAccentColor(isWin ? 0x00FF66 : 0xFF3333)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Roulette Result\n` +
 `The ball lands on ${colorSquare} **${rolled.num} (${rolled.color.toUpperCase()})**\n\n` +
 (isWin ? `**Win!** Your bet on **${betLabel}** paid out!` : `**Loss.** Your bet on **${betLabel}** missed.`)
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Bet Space:** \`${betLabel}\`\n` +
 `**Bet Amount:** <:coin:1512926963239489606> **${bet.toLocaleString()}**\n` +
 `**Payout:** ${isWin ? `<:coin:1512926963239489606> **+${winnings.toLocaleString()}**` : '<:coin:1512926963239489606> **0**'}\n` +
 `**Wallet:** <:coin:1512926963239489606> **${finalCoins.toLocaleString()}**`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent('-# Red (2×) | Black (2×) | Green (35×) | Number (35×)')
 );
 };

 try {
 const profile = await db.getProfile(guild.id, user.id);
 if (profile.coins < bet) {
 return interaction.editReply({
 content: `Insufficient coins. Your wallet has <:coin:1512926963239489606> **${profile.coins.toLocaleString()}** coins.`,
 ephemeral: true
 });
 }

 if (spaceArg) {
 let betType, betTarget;
 if (['red', 'black', 'green'].includes(spaceArg)) {
 betType = 'COLOR'; betTarget = spaceArg;
 } else {
 const n = parseInt(spaceArg);
 if (isNaN(n) || n < 0 || n > 36) {
 return interaction.editReply({ content: 'Invalid bet space. Use `red`, `black`, `green`, or a number `0–36`.', ephemeral: true });
 }
 betType = 'NUMBER'; betTarget = n;
 }

 await db.updateCoins(guild.id, user.id, -bet);
 const rolled = spinWheel();
 const winnings = calcWinnings(bet, betType, betTarget, rolled);
 if (winnings > 0) await db.updateCoins(guild.id, user.id, winnings);

 const finalBalance = await db.getProfile(guild.id, user.id);
 return interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [buildResultContainer(rolled, spaceArg.toUpperCase(), winnings, winnings > 0, finalBalance.coins)]
 });
 }

 const redBtn = new ButtonBuilder().setCustomId('rl_red').setLabel('Red (2×)').setStyle(ButtonStyle.Danger);
 const blackBtn = new ButtonBuilder().setCustomId('rl_black').setLabel('Black (2×)').setStyle(ButtonStyle.Secondary);
 const greenBtn = new ButtonBuilder().setCustomId('rl_green').setLabel('Green (35×)').setStyle(ButtonStyle.Success);

 const numberOptions = Array.from({ length: 37 }, (_, n) => ({
 label: `${n === 0 ? '[G]' : RED_NUMBERS.includes(n) ? '[R]' : '[B]'} Number ${n}`,
 value: `num_${n}`,
 description: `${n === 0 ? 'Green' : RED_NUMBERS.includes(n) ? 'Red' : 'Black'} — Pays 35×`
 }));

 const numberSelect = new StringSelectMenuBuilder()
 .setCustomId('rl_number')
 .setPlaceholder('Or pick a specific number (0–24)...')
 .addOptions(numberOptions.slice(0, 25).map(o =>
 new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setDescription(o.description)
 ));

 const numberSelect2 = new StringSelectMenuBuilder()
 .setCustomId('rl_number2')
 .setPlaceholder('Numbers 25–36...')
 .addOptions(numberOptions.slice(25).map(o =>
 new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setDescription(o.description)
 ));

 const promptContainer = new ContainerBuilder()
 .setAccentColor(0x8b5cf6)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Roulette Table\n**Bet:** <:coin:1512926963239489606> **${bet.toLocaleString()}** coins\n\n` +
 `Choose a color or pick a specific number to place your bet.\n` +
 `Red / Black pays **2×** · Green / Numbers pay **35×**`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# You have 30 seconds to place your bet'))
 .addActionRowComponents(new ActionRowBuilder().addComponents(redBtn, blackBtn, greenBtn))
 .addActionRowComponents(new ActionRowBuilder().addComponents(numberSelect))
 .addActionRowComponents(new ActionRowBuilder().addComponents(numberSelect2));

 const response = await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [promptContainer]
 });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 30000,
 max: 1
 });

 collector.on('collect', async i => {
 await i.deferUpdate();

 let betType, betTarget, betLabel;
 if (['rl_red', 'rl_black', 'rl_green'].includes(i.customId)) {
 betType = 'COLOR';
 betTarget = i.customId.replace('rl_', '');
 betLabel = betTarget.toUpperCase();
 } else {
 const numStr = (i.values[0]).replace('num_', '');
 betType = 'NUMBER';
 betTarget = parseInt(numStr);
 betLabel = `Number ${betTarget}`;
 }

 await db.updateCoins(guild.id, user.id, -bet);
 const rolled = spinWheel();
 const winnings = calcWinnings(bet, betType, betTarget, rolled);
 if (winnings > 0) await db.updateCoins(guild.id, user.id, winnings);

 const finalBalance = await db.getProfile(guild.id, user.id);
 await i.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [buildResultContainer(rolled, betLabel, winnings, winnings > 0, finalBalance.coins)]
 });
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 await interaction.editReply({
 content: 'No bet placed. The table has cleared.',
 flags: MessageFlags.IsComponentsV2,
 components: []
 }).catch(() => null);
 }
 });

 } catch (err) {
 console.error('[ROULETTE ERROR]', err);
 const errMsg = { content: 'Failed to process Roulette game.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
