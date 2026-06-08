const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('market')
 .setDescription('Interact with the player-driven server item market.')
 .addSubcommand(sub =>
 sub.setName('view')
 .setDescription('View active item listings posted by other players.'))
 .addSubcommand(sub =>
 sub.setName('list')
 .setDescription('Post an item from your inventory up for sale on the global market.')
 .addStringOption(opt =>
 opt.setName('item')
 .setDescription('The exact name of the item from your inventory')
 .setRequired(true))
 .addIntegerOption(opt =>
 opt.setName('price')
 .setDescription('The custom price in coins to sell the item for')
 .setMinValue(1)
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('buy')
 .setDescription('Purchase an item listing from the market.')
 .addIntegerOption(opt =>
 opt.setName('id')
 .setDescription('The ID of the market listing to buy')
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('cancel')
 .setDescription('Cancel an active listing you posted and reclaim the item.')
 .addIntegerOption(opt =>
 opt.setName('id')
 .setDescription('The ID of your market listing to cancel')
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('index')
 .setDescription('View the dynamic supply/demand commodity price indices.')),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const subcommand = options.getSubcommand();

 try {
 if (subcommand === 'view') {
 const listings = await db.getMarketListings(guild.id);

 if (listings.length === 0) {
 return interaction.editReply({
 content: 'The player-driven market is currently empty! Use `/market list` to post your collectibles.',
 ephemeral: false
 });
 }

 const listingsText = listings.map(listing =>
 `**Listing #${listing.id}: ${listing.itemName}**\n` +
 `• Price: ${EMOJIS.coin} \`${listing.price.toLocaleString()}\` coins\n` +
 `• Seller: <@${listing.sellerId}>\n` +
 `• Posted: <t:${Math.floor(new Date(listing.createdAt).getTime() / 1000)}:R>`
 ).join('\n\n');

 const container = new ContainerBuilder()
 .setAccentColor(0x00E5FF)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Player-Driven Market\nWelcome to the server bazaar! Buy items from other players or list your own collectibles.\n\nUse \`/market buy [id]\` to purchase · \`/market cancel [id]\` to cancel your listings.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(listingsText)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'list') {
 const itemName = options.getString('item').trim();
 const price = options.getInteger('price');

 const inventory = await db.getInventory(guild.id, user.id);
 const matchedItem = inventory.find(i => i.toLowerCase() === itemName.toLowerCase());

 if (!matchedItem) {
 return interaction.editReply({
 content: `You do not possess any **${itemName}** in your inventory to list for sale!`,
 ephemeral: true
 });
 }

 const success = await db.listMarketItem(guild.id, user.id, matchedItem, price);

 if (!success) {
 return interaction.editReply({
 content: 'Failed to list item on the market. Please try again.',
 ephemeral: true
 });
 }

 const container = new ContainerBuilder()
 .setAccentColor(0x00E5FF)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Market Listing Created\nSuccessfully posted **${matchedItem}** on the global bazaar!\nOther players can now buy it using its listing ID.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Item Listed:** **${matchedItem}**\n` +
 `**Price Set:** ${EMOJIS.coin} **${price.toLocaleString()}** coins\n` +
 `**Seller:** <@${user.id}>`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'buy') {
 const listingId = options.getInteger('id');
 const result = await db.buyMarketItem(guild.id, user.id, listingId);

 if (!result.success) {
 return interaction.editReply({
 content: `Transaction declined: ${result.reason || 'Invalid transaction.'}`,
 ephemeral: true
 });
 }

 const container = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Market Purchase Confirmed\nSuccessfully purchased **${result.itemName}** from the server bazaar!\nThe item has been added to your inventory.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Item Acquired:** **${result.itemName}**\n` +
 `**Price Paid:** ${EMOJIS.coin} **${result.price.toLocaleString()}** coins\n` +
 `**Seller Compensated:** <@${result.sellerId}>`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'cancel') {
 const listingId = options.getInteger('id');
 const success = await db.cancelMarketListing(guild.id, user.id, listingId);

 if (!success) {
 return interaction.editReply({
 content: `Could not cancel listing. Verify listing ID exists and was posted by you.`,
 ephemeral: true
 });
 }

 const container = new ContainerBuilder()
 .setAccentColor(0x9CA3AF)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Market Listing Cancelled\nListing **#${listingId}** has been removed from the bazaar.\nThe item has been safely returned to your inventory.`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'index') {
  const { SELL_CATALOG } = require('./sell');
  const marketPrices = await db.getMarketPrices(guild.id, SELL_CATALOG);

  const categories = {
   ' Forestry': ['pine log', 'oak log', 'birch log', 'mahogany log', 'yew log', 'elderwood log', 'golden sap'],
   ' Fishing': ['junk seaweed', 'old boot', 'clam', 'common bass', 'salmon', 'pufferfish', 'goldfish', 'lobster', 'tropical coral fish', 'shark tooth', 'ancient pearl', 'mythical whale'],
   '️ Mining': ['coal', 'iron ore', 'gold ore', 'quartz crystal', 'emerald', 'ruby shard', 'diamond ore', 'crystal shard', 'mythril core'],
   ' Agriculture': ['harvested wheat', 'harvested tomato', 'harvested carrot', 'harvested golden apple'],
   ' Hacking': ['decrypted hard drive', 'mainframe core', 'stolen crypto key']
  };

  let indexText = '';
  for (const catName in categories) {
   let catText = '';
   categories[catName].forEach(rawName => {
    const basePrice = SELL_CATALOG[rawName];
    if (basePrice === undefined) return;
    const current = marketPrices[rawName];
    const price = current ? current.price : basePrice;

    const change = price - basePrice;
    const trendSign = change > 0 ? ' +' : change < 0 ? ' -' : '️ ';
    const diffText = change !== 0 ? ` (${trendSign}${Math.abs(change)} coins)` : '';
    const eventSuffix = current && current.eventText ? ` · *Event active!*` : '';

    catText += `• **${rawName.replace(/\b\w/g, c => c.toUpperCase())}**: ${EMOJIS.coin} **${price.toLocaleString()}** coins${diffText}${eventSuffix}\n`;
   });

   if (catText.length > 0) {
    indexText += `### ${catName}\n${catText}\n`;
   }
  }

  const container = new ContainerBuilder()
   .setAccentColor(0x3498DB)
   .addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `##  Dynamic Commodity Market Index\n` +
       `Prices fluctuate based on global player sell supply. Every sale decays price instantly. Prices recover slowly every hour towards base values.\n\n` +
       indexText
      )
     )
     .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
   )
   .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Sell items at their current index price using `/sell`.'));

  return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 } catch (err) {
 console.error('[MARKET ERROR]', err);
 const _errMsg = { content: 'Failed to process market bazaar operations. Please verify database columns.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
