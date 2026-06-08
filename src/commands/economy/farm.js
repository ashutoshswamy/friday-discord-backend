const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

const SEED_CONFIGS = {
 'wheat seed': { name: 'Wheat', time: 120, reward: 'Wheat', emoji: '', xpReward: 50 },
 'tomato seed': { name: 'Tomato', time: 300, reward: 'Tomato', emoji: '', xpReward: 100 },
 'carrot seed': { name: 'Carrot', time: 600, reward: 'Carrot', emoji: '', xpReward: 180 },
 'golden apple seed': { name: 'Golden Apple', time: 1800, reward: 'Golden Apple', emoji: '', xpReward: 400 }
};

const PLOT_UPGRADE_COSTS = {
 4: 3000,
 5: 6000,
 6: 12000,
 7: 24000,
 8: 48000
};

function formatRemainingTime(ms) {
 if (ms <= 0) return 'Ready to harvest!';
 const seconds = Math.floor((ms / 1000) % 60);
 const minutes = Math.floor((ms / (1000 * 60)) % 60);
 const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

 let timeStr = '';
 if (hours > 0) timeStr += `${hours}h `;
 if (minutes > 0 || hours > 0) timeStr += `${minutes}m `;
 timeStr += `${seconds}s`;
 return timeStr;
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('farm')
  .setDescription('Manage your garden plot — plant seeds, water, fertilize, treat pests, and harvest crops.')
  .addSubcommand(sub =>
   sub.setName('view')
    .setDescription('View your garden grid, active crop stages, and farming skill level.')
  )
  .addSubcommand(sub =>
   sub.setName('plant')
    .setDescription('Plant a seed on one of your empty garden plots.')
    .addStringOption(opt =>
     opt.setName('seed')
      .setDescription('Select the seed to plant')
      .setRequired(true)
      .addChoices(
       { name: ' Wheat Seed (2m growth)', value: 'Wheat Seed' },
       { name: ' Tomato Seed (5m growth)', value: 'Tomato Seed' },
       { name: ' Carrot Seed (10m growth)', value: 'Carrot Seed' },
       { name: ' Golden Apple Seed (30m growth)', value: 'Golden Apple Seed' }
      )
    )
    .addIntegerOption(opt =>
     opt.setName('plot')
      .setDescription('The plot slot number to plant on (e.g. 1, 2, 3)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8)
    )
  )
  .addSubcommand(sub =>
   sub.setName('water')
    .setDescription('Sprinkle well water on a crop (reduces remaining growth time by 25%).')
    .addIntegerOption(opt =>
     opt.setName('plot')
      .setDescription('The plot slot number to water')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8)
    )
  )
  .addSubcommand(sub =>
   sub.setName('fertilize')
    .setDescription('Apply fertilizer to boost growth speed or crop harvest yields.')
    .addStringOption(opt =>
     opt.setName('fertilizer')
      .setDescription('Select the fertilizer to apply')
      .setRequired(true)
      .addChoices(
       { name: ' Basic Fertilizer (50% faster remaining growth)', value: 'basic' },
       { name: ' Growth Serum (Instant growth)', value: 'growth' },
       { name: ' Yield Booster (Double harvested crops count)', value: 'yield' }
      )
    )
    .addIntegerOption(opt =>
     opt.setName('plot')
      .setDescription('The plot slot number to fertilize')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8)
    )
  )
  .addSubcommand(sub =>
   sub.setName('treat')
    .setDescription('Treat a pest infestation on a crop. Requires Pesticide in your inventory.')
    .addIntegerOption(opt =>
     opt.setName('plot')
      .setDescription('The plot slot number to treat')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8)
    )
  )
  .addSubcommand(sub =>
   sub.setName('harvest')
    .setDescription('Harvest a fully-grown crop for inventory rewards and farming XP.')
    .addIntegerOption(opt =>
     opt.setName('plot')
      .setDescription('The plot slot number to harvest')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8)
    )
  )
  .addSubcommand(sub =>
   sub.setName('expand')
    .setDescription('Buy another garden plot to plant more crops concurrently.')
  ),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const subcommand = options.getSubcommand();

  try {
   const fProfile = await db.getFarmingProfile(guild.id, user.id);

   if (subcommand === 'view') {
    const crops = await db.getUserCrops(guild.id, user.id);

    let cropsText = '';
    const maxPlots = fProfile.max_plots;

    for (let i = 1; i <= maxPlots; i++) {
     const crop = crops.find(c => c.plot_index === i);

     if (!crop) {
      cropsText += `### Plot #${i}: \`[Empty soil]\`\n*Run \`/farm plant seed:<seed> plot:${i}\` to sow crops here.*\n\n`;
     } else {
      const now = Date.now();
      const remainingMs = crop.harvest_ready.getTime() - now;
      const progressPct = Math.min(100, Math.floor(((crop.growth_time * 1000 - remainingMs) / (crop.growth_time * 1000)) * 100));
      
      let statusEmoji = '';
      if (progressPct >= 100) statusEmoji = '';
      else if (progressPct >= 50) statusEmoji = '';

      const timeText = remainingMs <= 0 ? ' **Ready to Harvest!**' : ` Grows in: **${formatRemainingTime(remainingMs)}** (${progressPct}%)`;
      const seedName = `${crop.crop_name.toLowerCase()} seed`;
      const config = SEED_CONFIGS[seedName] || { emoji: '' };

      const waterDrops = ''.repeat(crop.water_count) + ''.repeat(3 - crop.water_count);
      const pestText = crop.pests ? '  **INFESTED WITH PESTS!** (Cannot harvest; treat with Pesticide using `/farm treat`)' : ' None';
      
      let fertText = 'None';
      if (crop.fertilizer === 'basic') fertText = ' Basic Fertilizer (50% speedup applied)';
      else if (crop.fertilizer === 'growth') fertText = ' Growth Serum (Instant applied)';
      else if (crop.fertilizer === 'yield') fertText = ' Yield Booster (Double yield applied)';

      cropsText += `### Plot #${i}: ${config.emoji} ${crop.crop_name} ${statusEmoji}\n` +
       `• Status: ${timeText}\n` +
       `• Watering: [${waterDrops}] (Watered ${crop.water_count}/3 times)\n` +
       `• Fertilizer: ${fertText}\n` +
       `• Pests:${pestText}\n\n`;
     }
    }

    const xpNeeded = fProfile.level * 1000;
    const xpPercentage = Math.min(100, Math.floor((fProfile.xp / xpNeeded) * 100));
    const filledBlocks = Math.round(xpPercentage / 10);
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

    const container = new ContainerBuilder()
     .setAccentColor(0x2ECC71)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Garden Plots: ${user.username}\n` +
         `**Farming Skill:** Level **${fProfile.level}** · XP: \`[${progressBar}]\` **${fProfile.xp}** / **${xpNeeded}** (${xpPercentage}%)\n` +
         `**Garden Capacity:** **${crops.length}** / **${maxPlots}** active plots\n\n` +
         cropsText
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     )
     .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Plant crops, apply fertilizers, treat pests, and harvest items.'));

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'plant') {
    const seedInput = options.getString('seed');
    const plotIndex = options.getInteger('plot');

    if (plotIndex > fProfile.max_plots) {
     return interaction.editReply({
      content: `Invalid Plot Index! You only own **${fProfile.max_plots} plots**. Purchase more using \`/farm expand\`.`,
      ephemeral: true
     });
    }

    const crops = await db.getUserCrops(guild.id, user.id);
    const alreadyOccupied = crops.some(c => c.plot_index === plotIndex);
    if (alreadyOccupied) {
     return interaction.editReply({
      content: `Plot #${plotIndex} is already occupied! Harvest the crop first or plant on an empty plot.`,
      ephemeral: true
     });
    }

    const normalizedSeed = seedInput.toLowerCase();
    const config = SEED_CONFIGS[normalizedSeed];

    const inventory = await db.getInventory(guild.id, user.id);
    const hasSeed = inventory.some(item => item.toLowerCase() === normalizedSeed);

    if (!hasSeed) {
     return interaction.editReply({
      content: `You do not own any **${seedInput}**! Purchase seeds from the shop using \`/buy\`.`,
      ephemeral: true
     });
    }

    // Remove seed
    const removed = await db.removeItemFromInventory(guild.id, user.id, seedInput);
    if (!removed) {
     return interaction.editReply({ content: 'Could not consume the seed. Try again.', ephemeral: true });
    }

    // Plant
    const result = await db.plantCrop(guild.id, user.id, config.name, config.time, plotIndex);
    if (!result || !result.success) {
     await db.addItemToInventory(guild.id, user.id, seedInput); // refund
     return interaction.editReply({ content: 'Database failed to plant crop. Refunded seed.', ephemeral: true });
    }

    // Give some small planting XP
    await db.addFarmingXp(guild.id, user.id, 20);

    const container = new ContainerBuilder()
     .setAccentColor(0x2ECC71)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Seed Sown on Plot #${plotIndex}!\n` +
          `You tilled the soil and sowed a **${seedInput}**.\n\n` +
          `• **Crop:** ${config.emoji} ${config.name}\n` +
          `• **Growth Duration:** **${formatRemainingTime(config.time * 1000)}**\n` +
          `• **Status:** Watering or applying fertilizers accelerates growth.`
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'water') {
    const plotIndex = options.getInteger('plot');

    const crops = await db.getUserCrops(guild.id, user.id);
    const crop = crops.find(c => c.plot_index === plotIndex);

    if (!crop) {
     return interaction.editReply({ content: `Plot #${plotIndex} has no crop planted to water!`, ephemeral: true });
    }

    const now = Date.now();
    if (crop.harvest_ready.getTime() <= now) {
     return interaction.editReply({ content: `The crop on Plot #${plotIndex} is already fully grown! Harvest it instead.`, ephemeral: true });
    }

    if (crop.water_count >= 3) {
     return interaction.editReply({ content: `Crop on Plot #${plotIndex} is already fully hydrated (3/3 times watered).`, ephemeral: true });
    }

    const result = await db.waterCrop(guild.id, user.id, crop.id);
    if (!result || !result.success) {
     return interaction.editReply({ content: `Failed to water crop: ${result?.reason || 'Unknown error.'}`, ephemeral: true });
    }

    await db.incrementQuestProgress(guild.id, user.id, 'water', null, 1);
    await db.addFarmingXp(guild.id, user.id, 10);

    let pestNotice = '';
    if (result.crop.pests) {
     pestNotice = `\n\n **WARNING:** Oh no! Damp soil has attracted **Pests**! The crop is now infested and cannot be harvested until treated with Pesticide using \`/farm treat\`.`;
    }

    const remainingMs = new Date(result.crop.harvest_ready).getTime() - Date.now();
    const timeText = remainingMs <= 0 ? ' **Ready to Harvest!**' : ` Ready in: **${formatRemainingTime(remainingMs)}**`;

    const container = new ContainerBuilder()
     .setAccentColor(0x3498DB)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Plot #${plotIndex} Irrigated!\n` +
          `You watered your ${crop.crop_name}.\n\n` +
          `• **Watering Progress:** [${''.repeat(result.crop.water_count) + ''.repeat(3 - result.crop.water_count)}] (${result.crop.water_count}/3)\n` +
          `• **New Growth status:** ${timeText}${pestNotice}`
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'fertilize') {
    const fertType = options.getString('fertilizer');
    const plotIndex = options.getInteger('plot');

    let itemNeeded = 'Basic Fertilizer';
    if (fertType === 'growth') itemNeeded = 'Growth Serum';
    else if (fertType === 'yield') itemNeeded = 'Yield Booster';

    const inventory = await db.getInventory(guild.id, user.id);
    const hasFert = inventory.some(item => item.toLowerCase() === itemNeeded.toLowerCase());

    if (!hasFert) {
     return interaction.editReply({
      content: `You do not own any **${itemNeeded}**! Craft it using \`/craft item\` first.`,
      ephemeral: true
     });
    }

    const crops = await db.getUserCrops(guild.id, user.id);
    const crop = crops.find(c => c.plot_index === plotIndex);

    if (!crop) {
     return interaction.editReply({ content: `Plot #${plotIndex} has no crop planted to fertilize!`, ephemeral: true });
    }

    if (crop.fertilizer) {
     return interaction.editReply({ content: `Plot #${plotIndex} has already been fertilized! Only one fertilizer can be applied per growth cycle.`, ephemeral: true });
    }

    // Consume item
    const removed = await db.removeItemFromInventory(guild.id, user.id, itemNeeded);
    if (!removed) {
     return interaction.editReply({ content: `Failed to consume **${itemNeeded}**. Try again.`, ephemeral: true });
    }

    // Fertilize
    const result = await db.fertilizeCrop(guild.id, user.id, crop.id, fertType);
    if (!result || !result.success) {
     await db.addItemToInventory(guild.id, user.id, itemNeeded); // refund
     return interaction.editReply({ content: `Failed to apply fertilizer: ${result?.reason || 'Database error.'}`, ephemeral: true });
    }

    await db.addFarmingXp(guild.id, user.id, 15);

    let effectDesc = '';
    if (fertType === 'basic') effectDesc = 'Remaining growth time reduced by **50%**!';
    else if (fertType === 'growth') effectDesc = 'Rapid maturity achieved! Ready to harvest instantly!';
    else if (fertType === 'yield') effectDesc = 'Soil enriched! Harvest yield amount will be **doubled**!';

    const container = new ContainerBuilder()
     .setAccentColor(0x9B59B6)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Soil Fertilized on Plot #${plotIndex}!\n` +
          `You applied **${itemNeeded}** to your crop.\n\n` +
          `• **Effect:** ${effectDesc}`
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'treat') {
    const plotIndex = options.getInteger('plot');

    const crops = await db.getUserCrops(guild.id, user.id);
    const crop = crops.find(c => c.plot_index === plotIndex);

    if (!crop) {
     return interaction.editReply({ content: `Plot #${plotIndex} has no crop planted!`, ephemeral: true });
    }

    if (!crop.pests) {
     return interaction.editReply({ content: `The crop on Plot #${plotIndex} is not infested by pests.`, ephemeral: true });
    }

    const inventory = await db.getInventory(guild.id, user.id);
    const hasPesticide = inventory.some(item => item.toLowerCase() === 'pesticide');

    if (!hasPesticide) {
     return interaction.editReply({
      content: `You do not own any **Pesticide**! Craft some using \`/craft item name:pesticide\` to treat the crop.`,
      ephemeral: true
     });
    }

    // Consume Pesticide
    const removed = await db.removeItemFromInventory(guild.id, user.id, 'Pesticide');
    if (!removed) {
     return interaction.editReply({ content: 'Failed to use Pesticide. Try again.', ephemeral: true });
    }

    const result = await db.treatCropPests(guild.id, user.id, crop.id);
    if (!result || !result.success) {
     await db.addItemToInventory(guild.id, user.id, 'Pesticide'); // refund
     return interaction.editReply({ content: 'Failed to treat pest infestation.', ephemeral: true });
    }

    await db.addFarmingXp(guild.id, user.id, 15);

    const container = new ContainerBuilder()
     .setAccentColor(0x27AE60)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Pests Treated on Plot #${plotIndex}!\n` +
          `You sprayed **Pesticide** over your crop. All pests have been cleared!\n\n` +
          `• **Status:** Crop is clean and ready for healthy harvesting.`
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'harvest') {
    const plotIndex = options.getInteger('plot');

    const crops = await db.getUserCrops(guild.id, user.id);
    const crop = crops.find(c => c.plot_index === plotIndex);

    if (!crop) {
     return interaction.editReply({ content: `Plot #${plotIndex} has no crop planted!`, ephemeral: true });
    }

    const now = Date.now();
    if (crop.harvest_ready.getTime() > now) {
     const remainingMs = crop.harvest_ready.getTime() - now;
     return interaction.editReply({
      content: `The crop on Plot #${plotIndex} is not fully grown yet! Wait **${formatRemainingTime(remainingMs)}** before harvesting.`,
      ephemeral: true
     });
    }

    if (crop.pests) {
     return interaction.editReply({
      content: `Plot #${plotIndex} crop is infested by pests! Clear them using \`/farm treat\` first.`,
      ephemeral: true
     });
    }

    // Perform harvest deletion
    const deleted = await db.harvestCrop(guild.id, user.id, crop.id);
    if (!deleted) {
     return interaction.editReply({ content: 'Failed to harvest crop. Try again.', ephemeral: true });
    }

    // Roll Quality based on Farming Level
    const roll = Math.random();
    const goldChance = 0.10 + (fProfile.level - 1) * 0.02; // +2% gold chance per level
    const silverChance = 0.25 + (fProfile.level - 1) * 0.02; // +2% silver chance per level

    let qualityPrefix = '';
    let qualityName = 'Regular';
    let qualityColor = 0x2ECC71;

    if (roll < goldChance) {
     qualityPrefix = 'gold ';
     qualityName = ' Gold Star (2.5× value)';
     qualityColor = 0xF1C40F;
    } else if (roll < goldChance + silverChance) {
     qualityPrefix = 'silver ';
     qualityName = ' Silver Star (1.5× value)';
     qualityColor = 0xBDC3C7;
    }

    const seedConfig = SEED_CONFIGS[`${crop.crop_name.toLowerCase()} seed`] || { reward: 'Wheat', xpReward: 50 };
    const rewardName = `${qualityPrefix}harvested ${seedConfig.reward.toLowerCase()}`;

    // Yield quantity based on Yield Booster
    const count = crop.fertilizer === 'yield' ? 2 : 1;

    // Add to inventory
    for (let c = 0; c < count; c++) {
     await db.addItemToInventory(guild.id, user.id, rewardName);
    }

    // Award farming XP
    const baseXp = seedConfig.xpReward;
    const finalXp = baseXp * count;
    const xpResult = await db.addFarmingXp(guild.id, user.id, finalXp);

    // Increment quests progress
    await db.incrementQuestProgress(guild.id, user.id, 'farm', null, count);

    let xpMsg = `\n**Farming XP:** **+${finalXp} XP** (Level **${xpResult.newLevel}** · ${xpResult.newXp}/${xpResult.newLevel * 1000})`;
    if (xpResult.levelUp) {
     xpMsg += `\n **LEVEL UP!** Your agricultural proficiency increased! You are now **Farming Level ${xpResult.newLevel}**!`;
    }

    const container = new ContainerBuilder()
     .setAccentColor(qualityColor)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Harvest Successful on Plot #${plotIndex}!\n` +
          `You harvested the fully grown ${crop.crop_name}.\n\n` +
          `• **Yield:** **${count}x** **${rewardName.replace(/\b\w/g, c => c.toUpperCase())}**\n` +
          `• **Quality:** **${qualityName}**` +
          xpMsg
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (subcommand === 'expand') {
    const nextPlot = fProfile.max_plots + 1;
    if (nextPlot > 8) {
     return interaction.editReply({ content: 'You have reached the maximum garden capacity of **8 plots**!', ephemeral: true });
    }

    const cost = PLOT_UPGRADE_COSTS[nextPlot];
    const result = await db.expandFarmPlots(guild.id, user.id, cost);

    if (!result || !result.success) {
     return interaction.editReply({ content: `Upgrade declined: ${result?.reason || 'Database transaction error.'}`, ephemeral: true });
    }

    const container = new ContainerBuilder()
     .setAccentColor(0xF1C40F)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `##  Garden Plots Expanded!\n` +
          `You paid ${EMOJIS.coin} **${cost.toLocaleString()}** coins and tilled new fertile soil.\n\n` +
          `• **New Garden capacity:** **${result.newMaxPlots} plots** available!`
        )
       )
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

  } catch (err) {
   console.error('[FARM ERROR]', err);
   const errMsg = { content: 'Failed to process farming action.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
