const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('pay')
 .setDescription('Securely transfers server coins from your wallet to another server member.')
 .addUserOption(option =>
 option.setName('user').setDescription('The user to pay').setRequired(true))
 .addIntegerOption(option =>
 option.setName('amount').setDescription('The amount of coins to transfer').setMinValue(1).setRequired(true)),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user');
 const amount = interaction.options.getInteger('amount');
 const { guild, user } = interaction;
 if (!guild) return;

 if (targetUser.id === user.id) return interaction.editReply({ content: 'You cannot transfer coins to yourself!', ephemeral: true });
 if (targetUser.bot) return interaction.editReply({ content: 'Bot accounts do not participate in currency systems.', ephemeral: true });

 try {
 const transfer = await db.transferCoins(guild.id, user.id, targetUser.id, amount);

 if (!transfer.success) {
 return interaction.editReply({ content: `Transaction declined: ${transfer.reason || 'Insufficient funds.'}`, ephemeral: true });
 }

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Secure Coin Transfer\nSuccessfully sent **${amount.toLocaleString()}** coins to ${targetUser}!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Sender:** ${user}\n` +
 `**Recipient:** ${targetUser}\n` +
 `**Amount:** ${EMOJIS.coin} **${amount.toLocaleString()}**`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[ERROR] Pay command failed:', err);
 const errMsg = { content: 'Failed to process the coin transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
