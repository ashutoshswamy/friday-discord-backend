const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('logs')
 .setDescription('Inspect server activity audit logs.')
 .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
 .addSubcommand(sub =>
 sub.setName('message')
 .setDescription('View recent deleted and edited chat messages logs.')
 .addUserOption(opt => opt.setName('user').setDescription('Filter logs for a specific member').setRequired(false)))
 .addSubcommand(sub =>
 sub.setName('voice')
 .setDescription('View recent voice channel connection activity.')
 .addUserOption(opt => opt.setName('user').setDescription('Filter voice logs for a specific member').setRequired(false))),

 async execute(interaction) {
 const { guild, options, client } = interaction;
 if (!guild) return;

 const subcommand = options.getSubcommand();
 const targetUser = options.getUser('user');

 try {
 if (subcommand === 'message') {
 const logs = client.messageAuditLog || [];
 let filtered = logs.filter(l => l.guildId === guild.id);
 if (targetUser) filtered = filtered.filter(l => l.userId === targetUser.id);

 if (filtered.length === 0) {
 return interaction.editReply({ content: 'No recent chat message edits or deletions logged.' });
 }

 const logsText = filtered.slice(0, 15).map(l => {
 const time = `<t:${Math.floor(l.timestamp / 1000)}:T>`;
 if (l.type === 'DELETE') {
 return `${time} **[DELETE]** <@${l.userId}> in **#${l.channelName}**:\n> *${l.content.substring(0, 100)}*`;
 } else {
 return `${time} **[EDIT]** <@${l.userId}> in **#${l.channelName}**:\n> **Old:** *${l.oldContent.substring(0, 80)}*\n> **New:** *${l.newContent.substring(0, 80)}*`;
 }
 }).join('\n\n');

 const header = targetUser ? `## Chat Activity Logs — ${targetUser.username}` : `## Chat Activity Logs — ${guild.name}`;

 const container = new ContainerBuilder()
 .setAccentColor(0xFF9900)
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(logsText))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Showing up to 15 most recent events`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'voice') {
 const logs = client.voiceAuditLog || [];
 let filtered = logs.filter(l => l.guildId === guild.id);
 if (targetUser) filtered = filtered.filter(l => l.userId === targetUser.id);

 if (filtered.length === 0) {
 return interaction.editReply({ content: 'No recent voice activity logged.' });
 }

 const logsText = filtered.slice(0, 15).map(l => {
 const time = `<t:${Math.floor(l.timestamp / 1000)}:T>`;
 return `${time} <@${l.userId}>: ${l.details}`;
 }).join('\n');

 const header = targetUser ? `## Voice Connection Logs — ${targetUser.username}` : `## Voice Connection Logs — ${guild.name}`;

 const container = new ContainerBuilder()
 .setAccentColor(0x00CCFF)
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(logsText))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Showing up to 15 most recent voice events`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
 } catch (err) {
 console.error('[LOGS COMMAND ERROR]', err);
 const _errMsg = { content: 'Failed to load incident logs.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
