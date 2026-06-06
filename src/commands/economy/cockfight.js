const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cockfight')
        .setDescription('Bet your server coins on a high-stakes cockfight arena simulation.')
        .addIntegerOption(opt => 
            opt.setName('bet')
                .setDescription('The amount of coins you want to bet')
                .setRequired(true)
                .setMinValue(1)),

    /**
     * Executes the cockfight command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const bet = options.getInteger('bet');

        const cd = checkCooldown('cockfight', user.id, 8);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Cockfight is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
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

            // Battle outcomes
            const playerBirdNames = ['Spitfire', 'Diablo', 'Thunderbolt', 'Razorclaw', 'Titan', 'Zeus', 'Rogue'];
            const opponentBirdNames = ['Apex', 'Viper', 'Doom', 'Shadow', 'Slayer', 'Gladiator', 'Havoc'];

            const playerBird = playerBirdNames[Math.floor(Math.random() * playerBirdNames.length)];
            const opponentBird = opponentBirdNames[Math.floor(Math.random() * opponentBirdNames.length)];

            // Battle descriptions
            const winScripts = [
                `🐓 **${playerBird}** enters the dust-cloud, delivering a devastating flying kick! **${opponentBird}** retreats in absolute defeat.`,
                `🐓 After a gruelling 3-minute peck-off, **${playerBird}** lands a powerful headstrike. The opponent **${opponentBird}** collapses in fatigue.`,
                `🐓 **${playerBird}** displays incredible agility, dodging a tail-swipe and counter-striking with razor claws! **${opponentBird}** flees the pit.`
            ];

            const loseScripts = [
                `🐓 **${opponentBird}** strikes first with blinding speed! Your bird **${playerBird}** is knocked out of the ring.`,
                `🐓 **${playerBird}** put up a heroic struggle, but **${opponentBird}** dominated the high ground and forced your bird to submit.`,
                `🐓 A sudden slip in the mud leaves **${playerBird}** vulnerable! **${opponentBird}** seizes the opportunity for a swift knockdown.`
            ];

            const isWin = Math.random() < 0.50; // 50% chance
            let finalStatus = '';
            let multiplier = 0;

            if (isWin) {
                // Random multiplier from 1.6x to 2.2x
                multiplier = parseFloat((Math.random() * 0.6 + 1.6).toFixed(2));
                finalStatus = winScripts[Math.floor(Math.random() * winScripts.length)];
            } else {
                multiplier = 0;
                finalStatus = loseScripts[Math.floor(Math.random() * loseScripts.length)];
            }

            let winnings = Math.floor(bet * multiplier);
            if (winnings > 0) {
                await db.updateCoins(guild.id, user.id, winnings);
            }

            const finalBalance = await db.getProfile(guild.id, user.id);

            const embed = new EmbedBuilder()
                .setTitle('🐓 Cockfight Arena')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true, size: 128 }))
                .setColor(isWin ? '#00FF66' : '#FF3333')
                .setDescription(
                    `### ⚔️ Battle in progress: **${playerBird}** vs **${opponentBird}** ⚔️\n\n` +
                    `${finalStatus}\n\n` +
                    (isWin 
                        ? `🎉 **Victory!** You won **${multiplier}x** your bet!` 
                        : `❌ **Defeat!** You lost your entire bet.`)
                )
                .addFields(
                    { name: 'Your Fighter', value: `🐓 **${playerBird}**`, inline: true },
                    { name: 'Your Bet', value: `🪙 **${bet.toLocaleString()}** coins`, inline: true },
                    { name: 'Payout', value: winnings > 0 ? `🪙 **+${winnings.toLocaleString()}**` : `🪙 **0**`, inline: true },
                    { name: 'Wallet Balance', value: `🪙 **${finalBalance.coins.toLocaleString()}** coins`, inline: false }
                )
                .setFooter({ text: '⚠️ High stakes cockfight arena matches. 50% chance of double payouts or total loss.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[COOCKFIGHT ERROR]', err);
            const _errMsg = { content: '❌ Failed to process Cockfight game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
