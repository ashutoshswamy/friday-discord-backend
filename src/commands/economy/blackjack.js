const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

// Card helper representations
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a high-stakes blackjack card game against Friday (Dealer).')
        .addIntegerOption(opt => 
            opt.setName('bet')
                .setDescription('The amount of coins you want to bet')
                .setRequired(true)
                .setMinValue(1)),

    /**
     * Executes the blackjack command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const bet = options.getInteger('bet');

        const cd = checkCooldown('blackjack', user.id, 10);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Blackjack is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getProfile(guild.id, user.id);
            if (profile.coins < bet) {
                return interaction.editReply({
                    content: `❌ You do not have enough coins! Your current balance is 🪙 **${profile.coins.toLocaleString()}** coins.`,
                    ephemeral: true
                });
            }

            // Deduct bet from database
            await db.updateCoins(guild.id, user.id, -bet);

            // Draw initial cards
            const playerHand = [drawCard(), drawCard()];
            const dealerHand = [drawCard(), drawCard()];

            let playerScore = calculateHand(playerHand);
            let dealerScore = calculateHand(dealerHand);

            // Create buttons
            const hitBtn = new ButtonBuilder()
                .setCustomId('bj_hit')
                .setLabel('🃏 Hit')
                .setStyle(ButtonStyle.Primary);

            const standBtn = new ButtonBuilder()
                .setCustomId('bj_stand')
                .setLabel('🛑 Stand')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(hitBtn, standBtn);

            const getEmbed = (isFinal = false, status = '') => {
                const embed = new EmbedBuilder()
                    .setTitle('🃏 Blackjack Table')
                    .setColor(isFinal ? (status.includes('Win') ? '#00FF66' : status.includes('Push') ? '#FFCC00' : '#FF3333') : '#8b5cf6')
                    .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                    .addFields(
                        { 
                            name: `👤 Your Hand (${playerScore})`, 
                            value: playerHand.map(c => `\`${c.display}\``).join('  '), 
                            inline: true 
                        },
                        { 
                            name: `🤖 Dealer's Hand (${isFinal ? dealerScore : '?'})`, 
                            value: isFinal 
                                ? dealerHand.map(c => `\`${c.display}\``).join('  ') 
                                : `\`${dealerHand[0].display}\`  \`🎴\``, 
                            inline: true 
                        }
                    )
                    .setFooter({ text: `Current Bet: 🪙 ${bet.toLocaleString()} coins` });

                if (isFinal) {
                    embed.setDescription(`### ${status}`);
                } else {
                    embed.setDescription('Choose whether to **Hit** to draw another card, or **Stand** to keep your score.');
                }
                return embed;
            };

            // Natural Blackjack check
            if (playerScore === 21) {
                let payout = Math.floor(bet * 2.5); // 3:2 payout for natural blackjack
                await db.updateCoins(guild.id, user.id, payout);
                return interaction.editReply({ 
                    embeds: [getEmbed(true, `🎉 **Natural Blackjack!** You won 🪙 **${payout.toLocaleString()}** coins!`)] 
                });
            }

            const response = await interaction.editReply({
                embeds: [getEmbed()],
                components: [row],
                fetchReply: true
            });

            // Set up button collector
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60000 // 1 minute
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
                        await i.editReply({ embeds: [getEmbed()] });
                    }
                } else if (i.customId === 'bj_stand') {
                    collector.stop('stand');
                }
            });

            collector.on('end', async (collected, reason) => {
                // Remove buttons
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(hitBtn).setDisabled(true),
                    ButtonBuilder.from(standBtn).setDisabled(true)
                );

                if (reason === 'time') {
                    // Refund bet on inactivity to be user-friendly, or count as loss
                    await db.updateCoins(guild.id, user.id, bet);
                    return interaction.editReply({
                        content: '⏳ Game timed out! Your bet has been refunded.',
                        embeds: [getEmbed(true, '⏳ **Timed Out**')],
                        components: [disabledRow]
                    });
                }

                // Dealer Turn logic
                if (reason === 'stand' || reason === 'twentyone') {
                    while (dealerScore < 17) {
                        dealerHand.push(drawCard());
                        dealerScore = calculateHand(dealerHand);
                    }
                }

                let finalStatus = '';
                if (playerScore > 21) {
                    finalStatus = `💥 **Bust!** You went over 21. You lost your bet of 🪙 **${bet.toLocaleString()}** coins.`;
                } else if (dealerScore > 21) {
                    let payout = bet * 2;
                    await db.updateCoins(guild.id, user.id, payout);
                    finalStatus = `🎉 **Dealer Bust!** Friday went over 21. You won 🪙 **${payout.toLocaleString()}** coins!`;
                } else if (playerScore > dealerScore) {
                    let payout = bet * 2;
                    await db.updateCoins(guild.id, user.id, payout);
                    finalStatus = `🎉 **You Win!** Your score of **${playerScore}** beat the dealer's **${dealerScore}**. You won 🪙 **${payout.toLocaleString()}** coins!`;
                } else if (playerScore < dealerScore) {
                    finalStatus = `❌ **You Lose!** Dealer's score of **${dealerScore}** beat your **${playerScore}**. You lost your bet of 🪙 **${bet.toLocaleString()}** coins.`;
                } else {
                    // Push (Tie)
                    await db.updateCoins(guild.id, user.id, bet);
                    finalStatus = `🤝 **Push!** It is a tie score of **${playerScore}**. Your bet of 🪙 **${bet.toLocaleString()}** coins was refunded.`;
                }

                await interaction.editReply({
                    embeds: [getEmbed(true, finalStatus)],
                    components: [disabledRow]
                });
            });

        } catch (err) {
            console.error('[BLACKJACK ERROR]', err);
            const _errMsg = { content: '❌ Failed to process Blackjack game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
