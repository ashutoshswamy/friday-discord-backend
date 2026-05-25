const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    noDefer: true,
    data: new SlashCommandBuilder()
        .setName('customcmd')
        .setDescription('Create and manage custom chat trigger commands (e.g., !rules).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand: add
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Create a custom text trigger command.')
                .addStringOption(opt => 
                    opt.setName('name')
                        .setDescription('The trigger keyword (e.g., rules)')
                        .setRequired(true))
                .addStringOption(opt => 
                    opt.setName('text')
                        .setDescription('The plain-text response when the command is triggered')
                        .setRequired(true)))
        
        // Subcommand: embed
        .addSubcommand(sub =>
            sub.setName('embed')
                .setDescription('Opens a Modal form to build a rich embed custom trigger command.')
                .addStringOption(opt => 
                    opt.setName('name')
                        .setDescription('The trigger keyword (e.g., socials)')
                        .setRequired(true)))
        
        // Subcommand: remove
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Delete an active custom command trigger.')
                .addStringOption(opt => 
                    opt.setName('name')
                        .setDescription('The trigger keyword to delete')
                        .setRequired(true)))
        
        // Subcommand: list
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all custom trigger commands configured in this server.')),

    /**
     * Executes the customcmd command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: add
            // ------------------------------------------
            if (subcommand === 'add') {
                const name = options.getString('name').toLowerCase().trim();
                const text = options.getString('text');

                // Validation: Trigger names cannot contain spaces
                if (name.includes(' ')) {
                    return interaction.reply({ content: '❌ Custom trigger keywords cannot contain spaces!', ephemeral: true });
                }

                await db.addCustomCommand(guild.id, name, text, false, null);
                return interaction.reply({ content: `✅ Successfully created trigger command: \`!${name}\`!` });
            }

            // ------------------------------------------
            // B. Subcommand: embed
            // ------------------------------------------
            if (subcommand === 'embed') {
                const name = options.getString('name').toLowerCase().trim();

                if (name.includes(' ')) {
                    return interaction.reply({ content: '❌ Custom trigger keywords cannot contain spaces!', ephemeral: true });
                }

                // Construct Modal builder prompt
                const modal = new ModalBuilder()
                    .setCustomId(`customcmd_modal_${name}`)
                    .setTitle(`Configure Embed: !${name}`);

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

                // Add text inputs into individual action rows
                const row1 = new ActionRowBuilder().addComponents(titleInput);
                const row2 = new ActionRowBuilder().addComponents(descInput);
                const row3 = new ActionRowBuilder().addComponents(colorInput);
                const row4 = new ActionRowBuilder().addComponents(imageInput);
                const row5 = new ActionRowBuilder().addComponents(thumbInput);

                modal.addComponents(row1, row2, row3, row4, row5);

                // Launch modal form popup
                return interaction.showModal(modal);
            }

            // ------------------------------------------
            // C. Subcommand: remove
            // ------------------------------------------
            if (subcommand === 'remove') {
                const name = options.getString('name').toLowerCase().trim();

                const success = await db.removeCustomCommand(guild.id, name);

                if (!success) {
                    return interaction.reply({ 
                        content: `❌ Could not find a custom command with trigger \`!${name}\` in this server.`, 
                        ephemeral: true 
                    });
                }

                return interaction.reply({ content: `✅ Successfully deleted custom trigger \`!${name}\`.` });
            }

            // ------------------------------------------
            // D. Subcommand: list
            // ------------------------------------------
            if (subcommand === 'list') {
                const commands = await db.getCustomCommands(guild.id);

                if (commands.length === 0) {
                    return interaction.reply({ 
                        content: '📜 There are currently no custom triggers configured in this server. Use `/customcmd add` to get started!' 
                    });
                }

                const listText = commands.map(c => `• \`!${c.name}\` [${c.isEmbed ? '🎨 Rich Embed' : '📝 Plain Text'}]`).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('📜 Custom Triggers Catalog')
                    .setColor('#00FFCC')
                    .setDescription(listText)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

        } catch (err) {
            console.error('[CUSTOMCMD COMMAND ERROR] Failed:', err);
            const _errMsg = { content: '❌ Failed to process custom command operation.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.reply(_errMsg).catch(() => null);
            }
        }
    }
};
