const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

const CHOICES = {
    rock:     { emoji: '🪨', label: 'Rock',     beats: 'scissors' },
    paper:    { emoji: '📄', label: 'Paper',    beats: 'rock' },
    scissors: { emoji: '✂️', label: 'Scissors', beats: 'paper' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock, Paper, Scissors against Friday.'),

    async execute(interaction) {
        const { user } = interaction;

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

        const prompt = new EmbedBuilder()
            .setTitle('Rock · Paper · Scissors')
            .setColor('#8b5cf6')
            .setDescription(`**${user.username}**, make your move!`)
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

            let result, color;
            if (playerChoice === botChoice) {
                result = "🤝 It's a **Tie**!";
                color = '#94a3b8';
            } else if (playerData.beats === botChoice) {
                result = '🏆 You **Win**!';
                color = '#00FF66';
            } else {
                result = '💀 You **Lose**!';
                color = '#FF3333';
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
                    { name: 'Result', value: result, inline: false }
                )
                .setFooter({ text: `Challenged by ${user.tag}` })
                .setTimestamp();

            await i.editReply({ embeds: [resultEmbed], components: [disabledRow] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('Rock · Paper · Scissors')
                    .setColor('#6b7280')
                    .setDescription('⏰ You took too long to make your move!')
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
