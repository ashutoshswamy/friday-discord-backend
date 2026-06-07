const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('deposit')
 .setDescription('Move active wallet coins into your secure bank vault.')
 .addStringOption(option =>
 option.setName('amount')
 .setDescription('The amount of coins to deposit (or "all")')
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
 amount = profile.coins;
 } else {
 amount = parseInt(amountInput);
 if (isNaN(amount) || amount <= 0) {
 return interaction.editReply({ content: 'Please specify a valid positive amount or "all".', ephemeral: true });
 }
 }

 if (amount === 0) return interaction.editReply({ content: 'You do not have any coins in your wallet to deposit!', ephemeral: true });
 if (profile.coins < amount) {
 return interaction.editReply({ content: `Insufficient wallet balance! You only possess ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins.`, ephemeral: true });
 }

 const result = await db.depositCoins(guild.id, user.id, amount);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Bank Vault Deposit\nSuccessfully deposited **${EMOJIS.coin} ${amount.toLocaleString()}** coins into your vault!`
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
 console.error('[DEPOSIT ERROR]', err);
 const errMsg = { content: 'An error occurred during the transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
