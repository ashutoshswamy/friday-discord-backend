const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('autorole')
 .setDescription('Configure a role automatically assigned to members upon joining.')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addStringOption(option => 
 option.setName('action')
 .setDescription('Action to perform')
 .setRequired(true)
 .addChoices(
 { name: 'Set AutoRole', value: 'add' },
 { name: 'Disable AutoRole', value: 'remove' }
 ))
 .addRoleOption(option => 
 option.setName('role')
 .setDescription('The role to assign automatically (required if setting)')
 .setRequired(false)),

 /**
 * Executes the autorole command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
 async execute(interaction) {
 const action = interaction.options.getString('action');
 const role = interaction.options.getRole('role');
 const { guild } = interaction;

 if (!guild) return;

 try {
 if (action === 'add') {
  if (!role) {
  const container = new ContainerBuilder()
    .setAccentColor(0xEF4444)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('You must specify a `role` to allocate automatically!')
    );
  return interaction.editReply({ 
    flags: MessageFlags.IsComponentsV2, 
    components: [container] 
  });
  }

 // Update autoRoleId inside guild configs table in Supabase
 await db.updateGuildConfig(guild.id, { autoRoleId: role.id });

  const container = new ContainerBuilder()
    .setAccentColor(0x10B981)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Successfully set **${role.name}** as the server AutoRole! All joining members will automatically receive this role.`)
    );
  return interaction.editReply({ 
    flags: MessageFlags.IsComponentsV2, 
    components: [container] 
  });
 }

 if (action === 'remove') {
 // Disable AutoRole by updating autoRoleId to null in Supabase
 await db.updateGuildConfig(guild.id, { autoRoleId: null });

  const container = new ContainerBuilder()
    .setAccentColor(0x10B981)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Successfully disabled the server join AutoRole system.')
    );
  return interaction.editReply({ 
    flags: MessageFlags.IsComponentsV2, 
    components: [container] 
  });
 }

 } catch (err) {
  console.error('[AUTOROLE CONFIG ERROR] Failed to save configs:', err);
  const errContainer = new ContainerBuilder()
    .setAccentColor(0xEF4444)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Failed to save AutoRole onboarding settings. Check database connection.')
    );
  const errMsg = { 
    flags: MessageFlags.IsComponentsV2, 
    components: [errContainer], 
    ephemeral: true 
  };
  if (interaction.replied || interaction.deferred) {
  return interaction.followUp(errMsg).catch(() => {});
  } else {
  return interaction.editReply(errMsg).catch(() => {});
  }
 }
 }
};
