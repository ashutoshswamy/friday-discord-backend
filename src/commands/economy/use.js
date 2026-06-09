const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const { EMOJIS, getEmoji, getEmojiId } = require('../../utils/emojis');
const db = require('../../utils/db');

const BUILT_IN_CONSUMABLES = new Set([
 'pizza', 'energy drink', 'gamer energy drink', 'lootbox', 'prize box',
 'xp potion', 'coin bomb', 'mystery crate', 'work gloves'
]);

async function processItem(guild, user, matchedItem, shopItems) {
 const normalizedName = matchedItem.toLowerCase();

 if (normalizedName === 'pizza') {
 await db.addXp(guild.id, user.id, 150);
 return {
 container: new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Delicious Pizza!\nYou ate the ${getEmoji('pizza')} **Pizza**! It was absolutely delicious!\nYou gained ** 150 XP** instantly towards your rank.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 };
 }

 if (normalizedName === 'energy drink' || normalizedName === 'gamer energy drink') {
 await db.updateCoins(guild.id, user.id, 300);
 return {
 container: new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Energy Boost!\nYou gulped down the ${getEmoji(matchedItem)} **${matchedItem}** and felt a surge of productivity!\nYou earned **${EMOJIS.coin} 300 coins** directly in your wallet.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 };
 }

 if (normalizedName === 'lootbox' || normalizedName === 'prize box') {
 const roll = Math.random();
 let prizeTitle, prizeDesc;

 if (roll < 0.10) {
 await db.updateCoins(guild.id, user.id, 2500);
 prizeTitle = ' JACKPOT WINNER!';
 prizeDesc = `You hit the **SUPER JACKPOT**!\nYou won a massive **${EMOJIS.coin} 2,500 coins** directly in your wallet!`;
 } else if (roll < 0.30) {
 await db.addItemToInventory(guild.id, user.id, 'Silver Ring');
 prizeTitle = ' Rare Item!';
 prizeDesc = `You extracted a rare collectible:\n ${getEmoji('Silver Ring')} **Silver Ring** added to your \`/inventory\`!`;
 } else if (roll < 0.60) {
 const xpGain = Math.floor(Math.random() * 201) + 100;
 await db.addXp(guild.id, user.id, xpGain);
 prizeTitle = ' Leveling Spark!';
 prizeDesc = `The Lootbox erupted with leveling energy!\nYou gained ** ${xpGain.toLocaleString()} XP** towards your rank!`;
 } else {
 const coinGain = Math.floor(Math.random() * 401) + 200;
 await db.updateCoins(guild.id, user.id, coinGain);
 prizeTitle = `${EMOJIS.coin} Coin Cache!`;
 prizeDesc = `The chest opened to reveal spare coins!\nYou pocketed **${EMOJIS.coin} ${coinGain.toLocaleString()} coins** in your wallet.`;
 }

 return {
 container: new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Lootbox: ${prizeTitle}\n${prizeDesc}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 };
 }

 if (normalizedName === 'xp potion') {
  await db.addXp(guild.id, user.id, 300);
  return {
   container: new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## XP Surge!\nYou drank the ${getEmoji('xp potion')} **XP Potion** in one gulp!\nYou gained ** 300 XP** instantly towards your rank.`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
  };
 }

 if (normalizedName === 'coin bomb') {
  const coinGain = Math.floor(Math.random() * 3201) + 800;
  await db.updateCoins(guild.id, user.id, coinGain);
  return {
   container: new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## ${EMOJIS.coin} BOOM! Coin Bomb!\nThe ${getEmoji('coin bomb')} **Coin Bomb** detonated and showered you in cash!\nYou collected **${EMOJIS.coin} ${coinGain.toLocaleString()} coins** in your wallet.`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
  };
 }

 if (normalizedName === 'work gloves') {
  const coinGain = 500;
  await db.updateCoins(guild.id, user.id, coinGain);
  return {
   container: new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## Work Gloves Equipped!\nYou slipped on the ${getEmoji('work gloves')} **Work Gloves** and got straight to work!\nYou earned **${EMOJIS.coin} 500 coins** as a bonus payout.`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
  };
 }

 if (normalizedName === 'mystery crate') {
  const roll = Math.random();
  let prizeTitle, prizeDesc;

  if (roll < 0.05) {
   await db.addItemToInventory(guild.id, user.id, 'Legendary Gem');
   prizeTitle = ' LEGENDARY DROP!';
   prizeDesc = `The crate burst open with radiant light!\n${getEmoji('Legendary Gem')} **Legendary Gem** added to your \`/inventory\` — worth a fortune on the \`/market\`!`;
  } else if (roll < 0.15) {
   await db.updateCoins(guild.id, user.id, 5000);
   prizeTitle = ' MEGA JACKPOT!';
   prizeDesc = `A torrent of coins erupted from the **Mystery Crate**!\nYou pocketed **${EMOJIS.coin} 5,000 coins** directly!`;
  } else if (roll < 0.35) {
   await db.addItemToInventory(guild.id, user.id, 'Rare Gem');
   prizeTitle = ' Rare Gem!';
   prizeDesc = `A precious gem tumbled out of the crate!\n${getEmoji('Rare Gem')} **Rare Gem** added to your \`/inventory\`!`;
  } else if (roll < 0.60) {
   const xpGain = Math.floor(Math.random() * 401) + 200;
   await db.addXp(guild.id, user.id, xpGain);
   prizeTitle = ' XP Surge!';
   prizeDesc = `The crate crackled with energy!\nYou gained ** ${xpGain.toLocaleString()} XP** towards your rank!`;
  } else {
   const coinGain = Math.floor(Math.random() * 1501) + 500;
   await db.updateCoins(guild.id, user.id, coinGain);
   prizeTitle = `${EMOJIS.coin} Coin Cache!`;
   prizeDesc = `Coins spilled out everywhere!\nYou grabbed **${EMOJIS.coin} ${coinGain.toLocaleString()} coins** from the crate!`;
  }

  return {
   container: new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(`## Mystery Crate: ${prizeTitle}\n${prizeDesc}`)
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
  };
 }

 const customConsumable = shopItems.find(i => i.name.toLowerCase() === normalizedName);
 if (customConsumable?.actionType) {
 const actionType = customConsumable.actionType.toUpperCase();
 const actionValue = Number(customConsumable.actionValue || 0);

 if (actionType === 'XP') {
 await db.addXp(guild.id, user.id, actionValue);
 return {
 container: new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Used ${customConsumable.name}!\nYou consumed **${customConsumable.name}**!\nYou gained ** ${actionValue.toLocaleString()} XP** towards your rank.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 };
 } else if (actionType === 'COINS') {
 await db.updateCoins(guild.id, user.id, actionValue);
 return {
 container: new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${EMOJIS.coin} Used ${customConsumable.name}!\nYou consumed **${customConsumable.name}**!\nYou received **${EMOJIS.coin} ${actionValue.toLocaleString()} coins** in your wallet.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 };
 } else {
 return { error: `**${matchedItem}** has an unrecognized effect type and cannot be used.`, refund: true };
 }
 }

 return { error: `**${matchedItem}** is not a consumable item. List it on the \`/market\` or keep it as a collectible.`, refund: true };
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('use')
 .setDescription('Activates a consumable item from your inventory.')
 .addStringOption(option =>
 option.setName('item')
 .setDescription('The exact name of the item to use (leave blank for interactive picker)')
 .setRequired(false)),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const itemNameInput = interaction.options.getString('item')?.trim();

 try {
 const inventory = await db.getInventory(guild.id, user.id);
 const shopItems = await db.getShopItems(guild.id);

 const customConsumableNames = shopItems
 .filter(i => i.actionType)
 .map(i => i.name.toLowerCase());

 const usableItems = [...new Set(inventory.filter(name =>
 BUILT_IN_CONSUMABLES.has(name.toLowerCase()) || customConsumableNames.includes(name.toLowerCase())
 ))];

 if (itemNameInput) {
 const matchedItem = inventory.find(i => i.toLowerCase() === itemNameInput.toLowerCase());
 if (!matchedItem) {
 return interaction.editReply({
 content: `You do not have **${itemNameInput}** in your inventory. Use \`/inventory\` to check your items.`,
 ephemeral: true
 });
 }

 const removed = await db.removeItemFromInventory(guild.id, user.id, matchedItem);
 if (!removed) {
 return interaction.editReply({ content: `Failed to activate **${matchedItem}**. Try again.`, ephemeral: true });
 }

 const result = await processItem(guild, user, matchedItem, shopItems);
 if (result.error) {
 if (result.refund) await db.addItemToInventory(guild.id, user.id, matchedItem);
 return interaction.editReply({ content: result.error, ephemeral: true });
 }

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [result.container] });
 }

 if (usableItems.length === 0) {
 return interaction.editReply({
 content: 'You have no consumable items in your inventory. Visit `/shop view` to buy consumables like Pizza, Energy Drink, or Lootboxes.',
 ephemeral: true
 });
 }

 const itemCounts = {};
 inventory.forEach(name => { itemCounts[name] = (itemCounts[name] || 0) + 1; });

 const selectOptions = usableItems.slice(0, 25).map(name => ({
 label: `${name}${itemCounts[name] > 1 ? ` ×${itemCounts[name]}` : ''}`,
 description: BUILT_IN_CONSUMABLES.has(name.toLowerCase())
 ? 'Built-in consumable'
 : (shopItems.find(i => i.name.toLowerCase() === name.toLowerCase())?.description || 'Custom consumable'),
 value: name,
 emoji: getEmojiId(name)
 }));

 const select = new StringSelectMenuBuilder()
 .setCustomId('use_item_select')
 .setPlaceholder('Choose a consumable to use...')
 .addOptions(selectOptions);

 const promptContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Use a Consumable Item\nYou have **${usableItems.length}** consumable item(s) available.\nSelect one from the menu below to activate it.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(new ActionRowBuilder().addComponents(select));

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [promptContainer] });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 30000,
 max: 1
 });

 collector.on('collect', async i => {
 await i.deferUpdate();
 const chosenItem = i.values[0];
 const matchedItem = inventory.find(n => n === chosenItem);

 if (!matchedItem) {
 return i.followUp({ content: `Could not find **${chosenItem}** in your inventory.`, ephemeral: true });
 }

 const removed = await db.removeItemFromInventory(guild.id, user.id, matchedItem);
 if (!removed) {
 return i.followUp({ content: `Failed to activate **${matchedItem}**. Try again.`, ephemeral: true });
 }

 const result = await processItem(guild, user, matchedItem, shopItems);
 if (result.error) {
 if (result.refund) await db.addItemToInventory(guild.id, user.id, matchedItem);
 return i.followUp({ content: result.error, ephemeral: true });
 }

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [result.container] });
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 const disabledSelect = new StringSelectMenuBuilder()
 .setCustomId('use_item_select')
 .setPlaceholder('Session expired')
 .setDisabled(true)
 .addOptions({ label: 'Expired', value: 'expired' });

 const expiredContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Use a Consumable Item\nSession expired. Run the command again to use an item.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(new ActionRowBuilder().addComponents(disabledSelect));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
 }
 });

 } catch (err) {
 console.error('[USE ERROR]', err);
 const errMsg = { content: 'Failed to activate the consumable item.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
