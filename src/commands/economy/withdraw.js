const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('withdraw')
 .setDescription('Retrieve coins from your secure bank vault into your wallet.')
 .addStringOption(option =>
 option.setName('amount')
 .setDescription('The amount of coins to withdraw (or "all")')
 .setRequired(true)),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const amountInput = interaction.options.getString('amount').trim().toLowerCase();

 try {
 const profile = await db.getProfile(guild.id, user.id);
 if (!profile) return interaction.editReply({ content: 'Failed to load profile.', ephemeral: true });

 let amount;
 if (amountInput === 'all') {
 amount = profile.bank || 0;
 } else {
 amount = parseInt(amountInput);
 if (isNaN(amount) || amount <= 0) {
 return interaction.editReply({ content: 'Please specify a valid positive amount or "all".', ephemeral: true });
 }
 }

 if (amount === 0) return interaction.editReply({ content: 'You do not have any coins in your bank vault to withdraw!', ephemeral: true });
 if ((profile.bank || 0) < amount) {
 return interaction.editReply({ content: `Insufficient vault balance! You only possess ${EMOJIS.coin} **${(profile.bank || 0).toLocaleString()}** coins in your bank.`, ephemeral: true });
 }

 const result = await db.withdrawCoins(guild.id, user.id, amount);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Bank Vault Withdrawal\nSuccessfully withdrew **${EMOJIS.coin} ${amount.toLocaleString()}** coins from your vault!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**${EMOJIS.coin} Wallet Balance:** ${EMOJIS.coin} **${result.coins.toLocaleString()}** coins\n` +
 `**Vault Balance:** ${EMOJIS.coin} **${result.bank.toLocaleString()}** coins`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[WITHDRAW ERROR]', err);
 const errMsg = { content: 'An error occurred during the transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
