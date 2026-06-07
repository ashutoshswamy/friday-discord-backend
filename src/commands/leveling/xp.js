const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('xp')
 .setDescription('Modify a server member\'s experience points (XP) manually.')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addStringOption(option =>
 option.setName('action')
 .setDescription('Action to perform')
 .setRequired(true)
 .addChoices(
 { name: 'Add XP', value: 'ADD' },
 { name: 'Remove XP', value: 'REMOVE' },
 { name: 'Set XP', value: 'SET' }
 ))
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to adjust XP for')
 .setRequired(true))
 .addIntegerOption(option =>
 option.setName('amount')
 .setDescription('The amount of XP')
 .setMinValue(1)
 .setRequired(true)),

 async execute(interaction) {
 const action = interaction.options.getString('action');
 const targetUser = interaction.options.getUser('user');
 const amount = interaction.options.getInteger('amount');
 const { guild } = interaction;

 if (!guild) return;

 if (targetUser.bot) {
 return interaction.editReply({ content: 'Bots do not support leveling operations.', ephemeral: true });
 }

 try {
 const result = await db.updateXpAdmin(guild.id, targetUser.id, action, amount);

 const actionTexts = {
 ADD: `Added **${amount.toLocaleString()} XP** to`,
 REMOVE: `Deducted **${amount.toLocaleString()} XP** from`,
 SET: `Overwrote XP balance to **${amount.toLocaleString()} XP** for`
 };

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## XP Balance Modified\n${actionTexts[action]} <@${targetUser.id}>.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Resulting Level:**Level ${result.level}\n` +
 `**Resulting XP:** \`${result.xp.toLocaleString()}\`XP`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[ERROR] Admin XP modification failed:', err);
 const _errMsg = { content: "Failed to update the user's XP.", ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
