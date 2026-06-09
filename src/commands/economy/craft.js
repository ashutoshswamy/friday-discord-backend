const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS, getEmoji } = require('../../utils/emojis');

const RECIPES = {
 axe: {
  name: 'Axe',
  description: 'Lumberjack axe required to chop wood.',
  ingredients: { 'iron ore': 5, 'oak log': 3 },
  result: 'Axe',
  emoji: ''
 },
 laptop: {
  name: 'Hacker Laptop',
  description: 'Black-market hacker deck required for mainframe intrusions.',
  ingredients: { 'coal': 10, 'gold ore': 5, 'birch log': 5 },
  result: 'Hacker Laptop',
  emoji: ''
 },
 pole: {
  name: 'Fishing Pole',
  description: 'Robust casting rod required to go fishing.',
  ingredients: { 'pine log': 5, 'common worm': 3 },
  result: 'Fishing Pole',
  emoji: ''
 },
 shovel: {
  name: 'Shovel',
  description: 'Excavation shovel required to dig up treasures.',
  ingredients: { 'iron ore': 3, 'pine log': 2 },
  result: 'Shovel',
  emoji: ''
 },
 lootbox: {
  name: 'Lootbox',
  description: 'Interactive spinner chest containing random items.',
  ingredients: { 'silver ring': 1, 'common gem': 1 },
  result: 'Lootbox',
  emoji: ''
 },
 drink: {
  name: 'Energy Drink',
  description: 'Restores stamina and awards 300 coins instantly.',
  ingredients: { 'junk seaweed': 3, 'pufferfish': 1 },
  result: 'Energy Drink',
  emoji: ''
 },
 sap: {
  name: 'Golden Sap',
  description: 'Highly valuable resin extracted from elder trees.',
  ingredients: { 'pine log': 10, 'oak log': 5, 'gold ore': 1 },
  result: 'Golden Sap',
  emoji: ''
 },
 fertilizer: {
  name: 'Basic Fertilizer',
  description: 'Red-brown compost. Speeds up crop growth by 50% instantly.',
  ingredients: { 'coal': 3, 'junk seaweed': 2 },
  result: 'Basic Fertilizer',
  emoji: ''
 },
 serum: {
  name: 'Growth Serum',
  description: 'Glowing golden fluid. Near-instant crop growth (1 second remaining).',
  ingredients: { 'golden sap': 1, 'quartz crystal': 2 },
  result: 'Growth Serum',
  emoji: ''
 },
 booster: {
  name: 'Yield Booster',
  description: 'Enriched soil mix. Doubles the amount of crops harvested.',
  ingredients: { 'gold ore': 3, 'ancient pearl': 1 },
  result: 'Yield Booster',
  emoji: ''
 },
 pesticide: {
  name: 'Pesticide',
  description: 'Chemical treatment to cure pest infestations on growing crops.',
  ingredients: { 'coal': 2, 'pufferfish': 2 },
  result: 'Pesticide',
  emoji: ''
 }
};

const RECIPE_KEYS = Object.keys(RECIPES);
const CRAFT_PAGE_SIZE = 4;

module.exports = {
 data: new SlashCommandBuilder()
  .setName('craft')
  .setDescription('Combine materials in your inventory to craft new items and tools.')
  .addSubcommand(sub =>
   sub.setName('list')
    .setDescription('View all available crafting recipes.')
  )
  .addSubcommand(sub =>
   sub.setName('item')
    .setDescription('Craft a specific item using ingredients from your inventory.')
    .addStringOption(opt =>
     opt.setName('name')
      .setDescription('Select the item to craft')
      .setRequired(true)
      .addChoices(
       { name: ' Axe', value: 'axe' },
       { name: ' Hacker Laptop', value: 'laptop' },
       { name: ' Fishing Pole', value: 'pole' },
       { name: ' Shovel', value: 'shovel' },
       { name: ' Lootbox', value: 'lootbox' },
       { name: ' Energy Drink', value: 'drink' },
       { name: ' Golden Sap', value: 'sap' },
       { name: ' Basic Fertilizer', value: 'fertilizer' },
       { name: ' Growth Serum', value: 'serum' },
       { name: ' Yield Booster', value: 'booster' },
       { name: ' Pesticide', value: 'pesticide' }
      )
    )
  ),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const subcommand = options.getSubcommand();

  try {
   if (subcommand === 'list') {
    const totalPages = Math.ceil(RECIPE_KEYS.length / CRAFT_PAGE_SIZE);
    let currentPage = 0;

    const buildCraftPage = (page, disabled = false) => {
     const start = page * CRAFT_PAGE_SIZE;
     const pageKeys = RECIPE_KEYS.slice(start, start + CRAFT_PAGE_SIZE);

     let recipesText = '';
     for (const key of pageKeys) {
      const r = RECIPES[key];
      const ingredientLines = [];
      for (const ing in r.ingredients) {
       ingredientLines.push(`• **${r.ingredients[ing]}x** ${getEmoji(ing)} ${ing.replace(/\b\w/g, c => c.toUpperCase())}`);
      }
      recipesText += `### ${getEmoji(r.name)} ${r.name}\n*${r.description}*\n**Requires:**\n${ingredientLines.join('\n')}\n\n`;
     }

     const container = new ContainerBuilder()
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(`## ️ Crafting Blueprint Catalog\nCombine gathered logs, ores, and scraps to craft advanced items.\n\n${recipesText}`)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Craft items by running `/craft item name:<choice>`'));

     if (totalPages > 1) {
      const prevBtn = new ButtonBuilder()
       .setCustomId('craft_list_prev')
       .setLabel('← Prev')
       .setStyle(ButtonStyle.Secondary)
       .setDisabled(page === 0 || disabled);
      const pageIndBtn = new ButtonBuilder()
       .setCustomId('craft_list_page_ind')
       .setLabel(`${page + 1} / ${totalPages}`)
       .setStyle(ButtonStyle.Secondary)
       .setDisabled(true);
      const nextBtn = new ButtonBuilder()
       .setCustomId('craft_list_next')
       .setLabel('Next →')
       .setStyle(ButtonStyle.Primary)
       .setDisabled(page >= totalPages - 1 || disabled);
      container.addActionRowComponents(new ActionRowBuilder().addComponents(prevBtn, pageIndBtn, nextBtn));
     }

     return container;
    };

    const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildCraftPage(0)] });

    if (totalPages > 1) {
     const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === user.id,
      time: 120000
     });

     collector.on('collect', async i => {
      await i.deferUpdate();
      if (i.customId === 'craft_list_prev') currentPage = Math.max(0, currentPage - 1);
      else if (i.customId === 'craft_list_next') currentPage = Math.min(totalPages - 1, currentPage + 1);
      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildCraftPage(currentPage)] });
     });

     collector.on('end', async () => {
      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildCraftPage(currentPage, true)] }).catch(() => null);
     });
    }

    return;
   }

   if (subcommand === 'item') {
    const choice = options.getString('name');
    const recipe = RECIPES[choice];

    if (!recipe) {
     return interaction.editReply({ content: 'Invalid recipe selection.', ephemeral: true });
    }

    const inventory = await db.getInventory(guild.id, user.id);
    const itemCounts = {};
    inventory.forEach(item => {
     const norm = item.toLowerCase();
     itemCounts[norm] = (itemCounts[norm] || 0) + 1;
    });

    const missing = [];
    for (const ing in recipe.ingredients) {
     const req = recipe.ingredients[ing];
     const possess = itemCounts[ing] || 0;
     if (possess < req) {
      missing.push(`• **${req - possess}x** ${ing.replace(/\b\w/g, c => c.toUpperCase())}`);
     }
    }

    if (missing.length > 0) {
     return interaction.editReply({
      content: `You do not have enough ingredients to craft **${recipe.name}**!\n**Missing:**\n${missing.join('\n')}`,
      ephemeral: true
     });
    }

    // Consume items
    for (const ing in recipe.ingredients) {
     const req = recipe.ingredients[ing];
     const matchCaseName = inventory.find(i => i.toLowerCase() === ing);
     for (let i = 0; i < req; i++) {
      await db.removeItemFromInventory(guild.id, user.id, matchCaseName);
     }
    }

    // Add result
    await db.addItemToInventory(guild.id, user.id, recipe.result);

    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## ️ Crafting Success!\n` +
          `You stilled your hands and forged a brand new item!\n\n` +
          `**Item Crafted:** ${recipe.emoji} **${recipe.result}**\n` +
          `**Result:** Placed in your inventory.`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

  } catch (err) {
   console.error('[CRAFT ERROR]', err);
   const errMsg = { content: 'Failed to process crafting operations.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
