const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Creates a dynamic, button-based reaction role toggle menu.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the reaction role card')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The description text for the card')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role1').setDescription('Role Option 1').setRequired(true))
        .addRoleOption(option =>
            option.setName('role2').setDescription('Role Option 2 (optional)').setRequired(false))
        .addRoleOption(option =>
            option.setName('role3').setDescription('Role Option 3 (optional)').setRequired(false))
        .addRoleOption(option =>
            option.setName('role4').setDescription('Role Option 4 (optional)').setRequired(false))
        .addRoleOption(option =>
            option.setName('role5').setDescription('Role Option 5 (optional)').setRequired(false)),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const { channel } = interaction;

        if (!channel) return;

        const rolesList = [];
        for (let i = 1; i <= 5; i++) {
            const role = interaction.options.getRole(`role${i}`);
            if (role) rolesList.push(role);
        }

        try {
            const row = new ActionRowBuilder();
            rolesList.forEach(role => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`role_${role.id}`)
                        .setLabel(role.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            const roleListText = rolesList.map(r => `<@&${r.id}>`).join(' · ');

            const container = new ContainerBuilder()
                .setAccentColor(0x00FFCC)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${title}\n${description}`)
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Available Roles:** ${roleListText}\n-# Click a button below to toggle a role`)
                )
                .addActionRowComponents(row);

            await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });

            return interaction.editReply({
                content: '✅ Reaction role menu successfully deployed in this channel!',
                ephemeral: true
            });
        } catch (err) {
            console.error('[REACTION ROLE ERROR] Failed to deploy reaction roles:', err);
            const errMsg = { content: '❌ Failed to create reaction role menu.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp(errMsg).catch(() => {});
            } else {
                return interaction.editReply(errMsg).catch(() => {});
            }
        }
    }
};
