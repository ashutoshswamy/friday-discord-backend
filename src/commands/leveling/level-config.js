const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('level-config')
 .setDescription('Configure leveling multiplier parameters for the server.')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addNumberOption(option =>
 option.setName('multiplier')
 .setDescription('The XP generation multiplier (e.g., 2.0 for Double XP)')
 .setMinValue(0.1)
 .setMaxValue(10.0)
 .setRequired(true)),

 async execute(interaction) {
 const multiplier = interaction.options.getNumber('multiplier');
 const { guild } = interaction;

 if (!guild) return;

 try {
 await db.updateGuildConfig(guild.id, { xpMultiplier: multiplier });

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Leveling Config Updated\nSuccessfully updated server-wide XP generation to **${multiplier}x** speed.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 multiplier > 1
 ? `-# XP events now reward ${multiplier}× the base rate — leveling is faster than default.`
 : multiplier < 1
 ? `-# XP events now reward ${multiplier}× the base rate — leveling is slower than default.`
 : `-# XP events now reward the default base rate (1× multiplier).`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (err) {
 console.error('[ERROR] Level config command failed:', err);
 const _errMsg = { content: 'Failed to save leveling multiplier settings in the database.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
