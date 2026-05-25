const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

// Standard Roulette color mappings
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Place a bet on a virtual spinning roulette wheel.')
        .addIntegerOption(opt => 
            opt.setName('bet')
                .setDescription('The amount of coins you want to bet')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(opt =>
            opt.setName('space')
                .setDescription('Where to place your bet (e.g. red, black, green, or a number from 0-36)')
                .setRequired(true)),

    /**
     * Executes the roulette command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const bet = options.getInteger('bet');
        const space = options.getString('space').trim().toLowerCase();

        const cd = checkCooldown('roulette', user.id, 5);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Roulette is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            // Space validation
            let betType = ''; // 'COLOR' or 'NUMBER'
            let betTarget = null;

            if (space === 'red' || space === 'black' || space === 'green') {
                betType = 'COLOR';
                betTarget = space;
            } else {
                const targetNum = parseInt(space);
                if (isNaN(targetNum) || targetNum < 0 || targetNum > 36) {
                    return interaction.editReply({
                        content: '❌ Invalid betting space! Choose `red`, `black`, `green`, or a single number from `0` to `36`.',
                        ephemeral: true
                    });
                }
                betType = 'NUMBER';
                betTarget = targetNum;
            }

            const profile = await db.getProfile(guild.id, user.id);
            if (profile.coins < bet) {
                return interaction.editReply({ 
                    content: `❌ You do not have enough coins! Your current balance is 🪙 **${profile.coins.toLocaleString()}** coins.`,
                    ephemeral: true 
                });
            }

            // Deduct bet from database
            await db.updateCoins(guild.id, user.id, -bet);

            // Spin the wheel
            const rolledNumber = Math.floor(Math.random() * 37); // 0 to 36
            let rolledColor = 'green';
            if (RED_NUMBERS.includes(rolledNumber)) rolledColor = 'red';
            if (BLACK_NUMBERS.includes(rolledNumber)) rolledColor = 'black';

            let isWin = false;
            let multiplier = 0;

            if (betType === 'COLOR') {
                if (betTarget === rolledColor) {
                    isWin = true;
                    multiplier = rolledColor === 'green' ? 35 : 2;
                }
            } else {
                if (betTarget === rolledNumber) {
                    isWin = true;
                    multiplier = 35;
                }
            }

            let winnings = isWin ? bet * multiplier : 0;
            if (winnings > 0) {
                await db.updateCoins(guild.id, user.id, winnings);
            }

            const finalBalance = await db.getProfile(guild.id, user.id);

            const colorSquare = rolledColor === 'red' ? '🔴' : rolledColor === 'black' ? '⚫' : '🟢';
            const displayResult = `${colorSquare} **${rolledNumber} (${rolledColor.toUpperCase()})**`;

            const embed = new EmbedBuilder()
                .setTitle('🎡 Roulette Wheel Spinner')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setColor(isWin ? '#00FF66' : '#FF3333')
                .setDescription(
                    `### The croupier spins the wheel...\n\n` +
                    `The ball lands on: **${displayResult}**\n\n` +
                    (isWin 
                        ? `🎉 **Congratulations!** Your bet on \`${space}\` won!` 
                        : `❌ **Failed!** Your bet on \`${space}\` lost.`)
                )
                .addFields(
                    { name: 'Your Bet Space', value: `\`${space.toUpperCase()}\``, inline: true },
                    { name: 'Bet Amount', value: `🪙 **${bet}** coins`, inline: true },
                    { name: 'Payout', value: winnings > 0 ? `🪙 **+${winnings.toLocaleString()}**` : `🪙 **0**`, inline: true },
                    { name: 'Wallet Balance', value: `🪙 **${finalBalance.coins.toLocaleString()}** coins`, inline: false }
                )
                .setFooter({ text: '🔴 Red (2x) | ⚫ Black (2x) | 🟢 Green (35x) | Numbers 0-36 (35x)' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[ROULETTE ERROR]', err);
            const _errMsg = { content: '❌ Failed to process Roulette game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
