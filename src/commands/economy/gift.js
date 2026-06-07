const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('gift')
 .setDescription('Gift coins or inventory items to another server member securely.')
 .addSubcommand(sub =>
 sub.setName('coins')
 .setDescription('Gift a specified amount of coins to another member.')
 .addUserOption(opt => opt.setName('user').setDescription('The member to receive the coins').setRequired(true))
 .addIntegerOption(opt => opt.setName('amount').setDescription('The amount of coins to transfer').setMinValue(1).setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('item')
 .setDescription('Gift a collectible or grinding item from your inventory to another member.')
 .addUserOption(opt => opt.setName('user').setDescription('The member to receive the item').setRequired(true))
 .addStringOption(opt => opt.setName('name').setDescription('The exact name of the item to transfer').setRequired(true))),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const targetUser = options.getUser('user');
 const subcommand = options.getSubcommand();

 if (targetUser.id === user.id) return interaction.editReply({ content: 'You cannot gift items or coins to yourself!', ephemeral: true });
 if (targetUser.bot) return interaction.editReply({ content: 'You cannot gift resources to bot accounts!', ephemeral: true });

 try {
 let titleText, detailText;

 if (subcommand === 'coins') {
 const amount = options.getInteger('amount');
 const senderProfile = await db.getProfile(guild.id, user.id);

 if (senderProfile.coins < amount) {
 return interaction.editReply({
 content: `Insufficient wallet balance! You only possess <:coin:1512926963239489606> **${senderProfile.coins.toLocaleString()}** coins but tried to gift <:coin:1512926963239489606> **${amount.toLocaleString()}**.`,
 ephemeral: true
 });
 }

 await db.updateCoins(guild.id, user.id, -amount);
 await db.updateCoins(guild.id, targetUser.id, amount);

 titleText = ' Coin Gift Transferred';
 detailText = `**From:** <@${user.id}>\n**To:** <@${targetUser.id}>\n**Amount:** <:coin:1512926963239489606> **${amount.toLocaleString()}** coins`;

 } else if (subcommand === 'item') {
 const itemName = options.getString('name').trim();
 const inventory = await db.getInventory(guild.id, user.id);
 const matchedItem = inventory.find(i => i.toLowerCase() === itemName.toLowerCase());

 if (!matchedItem) {
 return interaction.editReply({ content: `You do not possess any **${itemName}** in your inventory to gift!`, ephemeral: true });
 }

 const success = await db.giftItem(guild.id, user.id, targetUser.id, matchedItem);
 if (!success) {
 return interaction.editReply({ content: 'Failed to complete item transfer. Try again.', ephemeral: true });
 }

 titleText = ' Inventory Item Gifted';
 detailText = `**Sender:** <@${user.id}>\n**Receiver:** <@${targetUser.id}>\n**Item:** **${matchedItem}**`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${titleText}\nThe transaction has been processed securely in the cloud.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[GIFT ERROR]', err);
 const errMsg = { content: 'Failed to complete the secure gift transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
