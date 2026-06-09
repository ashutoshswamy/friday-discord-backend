const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder,
 ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('roleinfo')
 .setDescription('Displays detailed information and metadata about a server role.')
 .addRoleOption(opt =>
 opt.setName('role')
 .setDescription('The role you want to inspect')
 .setRequired(true)),

 async execute(interaction) {
 const { guild, options } = interaction;
 if (!guild) return;

 const role = options.getRole('role');

 try {
 const targetRole = guild.roles.cache.get(role.id);
 if (!targetRole) {
 return interaction.editReply({ content: 'Failed to find the specified role in this server.', ephemeral: true });
 }

 const membersCount = targetRole.members.size;
 const createdUnix = Math.floor(targetRole.createdTimestamp / 1000);

 const keyPermissions = [];
 if (targetRole.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
 if (targetRole.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
 if (targetRole.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
 if (targetRole.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
 if (targetRole.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
 if (targetRole.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
 if (targetRole.permissions.has(PermissionFlagsBits.MentionEveryone)) keyPermissions.push('Mention Everyone');

 const permissionsDisplay = keyPermissions.length > 0
 ? keyPermissions.map(p => `\`${p}\``).join(', ')
 : '`None (Standard Member Permissions)`';

 const roleColor = targetRole.hexColor === '#000000' ? '#71717a' : targetRole.hexColor;
 const accentInt = parseInt(roleColor.replace('#', ''), 16);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Role Profile: ${targetRole.name}`)
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png')
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Role:** ${targetRole}\n` +
 `**ID:** \`${targetRole.id}\`\n` +
 `**Color:** \`${targetRole.hexColor}\`\n` +
 `**Position:** ${targetRole.position} / ${guild.roles.cache.size}\n` +
 `**Members:** **${membersCount.toLocaleString()}**\n` +
 `**Hoisted:** ${targetRole.hoist ? ' Yes' : ' No'}\n` +
 `**Mentionable:** ${targetRole.mentionable ? ' Yes' : ' No'}\n` +
 `**Created:** <t:${createdUnix}:F> (<t:${createdUnix}:R>)`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Key Permissions:** ${permissionsDisplay}`)
 );

 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });
 } catch (err) {
 console.error('[ROLEINFO ERROR]', err);
 const errMsg = { content: 'Failed to fetch role information.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
