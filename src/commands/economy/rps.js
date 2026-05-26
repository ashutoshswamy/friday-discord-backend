const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CHOICES = {
    rock:     { emoji: '🪨', beats: 'scissors' },
    paper:    { emoji: '📄', beats: 'rock' },
    scissors: { emoji: '✂️', beats: 'paper' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock, Paper, Scissors against the bot.')
        .addStringOption(opt =>
            opt.setName('choice')
                .setDescription('Your move')
                .setRequired(true)
                .addChoices(
                    { name: '🪨 Rock',     value: 'rock' },
                    { name: '📄 Paper',    value: 'paper' },
                    { name: '✂️ Scissors', value: 'scissors' }
                )),

    async execute(interaction) {
        const { user, options } = interaction;
        const playerChoice = options.getString('choice');
        const botChoice = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];

        const playerEmoji = CHOICES[playerChoice].emoji;
        const botEmoji    = CHOICES[botChoice].emoji;

        let result, color;
        if (playerChoice === botChoice) {
            result = "🤝 It's a **Tie**!";
            color = '#94a3b8';
        } else if (CHOICES[playerChoice].beats === botChoice) {
            result = '🏆 You **Win**!';
            color = '#4ade80';
        } else {
            result = '💀 You **Lose**!';
            color = '#f87171';
        }

        const embed = new EmbedBuilder()
            .setTitle('Rock · Paper · Scissors')
            .setColor(color)
            .setDescription(
                `${playerEmoji} **You** chose **${playerChoice}**\n` +
                `${botEmoji} **Friday** chose **${botChoice}**\n\n` +
                result
            )
            .setFooter({ text: `Challenged by ${user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
