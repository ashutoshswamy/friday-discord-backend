const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

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
 const { channel, guild, user, options } = interaction;
 const guess = options.getString('answer')?.toLowerCase().trim();

 if (guess) {
 const game = activeGames.get(channel.id);
 if (!game) {
 return interaction.editReply({ content: 'No active scramble game in this channel. Start one with `/scramble`!', ephemeral: true });
 }
 if (guess === game.answer) {
 clearTimeout(game.timeoutId);
 activeGames.delete(channel.id);

 const elapsed = (Date.now() - game.startTime) / 1000;
 const baseCoins = game.answer.length * 35;
 let speedBonus = 0;
 let speedLabel = '';
 if (elapsed <= 15) {
  speedBonus = Math.floor(baseCoins * 0.75);
  speedLabel = ' Lightning fast!';
 } else if (elapsed <= 30) {
  speedBonus = Math.floor(baseCoins * 0.40);
  speedLabel = ' Quick solver!';
 } else if (elapsed <= 45) {
  speedBonus = Math.floor(baseCoins * 0.15);
  speedLabel = '';
 }
 const totalCoins = baseCoins + speedBonus;
 const xpReward = 30 + Math.floor(game.answer.length * 3);

 await Promise.all([
  db.updateCoins(game.guildId, user.id, totalCoins).catch(() => null),
  db.addXp(game.guildId, user.id, xpReward).catch(() => null)
 ]);

 let rewardText = `${EMOJIS.coin} **+${totalCoins.toLocaleString()}** coins`;
 if (speedBonus > 0) rewardText += ` *(base ${baseCoins} + speed bonus ${speedBonus})*`;
 rewardText += `\n ** +${xpReward} XP**`;
 if (speedLabel) rewardText += `\n*${speedLabel}*`;

 const container = new ContainerBuilder()
 .addSectionComponents(
  new SectionBuilder()
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
   `## Correct!\n**${user.tag}** solved it!\nThe word was **${game.answer}**`
   )
  )
  .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `**Rewards**\n${rewardText}\n\n-# Solved in ${elapsed.toFixed(1)}s · Longer words = bigger payouts`
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
 const baseCoins = word.length * 35;

 const timeoutId = setTimeout(async () => {
 activeGames.delete(channel.id);
 const container = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Time's Up!\nNobody got it. The word was **${word}**`
 )
 );
 await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] }).catch(() => null);
 }, timeLimit * 1000);

 activeGames.set(channel.id, { answer: word, scrambled, timeoutId, guildId: guild.id, startTime: Date.now() });

 const maxCoins = baseCoins + Math.floor(baseCoins * 0.75);

 const container = new ContainerBuilder()
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
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
  `${EMOJIS.coin} **${baseCoins}–${maxCoins} coins** + ** XP** · Answer fast for a speed bonus!\n` +
  `-# Started by ${user.tag}`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
};
