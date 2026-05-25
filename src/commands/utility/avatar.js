const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Fetches and displays the high-resolution profile avatar of any user.')
        .addUserOption(opt => 
            opt.setName('user')
                .setDescription('The user whose avatar you want to see (defaults to you)')
                .setRequired(false)),

    /**
     * Executes the avatar command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { user, options } = interaction;

        const targetUser = options.getUser('user') || user;

        try {
            const avatarUrl = targetUser.displayAvatarURL({ forceStatic: false, size: 1024 });

            const embed = new EmbedBuilder()
                .setTitle(`👤 ${targetUser.username}'s Avatar`)
                .setColor('#8b5cf6')
                .setImage(avatarUrl)
                .setDescription(`[Download Avatar Links](${targetUser.displayAvatarURL({ forceStatic: true, size: 2048 })})`)
                .setFooter({ text: `Requested by ${user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[AVATAR ERROR]', err);
            const _errMsg = { content: '❌ Failed to load user avatar.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
