const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const WORDS = [
    'javascript', 'discord', 'server', 'giveaway', 'python', 'keyboard',
    'programming', 'database', 'network', 'terminal', 'function', 'variable',
    'algorithm', 'interface', 'compiler', 'framework', 'container', 'protocol',
    'bandwidth', 'firewall', 'directory', 'repository', 'deployment', 'webhook',
    'typescript', 'component', 'middleware', 'migration', 'encryption', 'cluster',
    'astronaut', 'blueprint', 'calendar', 'champion', 'diamond', 'elephant',
    'fragment', 'gradient', 'horizon', 'kingdom', 'lantern', 'mystery',
    'nitrogen', 'orchard', 'phantom', 'quantum', 'rainbow', 'silence',
    'thunder', 'universe', 'volcano', 'warrior', 'crystal', 'journey',
];

function scrambleWord(word) {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const scrambled = arr.join('');
    return scrambled === word ? scrambleWord(word) : scrambled;
}

// Active games: channelId -> { answer, scrambled, timeoutId }
const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scramble')
        .setDescription('Start a word scramble — be first to unscramble it in chat!')
        .addStringOption(opt =>
            opt.setName('answer')
                .setDescription('Answer a running scramble game in this channel')
                .setRequired(false)),

    async execute(interaction) {
        const { channel, user, options } = interaction;
        const guess = options.getString('answer')?.toLowerCase().trim();

        // ── Answer attempt
        if (guess) {
            const game = activeGames.get(channel.id);
            if (!game) {
                return interaction.editReply({ content: '❌ No active scramble game in this channel. Start one with `/scramble`!', ephemeral: true });
            }
            if (guess === game.answer) {
                clearTimeout(game.timeoutId);
                activeGames.delete(channel.id);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Correct!')
                    .setColor('#4ade80')
                    .setDescription(`🏆 **${user.tag}** got it!\nThe word was **${game.answer}**`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } else {
                return interaction.editReply({ content: `❌ **${guess}** is wrong. Keep trying!`, ephemeral: true });
            }
        }

        // ── Start new game
        if (activeGames.has(channel.id)) {
            const game = activeGames.get(channel.id);
            return interaction.editReply({ content: `⚠️ A game is already running! Unscramble: \`${game.scrambled}\``, ephemeral: true });
        }

        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        const scrambled = scrambleWord(word);
        const timeLimit = 60;

        const timeoutId = setTimeout(async () => {
            activeGames.delete(channel.id);
            const embed = new EmbedBuilder()
                .setTitle('⏰ Time\'s Up!')
                .setColor('#f87171')
                .setDescription(`Nobody got it. The word was **${word}**`)
                .setTimestamp();
            await channel.send({ embeds: [embed] }).catch(() => null);
        }, timeLimit * 1000);

        activeGames.set(channel.id, { answer: word, scrambled, timeoutId });

        const embed = new EmbedBuilder()
            .setTitle('🔤 Word Scramble!')
            .setColor('#8b5cf6')
            .setDescription(
                `Unscramble this word:\n\n## \`${scrambled}\`\n\n` +
                `Use \`/scramble answer:<your guess>\` to answer.\n` +
                `⏰ You have **${timeLimit} seconds**!`
            )
            .setFooter({ text: `Started by ${user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
