const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Displays detailed, styled statistics about the current server.'),

    /**
     * Executes the serverinfo command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild } = interaction;
        if (!guild) return;

        try {
            // Fetch owner details asynchronously
            const owner = await guild.fetchOwner();

            // Count roles and channels
            const rolesCount = guild.roles.cache.size;
            const channels = guild.channels.cache;
            const textCount = channels.filter(c => c.type === 0 || c.type === 5).size; // GuildText and GuildAnnouncement
            const voiceCount = channels.filter(c => c.type === 2).size; // GuildVoice

            const verificationLabels = {
                0: 'None',
                1: 'Low (Verified Email)',
                2: 'Medium (Registered > 5m)',
                3: 'High (Member > 10m)',
                4: 'Very High (Verified Phone)'
            };

            const createdUnix = Math.floor(guild.createdTimestamp / 1000);

            const embed = new EmbedBuilder()
                .setTitle(`🏰 Server Info: ${guild.name}`)
                .setColor('#00FFCC')
                .setThumbnail(guild.iconURL({ forceStatic: true }))
                .addFields(
                    { name: 'Server Owner', value: `${owner} (\`${owner.id}\`)`, inline: true },
                    { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
                    { name: 'Created On', value: `<t:${createdUnix}:F> (<t:${createdUnix}:R>)`, inline: false },
                    { name: 'Members Count', value: `👥 **${guild.memberCount.toLocaleString()}** members`, inline: true },
                    { name: 'Role Count', value: `🎭 **${rolesCount}** roles`, inline: true },
                    { name: 'Boosts', value: `🚀 **${guild.premiumSubscriptionCount || 0}** boosts (Level ${guild.premiumTier})`, inline: true },
                    { name: 'Channels Catalog', value: `💬 **${textCount}** Text | 🔊 **${voiceCount}** Voice (Total: ${channels.size})`, inline: true },
                    { name: 'Security Level', value: `🛡️ **${verificationLabels[guild.verificationLevel]}**`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[SERVERINFO COMMAND ERROR] Failed:', err);
            const _errMsg = { content: '❌ Failed to collect server statistics.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
