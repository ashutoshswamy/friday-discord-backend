const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servericon')
        .setDescription('Fetches and displays the high-resolution branding icon of this server.'),

    /**
     * Executes the servericon command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        try {
            const iconUrl = guild.iconURL({ forceStatic: false, size: 1024 });

            if (!iconUrl) {
                return interaction.editReply({ content: '❌ This server does not have a custom branding icon set!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏰 Server Icon: ${guild.name}`)
                .setColor('#8b5cf6')
                .setImage(iconUrl)
                .setDescription(`[Download Icon Link](${guild.iconURL({ forceStatic: true, size: 2048 })})`)
                .setFooter({ text: `Requested by ${user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[SERVERICON ERROR]', err);
            const _errMsg = { content: '❌ Failed to load server icon.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
