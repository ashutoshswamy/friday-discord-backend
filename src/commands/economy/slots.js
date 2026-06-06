const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

const EMOJIS = ['🍎', '🍒', '🍇', '🍋', '💎', '🍀', '🌟'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the virtual slot machine to win big coin multipliers.')
        .addIntegerOption(opt => 
            opt.setName('bet')
                .setDescription('The amount of coins you want to bet')
                .setRequired(true)
                .setMinValue(1)),

    /**
     * Executes the slots command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const bet = options.getInteger('bet');

        const cd = checkCooldown('slots', user.id, 5);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Slots is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
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

            // Spin reels
            const reel1 = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            const reel2 = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            const reel3 = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

            const slotDisplay = `[ ${reel1} | ${reel2} | ${reel3} ]`;

            let multiplier = 0;
            let winStatus = '';

            // Win criteria
            if (reel1 === reel2 && reel2 === reel3) {
                // Triple jackpot!
                if (reel1 === '💎') {
                    multiplier = 10;
                    winStatus = '💎💎💎 **MEGA JACKPOT!** 💎💎💎';
                } else if (reel1 === '🌟') {
                    multiplier = 8;
                    winStatus = '🌟🌟🌟 **SUPER JACKPOT!** 🌟🌟🌟';
                } else {
                    multiplier = 5;
                    winStatus = '🎉 **TRIPLE JACKPOT!** 🎉';
                }
            } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
                multiplier = 2;
                winStatus = '✨ **DOUBLE WIN!** ✨';
            } else {
                multiplier = 0;
                winStatus = '❌ **YOU LOSE!** Better luck next spin.';
            }

            let winnings = bet * multiplier;
            if (winnings > 0) {
                await db.updateCoins(guild.id, user.id, winnings);
            }

            const finalBalance = await db.getProfile(guild.id, user.id);

            const embed = new EmbedBuilder()
                .setTitle('🎰 Slot Machine Spinner')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setColor(winnings > 0 ? '#FFD700' : '#FF3333')
                .setDescription(
                    `### Spinning the Reels...\n\n` +
                    `# ${slotDisplay}\n\n` +
                    `${winStatus}`
                )
                .addFields(
                    { name: 'Your Bet', value: `🪙 **${bet.toLocaleString()}** coins`, inline: true },
                    { name: 'Payout', value: winnings > 0 ? `🪙 **+${winnings.toLocaleString()}**` : `🪙 **0**`, inline: true },
                    { name: 'Wallet Balance', value: `🪙 **${finalBalance.coins.toLocaleString()}**`, inline: true }
                )
                .setFooter({ text: '🍀 Match 2 for 2x, Match 3 for 5x, 💎/🌟 for Mega Jacks!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[SLOTS ERROR]', err);
            const _errMsg = { content: '❌ Failed to process Slots game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
