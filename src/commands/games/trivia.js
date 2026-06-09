const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle,
 ComponentType, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');
const https = require('https');

const CATEGORIES = {
 general: { id: 9, label: 'General Knowledge' },
 science: { id: 17, label: 'Science & Nature' },
 history: { id: 23, label: 'History' },
 gaming: { id: 15, label: 'Video Games' },
 movies: { id: 11, label: 'Film & Cinema' }
};

function decodeHtml(str) {
 return str
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ldquo;/g, '"')
  .replace(/&rdquo;/g, '"').replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'");
}

function fetchQuestion(categoryId) {
 return new Promise((resolve, reject) => {
  const url = `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`;
  https.get(url, (res) => {
   let data = '';
   res.on('data', chunk => data += chunk);
   res.on('end', () => {
    try {
     const parsed = JSON.parse(data);
     if (parsed.response_code !== 0 || !parsed.results?.length) return reject(new Error('No question returned'));
     resolve(parsed.results[0]);
    } catch (e) { reject(e); }
   });
  }).on('error', reject);
 });
}

const BUTTON_LABELS = ['A', 'B', 'C', 'D'];
const DIFFICULTY_COINS = { easy: 100, medium: 200, hard: 350 };
const DIFFICULTY_XP = { easy: 30, medium: 60, hard: 100 };

module.exports = {
 data: new SlashCommandBuilder()
  .setName('trivia')
  .setDescription('Answer a timed trivia question to earn coins and XP.')
  .addStringOption(opt =>
   opt.setName('category')
    .setDescription('Pick a trivia category')
    .setRequired(false)
    .addChoices(
     { name: 'General Knowledge', value: 'general' },
     { name: 'Science & Nature', value: 'science' },
     { name: 'History', value: 'history' },
     { name: 'Video Games', value: 'gaming' },
     { name: 'Film & Cinema', value: 'movies' }
    )),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const categoryKey = options.getString('category') || 'general';
  const category = CATEGORIES[categoryKey];

  const cd = checkCooldown('trivia', user.id, 15);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `Trivia cooldown active. Try again in **${cd.remaining}s**.`, ephemeral: true });
  }

  try {
   let raw;
   try { raw = await fetchQuestion(category.id); }
   catch { return interaction.editReply({ content: 'Could not fetch a trivia question. Try again shortly.', ephemeral: true }); }

   const question = decodeHtml(raw.question);
   const correct = decodeHtml(raw.correct_answer);
   const incorrect = raw.incorrect_answers.map(decodeHtml);
   const diff = raw.difficulty;
   const coinReward = DIFFICULTY_COINS[diff] || 150;
   const xpReward = DIFFICULTY_XP[diff] || 50;

   const allAnswers = [...incorrect, correct].sort(() => Math.random() - 0.5);
   const correctIndex = allAnswers.indexOf(correct);

   const buttons = allAnswers.map((ans, idx) =>
    new ButtonBuilder()
     .setCustomId(`trivia_${idx}`)
     .setLabel(`${BUTTON_LABELS[idx]}: ${ans.length > 50 ? ans.substring(0, 47) + '...' : ans}`)
     .setStyle(ButtonStyle.Secondary)
   );

   const diffLabel = diff.charAt(0).toUpperCase() + diff.slice(1);

   const buildPanel = (disabled = false, selectedIdx = -1, reveal = false) => {
    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Trivia — ${category.label}\n**${diffLabel}** · ${EMOJIS.coin} ${coinReward} coins + ${xpReward} XP\n\n**${question}**`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    if (!disabled) {
     container.addActionRowComponents(
      new ActionRowBuilder().addComponents(...buttons)
     );
    }

    if (reveal) {
     container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Correct answer:** ${BUTTON_LABELS[correctIndex]}: **${correct}**`)
     );
    }

    container.addTextDisplayComponents(
     new TextDisplayBuilder().setContent('-# 30 seconds to answer')
    );
    return container;
   };

   const response = await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [buildPanel()],
    fetchReply: true
   });

   const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: i => i.user.id === user.id,
    time: 30000,
    max: 1
   });

   collector.on('collect', async (i) => {
    await i.deferUpdate();
    const chosenIndex = parseInt(i.customId.split('_')[1]);
    const isCorrect = chosenIndex === correctIndex;

    if (isCorrect) {
     await Promise.all([
      db.updateCoins(guild.id, user.id, coinReward),
      db.addXp(guild.id, user.id, xpReward)
     ]);
    }

    const resultContainer = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## ${isCorrect ? 'Correct!' : 'Wrong!'}\n**${question}**`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `**Your answer:** ${BUTTON_LABELS[chosenIndex]}: ${allAnswers[chosenIndex]}\n` +
       `**Correct answer:** ${BUTTON_LABELS[correctIndex]}: **${correct}**\n\n` +
       (isCorrect ? `**Earned:** ${EMOJIS.coin} **+${coinReward}** coins + **+${xpReward}** XP` : `No reward this time.`)
      )
     );

    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [resultContainer] }).catch(() => {});
   });

   collector.on('end', async (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
     const timeoutContainer = new ContainerBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## Time's Up!\n**${question}**\n\n**Correct answer:** ${BUTTON_LABELS[correctIndex]}: **${correct}**`
       )
      );
     await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [timeoutContainer] }).catch(() => {});
    }
   });

  } catch (err) {
   console.error('[TRIVIA ERROR]', err);
   const errMsg = { content: 'Failed to load trivia question.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
