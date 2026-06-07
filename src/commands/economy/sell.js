const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const SELL_CATALOG = {
 'common bass': 150, 'salmon': 300, 'goldfish': 500, 'tropical coral fish': 800, 'mythical whale': 5000,
 'junk seaweed': 20, 'old boot': 50,
 'rabbit': 180, 'duck': 250, 'deer': 500, 'wild boar': 800, 'grizzly bear': 2500,
 'common worm': 15, 'dirt fossil': 200, 'ancient vase': 800, 'buried gold chest': 3000,
 'silver ring': 1000
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

 let removedCount = 0;
 const originalItemName = matchedItems[0];

 for (let i = 0; i < sellAmount; i++) {
 const removed = await db.removeItemFromInventory(guild.id, user.id, originalItemName);
 if (removed) removedCount++;
 }

 if (removedCount === 0) {
 return interaction.editReply({ content: 'Failed to execute transaction. Try again.', ephemeral: true });
 }

 const totalPayout = removedCount * baseValue;
 const newWallet = await db.updateCoins(guild.id, user.id, totalPayout);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Merchant Trade Confirmed\nYou traded **${removedCount}x ${originalItemName}** to the local merchant!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Unit Price:** <:coin:1512926963239489606> **${baseValue.toLocaleString()}** coins\n` +
 `**Total Sold:** **${removedCount}×**\n` +
 `**Earned:** <:coin:1512926963239489606> **+${totalPayout.toLocaleString()}** coins\n` +
 `**New Wallet:** <:coin:1512926963239489606> **${newWallet.toLocaleString()}** coins`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[SELL ERROR]', err);
 const errMsg = { content: 'An error occurred during the merchant sale transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
