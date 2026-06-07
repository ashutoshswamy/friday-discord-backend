const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const SUITS = ['♠', '♥', '♦', '♣'];
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
 while (sum > 21 && aces > 0) { sum -= 10; aces -= 1; }
 return sum;
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
 content: `You do not have enough coins! Your current balance is <:coin:1512926963239489606> **${profile.coins.toLocaleString()}** coins.`,
 ephemeral: true
 });
 }

 await db.updateCoins(guild.id, user.id, -bet);

 const playerHand = [drawCard(), drawCard()];
 const dealerHand = [drawCard(), drawCard()];

 let playerScore = calculateHand(playerHand);
 let dealerScore = calculateHand(dealerHand);

 const hitBtn = new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary);
 const standBtn = new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary);

 const buildContainer = (isFinal = false, status = '', color = 0x8b5cf6) =>
 new ContainerBuilder()
 .setAccentColor(color)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Blackjack Table\n` +
 (isFinal ? status : 'Choose to **Hit** for another card, or **Stand** to keep your score.')
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Your Hand (${playerScore}):** ${playerHand.map(c => `\`${c.display}\``).join(' ')}\n` +
 `**Dealer's Hand (${isFinal ? dealerScore : '?'}):** ${isFinal
 ? dealerHand.map(c => `\`${c.display}\``).join(' ')
 : `\`${dealerHand[0].display}\` \`\``
 }\n\n` +
 `-# Bet: <:coin:1512926963239489606> ${bet.toLocaleString()} coins`
 )
 );

 if (playerScore === 21) {
 let payout = Math.floor(bet * 2.5);
 await db.updateCoins(guild.id, user.id, payout);
 return interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [buildContainer(true, `**Natural Blackjack!** You won <:coin:1512926963239489606> **${payout.toLocaleString()}** coins!`, 0x00FF66)]
 });
 }

 const row = new ActionRowBuilder().addComponents(hitBtn, standBtn);
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

 collector.on('collect', async i => {
 await i.deferUpdate();

 if (i.customId === 'bj_hit') {
 playerHand.push(drawCard());
 playerScore = calculateHand(playerHand);

 if (playerScore > 21) {
 collector.stop('bust');
 } else if (playerScore === 21) {
 collector.stop('twentyone');
 } else {
 const updatedContainer = buildContainer();
 updatedContainer.addActionRowComponents(row);
 await i.editReply({ flags: MessageFlags.IsComponentsV2, components: [updatedContainer] });
 }
 } else if (i.customId === 'bj_stand') {
 collector.stop('stand');
 }
 });

 collector.on('end', async (collected, reason) => {
 const disabledRow = new ActionRowBuilder().addComponents(
 ButtonBuilder.from(hitBtn).setDisabled(true),
 ButtonBuilder.from(standBtn).setDisabled(true)
 );

 if (reason === 'time') {
 await db.updateCoins(guild.id, user.id, bet);
 const timeoutContainer = buildContainer(true, '**Timed Out** — bet refunded.', 0x6b7280);
 timeoutContainer.addActionRowComponents(disabledRow);
 return interaction.editReply({ content: 'Game timed out! Your bet has been refunded.', flags: MessageFlags.IsComponentsV2, components: [timeoutContainer] });
 }

 if (reason === 'stand' || reason === 'twentyone') {
 while (dealerScore < 17) {
 dealerHand.push(drawCard());
 dealerScore = calculateHand(dealerHand);
 }
 }

 let finalStatus = '';
 let color = 0x8b5cf6;

 if (playerScore > 21) {
 finalStatus = `**Bust!** You went over 21. You lost your bet of <:coin:1512926963239489606> **${bet.toLocaleString()}** coins.`;
 color = 0xFF3333;
 } else if (dealerScore > 21) {
 let payout = bet * 2;
 await db.updateCoins(guild.id, user.id, payout);
 finalStatus = `**Dealer Bust!** Friday went over 21. You won <:coin:1512926963239489606> **${payout.toLocaleString()}** coins!`;
 color = 0x00FF66;
 } else if (playerScore > dealerScore) {
 let payout = bet * 2;
 await db.updateCoins(guild.id, user.id, payout);
 finalStatus = `**You Win!** Score **${playerScore}** beat dealer's **${dealerScore}**. Won <:coin:1512926963239489606> **${payout.toLocaleString()}** coins!`;
 color = 0x00FF66;
 } else if (playerScore < dealerScore) {
 finalStatus = `**You Lose!** Dealer's **${dealerScore}** beat your **${playerScore}**. Lost <:coin:1512926963239489606> **${bet.toLocaleString()}** coins.`;
 color = 0xFF3333;
 } else {
 await db.updateCoins(guild.id, user.id, bet);
 finalStatus = `**Push!** Tied at **${playerScore}**. Bet of <:coin:1512926963239489606> **${bet.toLocaleString()}** refunded.`;
 color = 0xFFCC00;
 }

 const finalContainer = buildContainer(true, finalStatus, color);
 finalContainer.addActionRowComponents(disabledRow);
 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [finalContainer] });
 });

 } catch (err) {
 console.error('[BLACKJACK ERROR]', err);
 const errMsg = { content: 'Failed to process Blackjack game.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
