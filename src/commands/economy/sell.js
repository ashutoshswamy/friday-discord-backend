const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { EMOJIS, getEmoji } = require('../../utils/emojis');
const db = require('../../utils/db');

const SELL_CATALOG = {
 // ── Fish ──
 'junk seaweed': 20, 'old boot': 50,
 'clam': 100, 'common bass': 150,
 'pufferfish': 350, 'salmon': 300,
 'goldfish': 500, 'lobster': 900,
 'tropical coral fish': 800,
 'shark tooth': 2000,
 'ancient pearl': 6000,
 'mythical whale': 5000,
 // ── Hunt ──
 'rabbit': 180, 'eagle feather': 400,
 'duck': 250, 'deer': 500,
 'deer antler': 600, 'wild boar': 800,
 'wolf pelt': 1200,
 'grizzly bear': 2500,
 'dragon scale': 8000,
 // ── Dig ──
 'common worm': 15, 'old coin': 300,
 'cracked geode': 150, 'dirt fossil': 200,
 'ancient vase': 800,
 'sapphire': 2500, 'ruby': 4000,
 'diamond': 9000,
 'buried gold chest': 3000,
 // ── Mine ──
 'coal': 80, 'iron ore': 150,
 'gold ore': 400, 'quartz crystal': 600,
 'emerald': 2000, 'ruby shard': 3500,
 'diamond ore': 7000,
 'crystal shard': 12000,
 'mythril core': 18000,
 // ── Collectibles ──
 'silver ring': 1000,
 'common gem': 750,
 'rare gem': 3500,
 'legendary gem': 12000,
 // ── Chop Wood ──
 'pine log': 120, 'oak log': 220,
 'birch log': 350, 'mahogany log': 600,
 'yew log': 1200, 'elderwood log': 3000,
 'golden sap': 8000,
 // ── Hack Intrusion ──
 'decrypted hard drive': 500,
 'mainframe core': 1500,
 'stolen crypto key': 3500,
 // ── Farm Harvests ──
 'harvested wheat': 80,
 'silver harvested wheat': 120,
 'gold harvested wheat': 200,
 'harvested tomato': 150,
 'silver harvested tomato': 225,
 'gold harvested tomato': 375,
 'harvested carrot': 250,
 'silver harvested carrot': 375,
 'gold harvested carrot': 625,
 'harvested golden apple': 1200,
 'silver harvested golden apple': 1800,
 'gold harvested golden apple': 3000,
};

module.exports = {
 data: new SlashCommandBuilder()
 .setName('sell')
 .setDescription('Sells acquired grinding loot back to the server for quick cash.')
 .addStringOption(option => option.setName('item').setDescription('The exact name of the item to sell').setRequired(true))
 .addIntegerOption(option => option.setName('amount').setDescription('The quantity to sell (defaults to 1)').setMinValue(1).setRequired(false)),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const itemNameInput = interaction.options.getString('item').trim();
 const sellAmount = interaction.options.getInteger('amount') || 1;
 const normalizedName = itemNameInput.toLowerCase();
 const baseValue = SELL_CATALOG[normalizedName];

 if (baseValue === undefined) {
 return interaction.editReply({
 content: `The merchant shop does not buy **${itemNameInput}**! Only sell grinding loot (fish, animals, fossils, treasures) or list collectibles on \`/market\`.`,
 ephemeral: true
 });
 }

 try {
 const inventory = await db.getInventory(guild.id, user.id);
 const matchedItems = inventory.filter(i => i.toLowerCase() === normalizedName);

 if (matchedItems.length < sellAmount) {
 return interaction.editReply({
 content: `You only possess **${matchedItems.length}** copies of **${itemNameInput}** but tried to sell **${sellAmount}**.`,
 ephemeral: true
 });
 }

  const marketPrices = await db.getMarketPrices(guild.id, SELL_CATALOG);
  const itemData = marketPrices[normalizedName];
  const activePrice = itemData ? itemData.price : baseValue;

  let removedCount = 0;
  const originalItemName = matchedItems[0];

  for (let i = 0; i < sellAmount; i++) {
   const removed = await db.removeItemFromInventory(guild.id, user.id, originalItemName);
   if (removed) removedCount++;
  }

  if (removedCount === 0) {
   return interaction.editReply({ content: 'Failed to execute transaction. Try again.', ephemeral: true });
  }

  // Decay the item price based on supply increase
  await db.updateMarketPrice(guild.id, originalItemName, baseValue, removedCount);

  const basePayout = removedCount * activePrice;
  let clanBonus = 0;
  let clanBonusPercent = 0;
  let clanXpGained = 0;
  let clanXpMsg = '';

  const clan = await db.getClanByMember(guild.id, user.id);
  if (clan) {
    clanBonusPercent = clan.level * 2; // +2% per clan level
    clanBonus = Math.round(basePayout * (clanBonusPercent / 100));
    clanXpGained = removedCount * 15; // 15 XP per item sold
    const xpResult = await db.addClanXp(guild.id, clan.id, clanXpGained);

    clanXpMsg = `\n**Clan XP Contributed:** **+${clanXpGained} XP** to **${clan.name}**`;
    if (xpResult.levelUp) {
      clanXpMsg += `\n **CLAN LEVELED UP!** **${clan.name}** is now **Level ${xpResult.newLevel}**!`;
    }
  }

  const finalPayout = basePayout + clanBonus;
  await db.incrementQuestProgress(guild.id, user.id, 'sell', null, removedCount);
  const newWallet = await db.updateCoins(guild.id, user.id, finalPayout);

  let detailsText = '';
  if (itemData && itemData.eventText) {
    detailsText += `️ **Market Event Active:** *${itemData.eventText}*\n\n`;
  }

  detailsText += `**Unit Price (Dynamic Market):** ${EMOJIS.coin} **${activePrice.toLocaleString()}** coins\n` +
   `**Base Value:** ${EMOJIS.coin} **${baseValue.toLocaleString()}** coins\n` +
   `**Total Sold:** **${removedCount}×**\n` +
   `**Base Payout:** ${EMOJIS.coin} **${basePayout.toLocaleString()}** coins\n`;

  if (clanBonus > 0) {
    detailsText += `**Clan Multiplier Bonus (+${clanBonusPercent}%):** ${EMOJIS.coin} **+${clanBonus.toLocaleString()}** coins\n`;
  }

  detailsText += `**Total Earned:** ${EMOJIS.coin} **+${finalPayout.toLocaleString()}** coins\n` +
   `**New Wallet:** ${EMOJIS.coin} **${newWallet.toLocaleString()}** coins` +
   clanXpMsg;

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
  `## Merchant Trade Confirmed\nYou traded **${removedCount}x ${getEmoji(originalItemName)} ${originalItemName}** to the local merchant!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(detailsText)
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[SELL ERROR]', err);
 const errMsg = { content: 'An error occurred during the merchant sale transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 },
 SELL_CATALOG
};
