const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelinfo')
        .setDescription('Displays detailed information and metadata about a server channel.')
        .addChannelOption(opt => 
            opt.setName('channel')
                .setDescription('The channel you want to inspect')
                .setRequired(true)),

    /**
     * Executes the channelinfo command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options } = interaction;
        if (!guild) return;

        const channel = options.getChannel('channel');

        try {
            const createdUnix = Math.floor(channel.createdTimestamp / 1000);
            
            // Map channel type to readable name
            let readableType = 'Unknown Channel';
            if (channel.type === ChannelType.GuildText) readableType = '📝 Text Channel';
            if (channel.type === ChannelType.GuildVoice) readableType = '🎙️ Voice Channel';
            if (channel.type === ChannelType.GuildCategory) readableType = '📁 Category Folder';
            if (channel.type === ChannelType.GuildAnnouncement) readableType = '📢 Announcement Channel';
            if (channel.type === ChannelType.GuildStageVoice) readableType = '🎭 Stage Channel';

            const embed = new EmbedBuilder()
                .setTitle(`📺 Channel Profile: ${channel.name}`)
                .setColor('#8b5cf6')
                .setTimestamp()
                .addFields(
                    { name: 'Channel Name', value: `${channel}`, inline: true },
                    { name: 'Channel ID', value: `\`${channel.id}\``, inline: true },
                    { name: 'Channel Type', value: `${readableType}`, inline: true },
                    { name: 'Category Parent', value: channel.parent ? `📁 ${channel.parent.name}` : '`None`', inline: true },
                    { name: 'NSFW Restriction', value: channel.nsfw ? '🔞 Yes (Restricted)' : '✅ No (Safe)', inline: true },
                    { name: 'Created At', value: `<t:${createdUnix}:F> (<t:${createdUnix}:R>)`, inline: false }
                );

            if (channel.type === ChannelType.GuildText && channel.topic) {
                embed.addFields({ name: 'Channel Topic', value: `*"${channel.topic}"*`, inline: false });
            }

            if (channel.type === ChannelType.GuildVoice) {
                embed.addFields(
                    { name: 'User Bitrate', value: `🔊 ${channel.bitrate / 1000}kbps`, inline: true },
                    { name: 'User Limit Capacity', value: channel.userLimit > 0 ? `👥 ${channel.userLimit.toLocaleString()} members max` : '👥 Unlimited', inline: true }
                );
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[CHANNELINFO ERROR]', err);
            const _errMsg = { content: '❌ Failed to fetch channel information.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
