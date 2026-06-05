const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

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
                return interaction.editReply({ content: `⏳ Coinflip is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
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

        const headsBtn = new ButtonBuilder()
            .setCustomId('cf_heads')
            .setLabel('🪙 Heads')
            .setStyle(ButtonStyle.Primary);

        const tailsBtn = new ButtonBuilder()
            .setCustomId('cf_tails')
            .setLabel('🔵 Tails')
            .setStyle(ButtonStyle.Secondary);

        const skipBtn = new ButtonBuilder()
            .setCustomId('cf_skip')
            .setLabel('🎲 Just Flip')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(headsBtn, tailsBtn, skipBtn);

        const betLine = bet > 0 ? `\n🪙 **${bet.toLocaleString()} coins** on the line!` : '';
        const prompt = new EmbedBuilder()
            .setTitle('🪙 Coin Flip')
            .setColor('#FFD700')
            .setDescription(`Make your call before the flip, or just watch it land!${betLine}`)
            .setFooter({ text: 'Choose within 20 seconds' });

        const response = await interaction.editReply({ embeds: [prompt], components: [row] });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 20000,
            max: 1
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            const guess = i.customId === 'cf_skip' ? null : i.customId.replace('cf_', '');
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const resultEmoji = result === 'heads' ? '🪙' : '🔵';
            const resultLabel = result.charAt(0).toUpperCase() + result.slice(1);

            let color = '#FFD700';
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
                    outcomeText += `\n\n✅ You called **${guessLabel}** — **You win!**`;
                    if (bet > 0) outcomeText += `\n🪙 **+${coinDelta.toLocaleString()} coins**`;
                } else {
                    outcomeText += `\n\n❌ You called **${guessLabel}** — **Better luck next time!**`;
                    if (bet > 0) outcomeText += `\n🪙 **-${bet.toLocaleString()} coins**`;
                }
                color = won ? '#00FF66' : '#FF3333';
            } else if (bet > 0 && guild) {
                await db.updateCoins(guild.id, user.id, bet);
                outcomeText += `\n\n↩️ No guess — bet refunded.`;
            }

            let balanceLine = '';
            if (bet > 0 && guild) {
                const profile = await db.getProfile(guild.id, user.id);
                balanceLine = `\n💰 Balance: 🪙 **${profile.coins.toLocaleString()}**`;
            }

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(headsBtn).setDisabled(true).setStyle(guess === 'heads' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ButtonBuilder.from(tailsBtn).setDisabled(true).setStyle(guess === 'tails' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ButtonBuilder.from(skipBtn).setDisabled(true)
            );

            const resultEmbed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip Result')
                .setDescription(outcomeText + balanceLine)
                .setColor(color)
                .setFooter({ text: `Flipped by ${user.tag}` })
                .setTimestamp();

            await i.editReply({ embeds: [resultEmbed], components: [disabledRow] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                if (bet > 0 && guild) {
                    await db.updateCoins(guild.id, user.id, bet);
                }
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(headsBtn).setDisabled(true),
                    ButtonBuilder.from(tailsBtn).setDisabled(true),
                    ButtonBuilder.from(skipBtn).setDisabled(true)
                );
                await interaction.editReply({ content: '⏰ Timed out — bet refunded.', components: [disabledRow] }).catch(() => null);
            }
        });
    }
};
