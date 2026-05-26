const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and see if it lands on heads or tails.')
        .addStringOption(opt =>
            opt.setName('guess')
                .setDescription('Your guess before the flip')
                .setRequired(false)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )),

    async execute(interaction) {
        const { user, options } = interaction;
        const guess = options.getString('guess');
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const emoji = result === 'heads' ? '🪙' : '🔵';

        let description = `${emoji} The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**!`;
        let color = '#FFD700';

        if (guess) {
            const won = guess === result;
            description += won
                ? `\n\n✅ You guessed **${guess}** — **You win!**`
                : `\n\n❌ You guessed **${guess}** — **Better luck next time!**`;
            color = won ? '#4ade80' : '#f87171';
        }

        const embed = new EmbedBuilder()
            .setTitle('🪙 Coin Flip')
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: `Flipped by ${user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
