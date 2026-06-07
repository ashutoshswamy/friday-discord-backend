const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('level-rewards')
 .setDescription('Configure role rewards automatically given to users at specific levels.')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addStringOption(option =>
 option.setName('action')
 .setDescription('Action to perform')
 .setRequired(true)
 .addChoices(
 { name: 'Add/Update Reward', value: 'add' },
 { name: 'Remove Reward', value: 'remove' },
 { name: 'List Active Rewards', value: 'list' }
 ))
 .addIntegerOption(option =>
 option.setName('level')
 .setDescription('The level boundary (minimum level 2)')
 .setMinValue(2)
 .setRequired(false))
 .addRoleOption(option =>
 option.setName('role')
 .setDescription('The role to award')
 .setRequired(false)),

 async execute(interaction) {
 const action = interaction.options.getString('action');
 const level = interaction.options.getInteger('level');
 const role = interaction.options.getRole('role');
 const { guild } = interaction;

 if (!guild) return;

 try {
 if (action !== 'list' && !level) {
 return interaction.editReply({
 content: 'You must specify a targeted milestone `level` to apply this action.',
 ephemeral: true
 });
 }

 if (action === 'add') {
 if (!role) {
 return interaction.editReply({
 content: 'You must specify a `role` to award at this level.',
 ephemeral: true
 });
 }

 await db.addLevelReward(guild.id, level, role.id);
 return interaction.editReply({
 content: `Success! Users reaching **Level ${level}** will now be awarded the ${role} role.`
 });
 }

 if (action === 'remove') {
 const deleted = await db.removeLevelReward(guild.id, level);
 return interaction.editReply({
 content: deleted
 ? `Successfully removed the level reward for **Level ${level}**.`
 : `No reward role is currently registered for **Level ${level}**.`,
 ephemeral: !deleted
 });
 }

 if (action === 'list') {
 const rewards = await db.getLevelRewards(guild.id);
 if (rewards.length === 0) {
 return interaction.editReply({ content: 'There are currently no level role rewards configured in this server.' });
 }

 const list = rewards.map(r => `• **Level ${r.level}** → <@&${r.roleId}>`).join('\n');

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Level Role Rewards`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(list))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# ${rewards.length} reward${rewards.length !== 1 ? 's' : ''} configured · Use /level-rewards action:add to add more`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 } catch (err) {
 console.error('[ERROR] Level rewards command failed:', err);
 const _errMsg = { content: 'Failed to modify level role reward settings.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
