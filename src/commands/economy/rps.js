const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const CHOICES = {
 rock: { label: '🪨 Rock', beats: 'scissors' },
 paper: { label: '📄 Paper', beats: 'rock' },
 scissors: { label: '✂️ Scissors', beats: 'paper' },
};

module.exports = {
 data: new SlashCommandBuilder()
 .setName('rps')
 .setDescription('Play Rock, Paper, Scissors against Friday. Optionally bet coins.')
 .addIntegerOption(opt =>
 opt.setName('bet')
 .setDescription('Coins to wager on the match')
 .setRequired(false)
 .setMinValue(1)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 const bet = options.getInteger('bet') ?? 0;

 if (bet > 0) {
 const cd = checkCooldown('rps', user.id, 5);
 if (cd.onCooldown) {
 return interaction.editReply({ content: `RPS is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
 }

 if (guild) {
 const profile = await db.getProfile(guild.id, user.id);
 if (profile.coins < bet) {
 return interaction.editReply({
 content: `Not enough coins! Balance: <:coin:1512926963239489606> **${profile.coins.toLocaleString()}**`,
 ephemeral: true
 });
 }
 await db.updateCoins(guild.id, user.id, -bet);
 }
 }

 const rock = new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 Rock').setStyle(ButtonStyle.Secondary);
 const paper = new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 Paper').setStyle(ButtonStyle.Secondary);
 const scissors = new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ Scissors').setStyle(ButtonStyle.Secondary);

 const betLine = bet > 0 ? `\n<:coin:1512926963239489606> **${bet.toLocaleString()} coins** on the line!` : '';

 const promptContainer = new ContainerBuilder()
 .setAccentColor(0x8b5cf6)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Rock · Paper · Scissors\n**${user.username}**, make your move!${betLine}`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# You have 30 seconds to choose'))
 .addActionRowComponents(new ActionRowBuilder().addComponents(rock, paper, scissors));

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

 const playerChoice = i.customId.replace('rps_', '');
 const botChoice = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];
 const playerData = CHOICES[playerChoice];
 const botData = CHOICES[botChoice];

 let resultText, color;
 let coinDelta = 0;

 if (playerChoice === botChoice) {
 resultText = "It's a **Tie**!";
 color = 0x94a3b8;
 if (bet > 0 && guild) {
 await db.updateCoins(guild.id, user.id, bet);
 resultText += '\n↩ Bet refunded.';
 }
 } else if (playerData.beats === botChoice) {
 resultText = 'You **Win**!';
 color = 0x00FF66;
 if (bet > 0 && guild) {
 coinDelta = bet * 2;
 await db.updateCoins(guild.id, user.id, coinDelta);
 resultText += `\n<:coin:1512926963239489606> **+${coinDelta.toLocaleString()} coins**`;
 }
 } else {
 resultText = 'You **Lose**!';
 color = 0xFF3333;
 if (bet > 0) resultText += `\n<:coin:1512926963239489606> **-${bet.toLocaleString()} coins**`;
 }

 let balanceLine = '';
 if (bet > 0 && guild) {
 const profile = await db.getProfile(guild.id, user.id);
 balanceLine = `\nBalance: <:coin:1512926963239489606> **${profile.coins.toLocaleString()}**`;
 }

 const disabledRow = new ActionRowBuilder().addComponents(
 ButtonBuilder.from(rock).setDisabled(true).setStyle(playerChoice === 'rock' ? ButtonStyle.Primary : ButtonStyle.Secondary),
 ButtonBuilder.from(paper).setDisabled(true).setStyle(playerChoice === 'paper' ? ButtonStyle.Primary : ButtonStyle.Secondary),
 ButtonBuilder.from(scissors).setDisabled(true).setStyle(playerChoice === 'scissors' ? ButtonStyle.Primary : ButtonStyle.Secondary)
 );

 const resultContainer = new ContainerBuilder()
 .setAccentColor(color)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Rock · Paper · Scissors\n` +
 `**Your choice:** **${playerData.label}**\n` +
 `**Friday's choice:** **${botData.label}**\n\n` +
 `${resultText}${balanceLine}`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addActionRowComponents(disabledRow);

 await i.editReply({ flags: MessageFlags.IsComponentsV2, components: [resultContainer] });
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 if (bet > 0 && guild) await db.updateCoins(guild.id, user.id, bet);

 const timeoutContainer = new ContainerBuilder()
 .setAccentColor(0x6b7280)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 'You took too long to make your move!' + (bet > 0 ? '\n↩ Bet refunded.' : '')
 )
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(
 ButtonBuilder.from(rock).setDisabled(true),
 ButtonBuilder.from(paper).setDisabled(true),
 ButtonBuilder.from(scissors).setDisabled(true)
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [timeoutContainer] }).catch(() => null);
 }
 });
 }
};
