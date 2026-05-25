const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome onboarding greetings for new server members.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to post welcome greetings inside')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Custom welcome text. Placeholders: {user}, {username}, {server}, {memberCount}')
                .setRequired(true)),

    /**
     * Executes the welcome setup command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const messageText = interaction.options.getString('message');
        const { guild } = interaction;

        if (!guild || !channel) return;

        try {
            // Save welcome channel and template within guild configurations inside Supabase
            await db.updateGuildConfig(guild.id, {
                welcomeChannelId: channel.id,
                welcomeMessage: messageText
            });

            const embed = new EmbedBuilder()
                .setTitle('👋 Welcome System Enabled')
                .setColor('#00FFCC')
                .setDescription(`Onboarding greeting cards successfully directed to ${channel}.`)
                .addFields({
                    name: 'Welcome Greeting Template',
                    value: `\`\`\`\n${messageText}\n\`\`\``
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[WELCOME CONFIG ERROR] Failed to save configs:', err);
            const errMsg = { 
                content: '❌ Failed to save welcome configuration. Verify database connection.', 
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
