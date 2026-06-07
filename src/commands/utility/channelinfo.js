const {
    SlashCommandBuilder, ChannelType,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder,
    ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelinfo')
        .setDescription('Displays detailed information and metadata about a server channel.')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('The channel you want to inspect')
                .setRequired(true)),

    async execute(interaction) {
        const { guild, options } = interaction;
        if (!guild) return;

        const channel = options.getChannel('channel');

        try {
            const createdUnix = Math.floor(channel.createdTimestamp / 1000);

            let readableType = 'Unknown Channel';
            if (channel.type === ChannelType.GuildText) readableType = '📝 Text Channel';
            if (channel.type === ChannelType.GuildVoice) readableType = '🎙️ Voice Channel';
            if (channel.type === ChannelType.GuildCategory) readableType = '📁 Category Folder';
            if (channel.type === ChannelType.GuildAnnouncement) readableType = '📢 Announcement Channel';
            if (channel.type === ChannelType.GuildStageVoice) readableType = '🎭 Stage Channel';

            let details = `**Channel:** ${channel}\n` +
                `**ID:** \`${channel.id}\`\n` +
                `**Type:** ${readableType}\n` +
                `**Category:** ${channel.parent ? `📁 ${channel.parent.name}` : '`None`'}\n` +
                `**NSFW:** ${channel.nsfw ? '🔞 Yes (Restricted)' : '✅ No (Safe)'}\n` +
                `**Created:** <t:${createdUnix}:F> (<t:${createdUnix}:R>)`;

            if (channel.type === ChannelType.GuildText && channel.topic) {
                details += `\n**Topic:** *"${channel.topic}"*`;
            }

            if (channel.type === ChannelType.GuildVoice) {
                details += `\n**Bitrate:** 🔊 ${channel.bitrate / 1000}kbps\n` +
                    `**User Limit:** ${channel.userLimit > 0 ? `👥 ${channel.userLimit.toLocaleString()} max` : '👥 Unlimited'}`;
            }

            const container = new ContainerBuilder()
                .setAccentColor(0x8b5cf6)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 📺 Channel Profile: ${channel.name}`)
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png')
                        )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(details)
                );

            await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });
        } catch (err) {
            console.error('[CHANNELINFO ERROR]', err);
            const errMsg = { content: '❌ Failed to fetch channel information.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
            else await interaction.editReply(errMsg).catch(() => null);
        }
    }
};
