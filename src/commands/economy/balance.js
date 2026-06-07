const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

async function buildBalanceContainer(guild, targetUser) {
 const profile = await db.getProfile(guild.id, targetUser.id);
 if (!profile) return null;

 const stocksData = await db.getUserStocksTotalValue(guild.id, targetUser.id).catch(() => ({ totalValue: 0 }));
 const intradayData = await db.getUserIntradayTotalValue(guild.id, targetUser.id).catch(() => ({ totalValue: 0 }));
 const totalStockAssets = Math.round((stocksData.totalValue || 0) + (intradayData.totalValue || 0));
 const netWorth = profile.coins + (profile.bank || 0) + totalStockAssets;

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Finance Balance: ${targetUser.username}\nFinancial breakdown in **${guild.name}**`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Active Wallet:** <:coin:1512926963239489606> **${profile.coins.toLocaleString()}** coins\n` +
 `**Bank Vault:** <:coin:1512926963239489606> **${(profile.bank || 0).toLocaleString()}** coins\n` +
 `**Stock Portfolio:** <:coin:1512926963239489606> **${totalStockAssets.toLocaleString()}** coins\n` +
 `**Net Worth:** <:coin:1512926963239489606> **${netWorth.toLocaleString()}** coins`
 )
 );

 return { container, profile };
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('balance')
 .setDescription("Checks a member's wallet balance of server coins.")
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to check balance for (defaults to yourself)')
 .setRequired(false)),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user') || interaction.user;
 const { guild, user } = interaction;
 if (!guild) return;

 if (targetUser.bot) {
 return interaction.editReply({ content: 'Bots do not hold virtual currencies.', ephemeral: true });
 }

 try {
 const result = await buildBalanceContainer(guild, targetUser);
 if (!result) {
 return interaction.editReply({ content: 'Failed to retrieve balance records.', ephemeral: true });
 }

 const { container, profile } = result;
 const isSelf = targetUser.id === user.id;

 if (isSelf) {
 const depositBtn = new ButtonBuilder()
 .setCustomId('bal_deposit_all').setLabel('Deposit All').setStyle(ButtonStyle.Success)
 .setDisabled(profile.coins <= 0);
 const withdrawBtn = new ButtonBuilder()
 .setCustomId('bal_withdraw_all').setLabel('Withdraw All').setStyle(ButtonStyle.Primary)
 .setDisabled((profile.bank || 0) <= 0);
 const shopBtn = new ButtonBuilder()
 .setCustomId('bal_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary);

 container.addActionRowComponents(new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, shopBtn));
 }

 const response = await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });

 if (!isSelf) return;

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 60000
 });

 collector.on('collect', async i => {
 if (i.customId === 'bal_deposit_all') {
 const currentProfile = await db.getProfile(guild.id, user.id);
 if (currentProfile.coins <= 0) return i.reply({ content: 'Your wallet is empty!', ephemeral: true });
 await db.depositCoins(guild.id, user.id, currentProfile.coins);
 const updated = await buildBalanceContainer(guild, targetUser);
 const depositBtn = new ButtonBuilder().setCustomId('bal_deposit_all').setLabel('Deposit All').setStyle(ButtonStyle.Success).setDisabled(updated.profile.coins <= 0);
 const withdrawBtn = new ButtonBuilder().setCustomId('bal_withdraw_all').setLabel('Withdraw All').setStyle(ButtonStyle.Primary).setDisabled((updated.profile.bank || 0) <= 0);
 const shopBtn = new ButtonBuilder().setCustomId('bal_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary);
 updated.container.addActionRowComponents(new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, shopBtn));
 await i.update({ flags: MessageFlags.IsComponentsV2, components: [updated.container] });
 } else if (i.customId === 'bal_withdraw_all') {
 const currentProfile = await db.getProfile(guild.id, user.id);
 if ((currentProfile.bank || 0) <= 0) return i.reply({ content: 'Your vault is empty!', ephemeral: true });
 await db.withdrawCoins(guild.id, user.id, currentProfile.bank);
 const updated = await buildBalanceContainer(guild, targetUser);
 const depositBtn = new ButtonBuilder().setCustomId('bal_deposit_all').setLabel('Deposit All').setStyle(ButtonStyle.Success).setDisabled(updated.profile.coins <= 0);
 const withdrawBtn = new ButtonBuilder().setCustomId('bal_withdraw_all').setLabel('Withdraw All').setStyle(ButtonStyle.Primary).setDisabled((updated.profile.bank || 0) <= 0);
 const shopBtn = new ButtonBuilder().setCustomId('bal_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary);
 updated.container.addActionRowComponents(new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, shopBtn));
 await i.update({ flags: MessageFlags.IsComponentsV2, components: [updated.container] });
 } else if (i.customId === 'bal_view_shop') {
 await i.reply({ content: 'Use `/shop view` to browse the server shop!', ephemeral: true });
 }
 });

 collector.on('end', async () => {
 const disabledRow = new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId('bal_deposit_all').setLabel('Deposit All').setStyle(ButtonStyle.Success).setDisabled(true),
 new ButtonBuilder().setCustomId('bal_withdraw_all').setLabel('Withdraw All').setStyle(ButtonStyle.Primary).setDisabled(true),
 new ButtonBuilder().setCustomId('bal_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setDisabled(true)
 );
 const final = await buildBalanceContainer(guild, targetUser);
 if (final) {
 final.container.addActionRowComponents(disabledRow);
 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final.container] }).catch(() => null);
 }
 });

 } catch (err) {
 console.error('[ERROR] Balance command failed:', err);
 const errMsg = { content: 'Failed to retrieve balance records from database.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
