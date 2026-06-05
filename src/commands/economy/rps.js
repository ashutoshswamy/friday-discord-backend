const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const CHOICES = {
    rock:     { emoji: '🪨', label: 'Rock',     beats: 'scissors' },
    paper:    { emoji: '📄', label: 'Paper',    beats: 'rock' },
    scissors: { emoji: '✂️', label: 'Scissors', beats: 'paper' },
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
                return interaction.editReply({ content: `⏳ RPS is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
            }

            if (guild) {
                const profile = await db.getProfile(guild.id, user.id);
                if (profile.coins < bet) {
                    return interaction.editReply({
                        content: `❌ Not enough coins! Balance: 🪙 **${profile.coins.toLocaleString()}**`,
                        ephemeral: true
                    });
                }
                await db.updateCoins(guild.id, user.id, -bet);
            }
        }

        const rock = new ButtonBuilder()
            .setCustomId('rps_rock')
            .setLabel('🪨 Rock')
            .setStyle(ButtonStyle.Secondary);

        const paper = new ButtonBuilder()
            .setCustomId('rps_paper')
            .setLabel('📄 Paper')
            .setStyle(ButtonStyle.Secondary);

        const scissors = new ButtonBuilder()
            .setCustomId('rps_scissors')
            .setLabel('✂️ Scissors')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(rock, paper, scissors);

        const betLine = bet > 0 ? `\n🪙 **${bet.toLocaleString()} coins** on the line!` : '';
        const prompt = new EmbedBuilder()
            .setTitle('Rock · Paper · Scissors')
            .setColor('#8b5cf6')
            .setDescription(`**${user.username}**, make your move!${betLine}`)
            .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
            .setFooter({ text: 'You have 30 seconds to choose' });

        const response = await interaction.editReply({ embeds: [prompt], components: [row] });

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
                resultText = "🤝 It's a **Tie**!";
                color = '#94a3b8';
                if (bet > 0 && guild) {
                    await db.updateCoins(guild.id, user.id, bet);
                    resultText += '\n↩️ Bet refunded.';
                }
            } else if (playerData.beats === botChoice) {
                resultText = '🏆 You **Win**!';
                color = '#00FF66';
                if (bet > 0 && guild) {
                    coinDelta = bet * 2;
                    await db.updateCoins(guild.id, user.id, coinDelta);
                    resultText += `\n🪙 **+${coinDelta.toLocaleString()} coins**`;
                }
            } else {
                resultText = '💀 You **Lose**!';
                color = '#FF3333';
                if (bet > 0) resultText += `\n🪙 **-${bet.toLocaleString()} coins**`;
            }

            let balanceLine = '';
            if (bet > 0 && guild) {
                const profile = await db.getProfile(guild.id, user.id);
                balanceLine = `\n💰 Balance: 🪙 **${profile.coins.toLocaleString()}**`;
            }

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(rock).setDisabled(true).setStyle(playerChoice === 'rock' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ButtonBuilder.from(paper).setDisabled(true).setStyle(playerChoice === 'paper' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ButtonBuilder.from(scissors).setDisabled(true).setStyle(playerChoice === 'scissors' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            );

            const resultEmbed = new EmbedBuilder()
                .setTitle('Rock · Paper · Scissors')
                .setColor(color)
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .addFields(
                    { name: 'Your Choice', value: `${playerData.emoji} **${playerData.label}**`, inline: true },
                    { name: 'Friday\'s Choice', value: `${botData.emoji} **${botData.label}**`, inline: true },
                    { name: 'Result', value: resultText + balanceLine, inline: false }
                )
                .setFooter({ text: `Challenged by ${user.tag}` })
                .setTimestamp();

            await i.editReply({ embeds: [resultEmbed], components: [disabledRow] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                if (bet > 0 && guild) {
                    await db.updateCoins(guild.id, user.id, bet);
                }

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('Rock · Paper · Scissors')
                    .setColor('#6b7280')
                    .setDescription('⏰ You took too long to make your move!' + (bet > 0 ? '\n↩️ Bet refunded.' : ''))
                    .setTimestamp();

                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(rock).setDisabled(true),
                    ButtonBuilder.from(paper).setDisabled(true),
                    ButtonBuilder.from(scissors).setDisabled(true)
                );

                await interaction.editReply({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => null);
            }
        });
    }
};
