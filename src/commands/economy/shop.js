const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS, EMOJI_IDS, getEmoji, getEmojiId } = require('../../utils/emojis');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('shop')
 .setDescription('Manage, view, or purchase items from the server virtual shop.')
 .addSubcommand(sub =>
 sub.setName('view')
 .setDescription('View the catalog of items available for purchase.'))
 .addSubcommand(sub =>
 sub.setName('buy')
 .setDescription('Purchase an item from the server shop.')
 .addStringOption(opt =>
 opt.setName('item')
 .setDescription('The exact name of the item to purchase')
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('add')
 .setDescription('Add a new item to the server shop (Administrator only).')
 .addStringOption(opt =>
 opt.setName('name')
 .setDescription('The name of the custom item (e.g. Premium Role)')
 .setRequired(true))
 .addIntegerOption(opt =>
 opt.setName('cost')
 .setDescription('The item cost in server coins')
 .setMinValue(1)
 .setRequired(true))
 .addStringOption(opt =>
 opt.setName('description')
 .setDescription('Item description or flavor text')
 .setRequired(false))
 .addRoleOption(opt =>
 opt.setName('role')
 .setDescription('A role automatically rewarded to the user upon purchase')
 .setRequired(false))
 .addStringOption(opt =>
 opt.setName('action_type')
 .setDescription('The consumable effect type when used via /use')
 .setRequired(false)
 .addChoices(
 { name: ' Grant XP Boost', value: 'XP' },
 { name: `${EMOJIS.coin} Grant Wallet Coins Cache`, value: 'COINS' }
 ))
 .addIntegerOption(opt =>
 opt.setName('action_value')
 .setDescription('The amount of XP or coins to grant')
 .setMinValue(1)
 .setRequired(false)))
 .addSubcommand(sub =>
 sub.setName('remove')
 .setDescription('Remove an item from the server shop (Administrator only).')
 .addStringOption(opt =>
 opt.setName('name')
 .setDescription('The exact name of the item to delete')
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('catalog')
 .setDescription('View all built-in items available for admins to add to the server shop.')),

 async execute(interaction) {
 const { guild, options, member, user } = interaction;
 if (!guild || !member) return;

 const subcommand = options.getSubcommand();

 try {
  if (subcommand === 'buy') {
   const itemName = options.getString('item');
   const result = await db.purchaseItem(guild.id, user.id, itemName);

   if (!result.success) {
    return interaction.editReply({ content: `Purchase declined: ${result.reason || 'Transaction declined.'}`, ephemeral: true });
   }

   let roleGranted = false;
   let roleText = '';

   if (result.roleRewardId) {
    const rewardRole = guild.roles.cache.get(result.roleRewardId);
    if (rewardRole) {
     roleText = rewardRole.name;
     await member.roles.add(rewardRole, `Purchased shop item: ${itemName}`)
      .then(() => { roleGranted = true; })
      .catch(err => console.error(`[ERROR] Failed to grant role reward:`, err));
    }
   }

   let detailText = `**Cost Paid:** ${EMOJIS.coin} **${result.cost.toLocaleString()}** coins\n**Item Added:** **${itemName}** → your inventory`;

   if (result.roleRewardId) {
    detailText += `\n**Role Reward:** ${roleGranted ? `**${roleText}** granted!` : `Failed to award **${roleText}** (bot role too low)`}`;
   }

   const container = new ContainerBuilder()
    .setAccentColor(0x00FF66)
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## Purchase Confirmed\nSuccessfully purchased **${itemName}**!`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

   return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  }

  if (subcommand === 'view') {
 const items = await db.getShopItems(guild.id);

 if (items.length === 0) {
 const emptyContainer = new ContainerBuilder()
 .setAccentColor(0xFF8C00)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Server Shop — ${guild.name}\n The server shop is currently empty.\nAdministrators can add listings using \`/shop add\`.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
 );
 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [emptyContainer] });
 }

  const itemsText = items.map(item => {
  const roleText = item.roleRewardId ? `\n Grants: <@&${item.roleRewardId}>` : '';
  return `**${getEmoji(item.name)} ${item.name}** — ${EMOJIS.coin} **${item.cost.toLocaleString()}** coins\n *${item.description}*${roleText}`;
  }).join('\n\n');

  const buyOptions = items.slice(0, 25).map(item => ({
  label: item.name,
  description: `${item.cost.toLocaleString()} coins${item.roleRewardId ? ' · Grants a role' : ''}`,
  value: `buy_${item.name}`,
  emoji: getEmojiId(item.name) || EMOJI_IDS.coin
  }));

 const buySelect = new StringSelectMenuBuilder()
 .setCustomId('shop_buy_select')
 .setPlaceholder('Select an item to purchase...')
 .addOptions(buyOptions);

 const container = new ContainerBuilder()
 .setAccentColor(0xFF8C00)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Server Shop — ${guild.name}\nExchange server coins for exclusive items and role rewards!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(itemsText))
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(new ActionRowBuilder().addComponents(buySelect));

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 120000
 });

 collector.on('collect', async i => {
 const itemName = i.values[0].replace('buy_', '');
 await i.deferUpdate();

 const result = await db.purchaseItem(guild.id, user.id, itemName).catch(() => null);

 if (!result || !result.success) {
 return i.followUp({
 content: `Purchase failed: ${result?.reason || 'Insufficient coins or item not found.'}`,
 ephemeral: true
 });
 }

 let roleGranted = false;
 let roleText = '';
 if (result.roleRewardId) {
 const rewardRole = guild.roles.cache.get(result.roleRewardId);
 if (rewardRole) {
 roleText = rewardRole.name;
 await member.roles.add(rewardRole, `Purchased: ${itemName}`).then(() => { roleGranted = true; }).catch(() => null);
 }
 }

 let detailText = `**Item Purchased:** **${itemName}** → your inventory\n**Cost Paid:** ${EMOJIS.coin} **${result.cost.toLocaleString()}** coins`;

 if (result.roleRewardId) {
 detailText += `\n**Role Reward:** ${roleGranted ? `**${roleText}** granted!` : `Could not grant **${roleText}** (check bot role position).`}`;
 }

 const confirmContainer = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Purchase Confirmed\n**${itemName}** has been added to your inventory!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

 await i.followUp({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer], ephemeral: true });
 });

 collector.on('end', async () => {
 const disabledSelect = new StringSelectMenuBuilder()
 .setCustomId('shop_buy_select')
 .setPlaceholder('Shop session expired')
 .setDisabled(true)
 .addOptions({ label: 'Expired', value: 'expired' });

 const expiredContainer = new ContainerBuilder()
 .setAccentColor(0xFF8C00)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Server Shop — ${guild.name}\nExchange server coins for exclusive items and role rewards!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(itemsText))
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(new ActionRowBuilder().addComponents(disabledSelect));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
 });

 return;
 }

 if (subcommand === 'catalog') {
  const toolsText =
   `**Tools** *(required for grind commands)*\n` +
   `• ${getEmoji('hunting rifle')} **Hunting Rifle** — required for \`/hunt\` · Suggested price: ${EMOJIS.coin} 500\n` +
   `• ${getEmoji('fishing pole')} **Fishing Pole** — required for \`/fish\` · Suggested price: ${EMOJIS.coin} 400\n` +
   `• ${getEmoji('shovel')} **Shovel** — required for \`/dig\` · Suggested price: ${EMOJIS.coin} 300`;

  const consumablesText =
   `**Consumables** *(used via \`/use\`)*\n` +
   `• ${getEmoji('pizza')} **Pizza** — grants 150 XP instantly · Suggested: ${EMOJIS.coin} 800\n` +
   `• ${getEmoji('xp potion')} **XP Potion** — grants 300 XP instantly · Suggested: ${EMOJIS.coin} 1,500\n` +
   `• ${getEmoji('energy drink')} **Energy Drink** — grants 300 coins to wallet · Suggested: ${EMOJIS.coin} 500\n` +
   `• ${getEmoji('work gloves')} **Work Gloves** — grants 500 coins to wallet · Suggested: ${EMOJIS.coin} 800\n` +
   `• ${getEmoji('coin bomb')} **Coin Bomb** — explodes for 800–4,000 random coins · Suggested: ${EMOJIS.coin} 2,000\n` +
   `• ${getEmoji('lootbox')} **Lootbox** — random prize (coins, XP, Silver Ring) · Suggested: ${EMOJIS.coin} 1,200\n` +
   `• ${getEmoji('mystery crate')} **Mystery Crate** — upgraded lootbox with gem drops · Suggested: ${EMOJIS.coin} 3,500`;

  const collectiblesText =
   `**Collectibles** *(sell via \`/sell\` or trade on \`/market\`)*\n` +
   `• ${getEmoji('common gem')} **Common Gem** — sell value ${EMOJIS.coin} 750\n` +
   `• ${getEmoji('rare gem')} **Rare Gem** — sell value ${EMOJIS.coin} 3,500 · drops from Mystery Crate\n` +
   `• ${getEmoji('legendary gem')} **Legendary Gem** — sell value ${EMOJIS.coin} 12,000 · rare Mystery Crate drop\n` +
   `• ${getEmoji('silver ring')} **Silver Ring** — sell value ${EMOJIS.coin} 1,000 · Lootbox rare drop`;

 const grindDropsText =
  `**Grind Drops** *(auto-dropped, sell via \`/sell\` or trade via \`/market\`)*\n` +
  `Hunt: Rabbit · Eagle Feather · Duck · Deer · Deer Antler · Wild Boar · Wolf Pelt · Grizzly Bear · Dragon Scale\n` +
  `Fish: Clam · Common Bass · Pufferfish · Salmon · Goldfish · Lobster · Tropical Coral Fish · Shark Tooth · Ancient Pearl · Mythical Whale\n` +
  `Dig: Common Worm · Old Coin · Cracked Geode · Dirt Fossil · Ancient Vase · Sapphire · Ruby · Diamond · Buried Gold Chest`;

 const container = new ContainerBuilder()
  .setAccentColor(0xFF8C00)
  .addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `## Built-in Item Catalog\nAll standard items admins can add via \`/shop add\`. Items with effects work automatically with \`/use\`.`
     )
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
  )
  .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(toolsText))
  .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(consumablesText))
  .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(collectiblesText))
  .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(grindDropsText))
  .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    `-# Admins: use \`/shop add [name] [cost]\` to list any item above · Players trade on \`/market\``
   )
  );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
 return interaction.editReply({
 content: 'Administrator permission required to modify the shop catalog.',
 ephemeral: true
 });
 }

 if (subcommand === 'add') {
 const name = options.getString('name');
 const cost = options.getInteger('cost');
 const description = options.getString('description') || 'No description provided.';
 const role = options.getRole('role');
 const actionType = options.getString('action_type');
 const actionValue = options.getInteger('action_value');

 if (actionType && !actionValue) {
 return interaction.editReply({
 content: 'You must provide an ** action_value** when configuring an ** action_type**.',
 ephemeral: true
 });
 }

 const result = await db.addShopItem(guild.id, name, cost, description, role ? role.id : null, actionType, actionValue);

 if (!result.success) {
 if (result.reason === 'migration_needed') {
 const migrationContainer = new ContainerBuilder()
 .setAccentColor(0xFFCC00)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Database Migration Required\nConsumable effects require the latest schema.\n\n**Run in Supabase SQL Editor:**\n\`\`\`sql\nALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_type TEXT;\nALTER TABLE shop_items ADD COLUMN IF NOT EXISTS action_value INT;\n\`\`\``
 )
 );
 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [migrationContainer] });
 }
 return interaction.editReply({
 content: `Failed to add item. A listing named \`${name}\` may already exist.`,
 ephemeral: true
 });
 }

 let detailText =
 `**Name:** **${name}**\n` +
 `**Price:** ${EMOJIS.coin} **${cost.toLocaleString()}** coins\n` +
 `**Description:** ${description}`;

 if (actionType) detailText += `\n**Effect:**Consumable — **${actionType}** grants **${actionValue.toLocaleString()}** on use`;
 if (role) detailText += `\n**Role Reward:** <@&${role.id}>`;

 const container = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Shop Item Added\n**${name}** is now listed in the shop.`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'remove') {
 const name = options.getString('name');

 const confirmBtn = new ButtonBuilder()
 .setCustomId('shop_remove_confirm')
 .setLabel(`Remove "${name}"`)
 .setStyle(ButtonStyle.Danger);

 const cancelBtn = new ButtonBuilder()
 .setCustomId('shop_remove_cancel')
 .setLabel('Cancel')
 .setStyle(ButtonStyle.Secondary);

 const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

 const confirmContainer = new ContainerBuilder()
 .setAccentColor(0xFF4500)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Confirm Shop Item Removal\nRemove **${name}** from the shop? This cannot be undone.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(row);

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 30000,
 max: 1
 });

 collector.on('collect', async i => {
 if (i.customId === 'shop_remove_cancel') {
 return i.update({ content: 'Removal cancelled.', flags: MessageFlags.IsComponentsV2, components: [] });
 }

 const result = await db.removeShopItem(guild.id, name);
 if (!result.success) {
 return i.update({
 content: `${result.reason || `Could not find \`${name}\` in the shop.`}`,
 flags: MessageFlags.IsComponentsV2,
 components: []
 });
 }

 const removedContainer = new ContainerBuilder()
 .setAccentColor(0xFF4500)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Item Removed\n**${name}** has been removed from the server shop.`
 )
 );

 await i.update({ flags: MessageFlags.IsComponentsV2, components: [removedContainer] });
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 await interaction.editReply({ content: 'Confirmation timed out.', flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);
 }
 });
 }

 } catch (err) {
 console.error('[ERROR] Shop command failed:', err);
 const errMsg = { content: 'Failed to process shop operations.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => null);
 } else {
 await interaction.editReply(errMsg).catch(() => null);
 }
 }
 }
};
