const {
 SlashCommandBuilder, PermissionFlagsBits,
 ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
 .setName('customcmd')
 .setDescription('Create and manage custom chat trigger commands (e.g., !rules).')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
 .addSubcommand(sub =>
 sub.setName('add')
 .setDescription('Create a custom text trigger command.')
 .addStringOption(opt =>
 opt.setName('name').setDescription('The trigger keyword (e.g., rules)').setRequired(true))
 .addStringOption(opt =>
 opt.setName('text').setDescription('The plain-text response when the command is triggered').setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('embed')
 .setDescription('Opens a Modal form to build a rich embed custom trigger command.')
 .addStringOption(opt =>
 opt.setName('name').setDescription('The trigger keyword (e.g., socials)').setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('remove')
 .setDescription('Delete an active custom command trigger.')
 .addStringOption(opt =>
 opt.setName('name').setDescription('The trigger keyword to delete').setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('list')
 .setDescription('List all custom trigger commands configured in this server.')),

 async execute(interaction) {
 const { guild, options } = interaction;
 if (!guild) return;

 const subcommand = options.getSubcommand();

 try {
 if (subcommand === 'add') {
 const name = options.getString('name').toLowerCase().trim();
 const text = options.getString('text');

 if (name.includes(' ')) {
 return interaction.reply({ content: 'Custom trigger keywords cannot contain spaces!', ephemeral: true });
 }

 await db.addCustomCommand(guild.id, name, text, false, null);
 return interaction.reply({ content: `Successfully created trigger command: \`!${name}\`!` });
 }

 if (subcommand === 'embed') {
 const name = options.getString('name').toLowerCase().trim();

 if (name.includes(' ')) {
 return interaction.reply({ content: 'Custom trigger keywords cannot contain spaces!', ephemeral: true });
 }

 const modal = new ModalBuilder()
 .setCustomId(`customcmd_modal_${name}`)
 .setTitle(`Configure Embed: !${name}`);

 const titleInput = new TextInputBuilder()
 .setCustomId('title').setLabel('Embed Title').setStyle(TextInputStyle.Short)
 .setPlaceholder('Enter a bold header title (optional)...').setRequired(false);

 const descInput = new TextInputBuilder()
 .setCustomId('description').setLabel('Embed Description').setStyle(TextInputStyle.Paragraph)
 .setPlaceholder('Enter the main card body description text...').setRequired(true);

 const colorInput = new TextInputBuilder()
 .setCustomId('color').setLabel('Embed Color (Hex Code)').setStyle(TextInputStyle.Short)
 .setPlaceholder('e.g., #00FFCC (optional)...').setRequired(false);

 const imageInput = new TextInputBuilder()
 .setCustomId('image').setLabel('Embed Large Image URL').setStyle(TextInputStyle.Short)
 .setPlaceholder('https://example.com/banner.png (optional)...').setRequired(false);

 const thumbInput = new TextInputBuilder()
 .setCustomId('thumbnail').setLabel('Embed Small Thumbnail URL').setStyle(TextInputStyle.Short)
 .setPlaceholder('https://example.com/logo.png (optional)...').setRequired(false);

 modal.addComponents(
 new ActionRowBuilder().addComponents(titleInput),
 new ActionRowBuilder().addComponents(descInput),
 new ActionRowBuilder().addComponents(colorInput),
 new ActionRowBuilder().addComponents(imageInput),
 new ActionRowBuilder().addComponents(thumbInput)
 );

 return interaction.showModal(modal);
 }

 if (subcommand === 'remove') {
 const name = options.getString('name').toLowerCase().trim();
 const success = await db.removeCustomCommand(guild.id, name);

 if (!success) {
 return interaction.reply({
 content: `Could not find a custom command with trigger \`!${name}\` in this server.`,
 ephemeral: true
 });
 }

 return interaction.reply({ content: `Successfully deleted custom trigger \`!${name}\`.` });
 }

 if (subcommand === 'list') {
 const commands = await db.getCustomCommands(guild.id);

 if (commands.length === 0) {
 return interaction.reply({
 content: 'There are currently no custom triggers configured in this server. Use `/customcmd add` to get started!'
 });
 }

 await interaction.deferReply();

 const listText = commands.map(c => `• \`!${c.name}\` — ${c.isEmbed ? ' Rich Embed' : ' Plain Text'}`).join('\n');

 const container = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Custom Triggers Catalog`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(listText))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# ${commands.length} trigger${commands.length !== 1 ? 's' : ''} configured · Use /customcmd add to create more`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 } catch (err) {
 console.error('[CUSTOMCMD COMMAND ERROR] Failed:', err);
 const _errMsg = { content: 'Failed to process custom command operation.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.reply(_errMsg).catch(() => null);
 }
 }
 }
};
