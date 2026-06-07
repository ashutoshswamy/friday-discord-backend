const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
 .setName('embed')
 .setDescription('Build a customized rich embed card using an interactive Modal wizard.')
 .addSubcommand(sub =>
 sub.setName('create')
 .setDescription('Opens the interactive Modal embed builder wizard.')),

 /**
 * Executes the embed command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
 async execute(interaction) {
 // Construct the modal form popup
 const modal = new ModalBuilder()
 .setCustomId('embed_modal')
 .setTitle('Rich Embed Builder');

 const titleInput = new TextInputBuilder()
 .setCustomId('title')
 .setLabel('Embed Title')
 .setStyle(TextInputStyle.Short)
 .setPlaceholder('Enter a bold header title (optional)...')
 .setRequired(false);

 const descInput = new TextInputBuilder()
 .setCustomId('description')
 .setLabel('Embed Description')
 .setStyle(TextInputStyle.Paragraph)
 .setPlaceholder('Enter the main card body description text...')
 .setRequired(true);

 const colorInput = new TextInputBuilder()
 .setCustomId('color')
 .setLabel('Embed Color (Hex Code)')
 .setStyle(TextInputStyle.Short)
 .setPlaceholder('e.g., #00FFCC (optional)...')
 .setRequired(false);

 const imageInput = new TextInputBuilder()
 .setCustomId('image')
 .setLabel('Embed Large Image URL')
 .setStyle(TextInputStyle.Short)
 .setPlaceholder('https://example.com/banner.png (optional)...')
 .setRequired(false);

 const thumbInput = new TextInputBuilder()
 .setCustomId('thumbnail')
 .setLabel('Embed Small Thumbnail URL')
 .setStyle(TextInputStyle.Short)
 .setPlaceholder('https://example.com/logo.png (optional)...')
 .setRequired(false);

 // Put each text input inside its own ActionRow row
 const row1 = new ActionRowBuilder().addComponents(titleInput);
 const row2 = new ActionRowBuilder().addComponents(descInput);
 const row3 = new ActionRowBuilder().addComponents(colorInput);
 const row4 = new ActionRowBuilder().addComponents(imageInput);
 const row5 = new ActionRowBuilder().addComponents(thumbInput);

 modal.addComponents(row1, row2, row3, row4, row5);

 // Launch modal popup
 return interaction.showModal(modal);
 }
};
