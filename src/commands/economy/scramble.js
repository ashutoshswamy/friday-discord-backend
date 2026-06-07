const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

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

 if (guess) {
 const game = activeGames.get(channel.id);
 if (!game) {
 return interaction.editReply({ content: 'No active scramble game in this channel. Start one with `/scramble`!', ephemeral: true });
 }
 if (guess === game.answer) {
 clearTimeout(game.timeoutId);
 activeGames.delete(channel.id);

 const container = new ContainerBuilder()
 .setAccentColor(0x4ade80)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Correct!\n **${user.tag}** got it!\nThe word was **${game.answer}**`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } else {
 return interaction.editReply({ content: `**${guess}** is wrong. Keep trying!`, ephemeral: true });
 }
 }

 if (activeGames.has(channel.id)) {
 const game = activeGames.get(channel.id);
 return interaction.editReply({ content: `A game is already running! Unscramble: \`${game.scrambled}\``, ephemeral: true });
 }

 const word = WORDS[Math.floor(Math.random() * WORDS.length)];
 const scrambled = scrambleWord(word);
 const timeLimit = 60;

 const timeoutId = setTimeout(async () => {
 activeGames.delete(channel.id);
 const container = new ContainerBuilder()
 .setAccentColor(0xf87171)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Time's Up!\nNobody got it. The word was **${word}**`
 )
 );
 await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] }).catch(() => null);
 }, timeLimit * 1000);

 activeGames.set(channel.id, { answer: word, scrambled, timeoutId });

 const container = new ContainerBuilder()
 .setAccentColor(0x8b5cf6)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Word Scramble!\nUnscramble this word:\n\n# \`${scrambled}\`\n\n` +
 `Use \`/scramble answer:<your guess>\` to answer.\n` +
 `You have **${timeLimit} seconds**!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Started by ${user.tag}`)
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
};
