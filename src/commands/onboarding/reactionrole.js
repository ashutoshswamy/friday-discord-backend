const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Creates a dynamic, button-based reaction role toggle menu.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('title')
                .setDescription('The title of the reaction role embed card')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('description')
                .setDescription('The description text for the embed card')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('role1')
                .setDescription('Role Option 1')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('role2')
                .setDescription('Role Option 2 (optional)')
                .setRequired(false))
        .addRoleOption(option => 
            option.setName('role3')
                .setDescription('Role Option 3 (optional)')
                .setRequired(false))
        .addRoleOption(option => 
            option.setName('role4')
                .setDescription('Role Option 4 (optional)')
                .setRequired(false))
        .addRoleOption(option => 
            option.setName('role5')
                .setDescription('Role Option 5 (optional)')
                .setRequired(false)),

    /**
     * Executes the reactionrole command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const { channel } = interaction;

        if (!channel) return;

        // Retrieve and compile all supplied roles
        const rolesList = [];
        for (let i = 1; i <= 5; i++) {
            const role = interaction.options.getRole(`role${i}`);
            if (role) rolesList.push(role);
        }

        try {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor('#00FFCC')
                .setTimestamp();

            const row = new ActionRowBuilder();

            // Append buttons linked to role toggles dynamically
            rolesList.forEach(role => {
                const button = new ButtonBuilder()
                    .setCustomId(`role_${role.id}`)
                    .setLabel(role.name)
                    .setStyle(ButtonStyle.Primary);
                
                row.addComponents(button);
            });

            // Send the prompt in the targeted channel
            await channel.send({ 
                embeds: [embed], 
                components: [row] 
            });

            return interaction.editReply({ 
                content: '✅ Reaction role menu successfully deployed in this channel!', 
                ephemeral: true 
            });
        } catch (err) {
            console.error('[REACTION ROLE ERROR] Failed to deploy reaction roles:', err);
            const errMsg = { 
                content: '❌ Failed to create reaction role menu.', 
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
