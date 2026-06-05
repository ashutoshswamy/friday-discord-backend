const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Prevents or permits standard users from sending messages in a channel.')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to lock or unlock (defaults to the current channel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false))
        .addBooleanOption(option => 
            option.setName('unlock')
                .setDescription('Set to True to unlock the channel')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    /**
     * Executes the lockdown command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const unlock = interaction.options.getBoolean('unlock') || false;
        const { guild } = interaction;

        if (!guild || !targetChannel) return;

        // Ensure we are operating on a text or announcement channel
        if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) {
            return interaction.editReply({ 
                content: '❌ You can only lock text or announcement channels!', 
                ephemeral: true 
            });
        }

        try {
            const everyoneRole = guild.roles.everyone;

            if (unlock) {
                // Restore permissions for @everyone (null deletes the specific overwrite so they inherit server permissions)
                await targetChannel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: null
                }, { reason: `Channel unlocked by ${interaction.user.tag}` });

                const embed = new EmbedBuilder()
                    .setTitle('🔓 Channel Unlocked')
                    .setColor('#00FF00')
                    .setDescription(`This channel has been unlocked. Users can now resume sending messages.`)
                    .setTimestamp();

                await targetChannel.send({ embeds: [embed] }).catch(() => null);

                // If executed from another channel, reply to the mod ephemerally
                if (targetChannel.id !== interaction.channelId) {
                    await interaction.editReply({ content: `✅ Successfully unlocked ${targetChannel}.`, ephemeral: true });
                } else {
                    // Otherwise reply with a standard silent interaction reply
                    await interaction.editReply({ content: '✅ Channel unlocked!', ephemeral: true });
                }
            } else {
                // Disable SendMessages for @everyone
                await targetChannel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: false
                }, { reason: `Channel locked down by ${interaction.user.tag}` });

                const embed = new EmbedBuilder()
                    .setTitle('🔒 Channel Lockdown')
                    .setColor('#FF0000')
                    .setDescription(`This channel is now locked. Sending messages has been disabled for standard members.`)
                    .setTimestamp();

                await targetChannel.send({ embeds: [embed] }).catch(() => null);

                if (targetChannel.id !== interaction.channelId) {
                    await interaction.editReply({ content: `✅ Successfully locked down ${targetChannel}.`, ephemeral: true });
                } else {
                    await interaction.editReply({ content: '✅ Channel locked down!', ephemeral: true });
                }
            }
        } catch (err) {
            console.error('[ERROR] Lockdown command failed:', err);
            const _errMsg = { content: '❌ Failed to update channel permissions. Verify my role has the Manage Channels permission and is positioned above the target channel overrides.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
