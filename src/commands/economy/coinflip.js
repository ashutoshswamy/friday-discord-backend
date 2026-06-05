const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin — pick Heads or Tails before the flip.'),

    async execute(interaction) {
        const { user } = interaction;

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

        const prompt = new EmbedBuilder()
            .setTitle('🪙 Coin Flip')
            .setColor('#FFD700')
            .setDescription('Make your call before the flip, or just watch it land!')
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

            if (guess) {
                const won = guess === result;
                outcomeText += won
                    ? `\n\n✅ You called **${guess.charAt(0).toUpperCase() + guess.slice(1)}** — **You win!**`
                    : `\n\n❌ You called **${guess.charAt(0).toUpperCase() + guess.slice(1)}** — **Better luck next time!**`;
                color = won ? '#00FF66' : '#FF3333';
            }

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(headsBtn).setDisabled(true).setStyle(guess === 'heads' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ButtonBuilder.from(tailsBtn).setDisabled(true).setStyle(guess === 'tails' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ButtonBuilder.from(skipBtn).setDisabled(true)
            );

            const resultEmbed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip Result')
                .setDescription(outcomeText)
                .setColor(color)
                .setFooter({ text: `Flipped by ${user.tag}` })
                .setTimestamp();

            await i.editReply({ embeds: [resultEmbed], components: [disabledRow] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(headsBtn).setDisabled(true),
                    ButtonBuilder.from(tailsBtn).setDisabled(true),
                    ButtonBuilder.from(skipBtn).setDisabled(true)
                );
                await interaction.editReply({ components: [disabledRow] }).catch(() => null);
            }
        });
    }
};
