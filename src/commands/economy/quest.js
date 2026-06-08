const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

function getQuestDescription(q) {
 const targetName = q.target_item ? q.target_item : '';
 switch (q.quest_type) {
  case 'chop':
   return `Chop down **${q.target_amount}x** ${targetName}`;
  case 'fish':
   return `Catch **${q.target_amount}x** ${targetName}`;
  case 'mine':
   return `Mine **${q.target_amount}x** ${targetName}`;
  case 'sell':
   return `Sell **${q.target_amount}** items to the Merchant`;
  case 'water':
   return `Water growing crops **${q.target_amount}** times`;
  case 'crime':
   return `Execute **${q.target_amount}** successful Crime scenarios`;
  case 'hack':
   return `Execute **${q.target_amount}** successful mainframe Hack intrusions`;
  default:
   return `Complete daily challenge`;
 }
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('quest')
  .setDescription('Manage your daily challenges and claim coin + XP rewards.')
  .addSubcommand(sub =>
   sub.setName('view')
    .setDescription('View your active daily quests board.')
  )
  .addSubcommand(sub =>
   sub.setName('claim')
    .setDescription('Claim rewards for a completed quest.')
    .addIntegerOption(opt =>
     opt.setName('index')
      .setDescription('The quest index to claim (1, 2, or 3)')
      .setMinValue(1)
      .setMaxValue(3)
      .setRequired(true)
    )
  ),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const subcommand = options.getSubcommand();

  try {
   if (subcommand === 'view') {
    const quests = await db.getUserQuests(guild.id, user.id);

    let questText = '';
    const buttons = [];

    quests.forEach((q, idx) => {
     const desc = getQuestDescription(q);
     const isCompleted = q.current_amount >= q.target_amount;
     const statusIcon = q.claimed ? ' (Claimed)' : isCompleted ? ' (Ready to Claim!)' : ' (In Progress)';
     
     const progressPct = Math.min(100, Math.floor((q.current_amount / q.target_amount) * 100));
     const filledBlocks = Math.round(progressPct / 10);
     const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

     questText += `### Quest #${idx + 1}: ${statusIcon}\n` +
      `• **Task:** ${desc}\n` +
      `• **Progress:** \`[${progressBar}]\` **${q.current_amount}** / **${q.target_amount}**\n` +
      `• **Rewards:** ${EMOJIS.coin} **${q.reward_coins}** coins · **${q.reward_xp}** XP\n\n`;

     const btn = new ButtonBuilder()
      .setCustomId(`quest_claim_${idx}`)
      .setLabel(`Claim #${idx + 1}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isCompleted || q.claimed);

     buttons.push(btn);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    const container = new ContainerBuilder()
     .setAccentColor(0xF1C40F) // Bright golden yellow
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`##  Daily Quests Board\nComplete tasks today to earn extra currency and level experience. Quests reset daily.\n\n${questText}`)
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     )
     .addActionRowComponents(row);

    const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

    const collector = response.createMessageComponentCollector({
     filter: i => i.user.id === user.id,
     time: 30000
    });

    collector.on('collect', async i => {
     await i.deferUpdate();
     collector.stop('selected');

     const questIdx = parseInt(i.customId.replace('quest_claim_', ''));
     const result = await db.claimQuestReward(guild.id, user.id, questIdx);

     if (!result || !result.success) {
      return i.followUp({ content: `Failed to claim reward: ${result?.reason || 'Database error.'}`, ephemeral: true });
     }

     const successContainer = new ContainerBuilder()
      .setAccentColor(0x2ECC71)
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(
          `##  Quest Reward Claimed!\n` +
           `You completed the daily challenge and received your bounty!\n\n` +
           `**Bounty Collected:** ${EMOJIS.coin} **+${result.reward_coins.toLocaleString()}** coins added to wallet!\n` +
           `**Experience Earned:** **+${result.reward_xp}** XP gained.`
         )
        )
      );

     await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [successContainer] });
    });
    return;
   }

   if (subcommand === 'claim') {
    const questIdx = options.getInteger('index') - 1;
    const result = await db.claimQuestReward(guild.id, user.id, questIdx);

    if (!result || !result.success) {
     return interaction.editReply({ content: `Failed to claim reward: ${result?.reason || 'Database error.'}`, ephemeral: true });
    }

    const container = new ContainerBuilder()
     .setAccentColor(0x2ECC71)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Quest Reward Claimed!\n` +
          `You completed the daily challenge and received your bounty!\n\n` +
          `**Bounty Collected:** ${EMOJIS.coin} **+${result.reward_coins.toLocaleString()}** coins added to wallet!\n` +
          `**Experience Earned:** **+${result.reward_xp}** XP gained.`
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

  } catch (err) {
   console.error('[QUEST ERROR]', err);
   const errMsg = { content: 'Failed to process daily quests operations.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
