const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alerts')
        .setDescription('Configure social media stream and upload notifications.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand: youtube
        .addSubcommand(sub =>
            sub.setName('youtube')
                .setDescription('Configure YouTube video upload notification alerts.')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add Alert Subscription', value: 'add' },
                            { name: 'Remove Alert Subscription', value: 'remove' },
                            { name: 'List Active Subscriptions', value: 'list' }
                        ))
                .addStringOption(opt =>
                    opt.setName('url')
                        .setDescription('The YouTube channel URL link')
                        .setRequired(false))
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Discord channel to send notifications inside')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)))
        
        // Subcommand: twitch
        .addSubcommand(sub =>
            sub.setName('twitch')
                .setDescription('Configure Twitch stream live notification alerts.')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add Alert Subscription', value: 'add' },
                            { name: 'Remove Alert Subscription', value: 'remove' },
                            { name: 'List Active Subscriptions', value: 'list' }
                        ))
                .addStringOption(opt =>
                    opt.setName('username')
                        .setDescription('The Twitch username channel')
                        .setRequired(false))
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Discord channel to send notifications inside')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))),

    /**
     * Executes the alerts command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: youtube
            // ------------------------------------------
            if (subcommand === 'youtube') {
                const action = options.getString('action');
                const url = options.getString('url');
                const channel = options.getChannel('channel');

                // Validation: Alterations require target URLs and Discord pings channel
                if (action !== 'list' && (!url || !channel)) {
                    return interaction.editReply({ 
                        content: '❌ You must specify both a YouTube channel `url` and a target text `channel`!', 
                        ephemeral: true 
                    });
                }

                if (action === 'add') {
                    await db.addYoutubeAlert(guild.id, channel.id, url);
                    return interaction.editReply({ content: `📹 Successfully linked YouTube video upload alerts for ${url} to ping ${channel}!` });
                }

                if (action === 'remove') {
                    const success = await db.removeYoutubeAlert(guild.id, url);
                    return interaction.editReply({
                        content: success ? `✅ Successfully removed YouTube alerts subscription for ${url}.` : `❌ No active subscription was found for ${url}.`,
                        ephemeral: !success
                    });
                }

                if (action === 'list') {
                    const alertsList = await db.getYoutubeAlerts(guild.id);
                    if (alertsList.length === 0) {
                        return interaction.editReply({ content: '📜 There are currently no YouTube alert subscriptions configured.' });
                    }

                    const listText = alertsList.map((item, idx) => `${idx + 1}. **Channel**: <#${item.channelId}> • **URL**: ${item.youtubeUrl}`).join('\n');

                    const embed = new EmbedBuilder()
                        .setTitle('📹 YouTube Alert Subscriptions')
                        .setColor('#FF0000')
                        .setDescription(listText)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }
            }

            // ------------------------------------------
            // B. Subcommand: twitch
            // ------------------------------------------
            if (subcommand === 'twitch') {
                const action = options.getString('action');
                const username = options.getString('username');
                const channel = options.getChannel('channel');

                // Validation: Alterations require targeted username and Discord pings channel
                if (action !== 'list' && (!username || !channel)) {
                    return interaction.editReply({ 
                        content: '❌ You must specify both a Twitch `username` and a target text `channel`!', 
                        ephemeral: true 
                    });
                }

                if (action === 'add') {
                    await db.addTwitchAlert(guild.id, channel.id, username);
                    return interaction.editReply({ content: `🎮 Successfully linked Twitch stream live alerts for **${username}** to ping ${channel}!` });
                }

                if (action === 'remove') {
                    const success = await db.removeTwitchAlert(guild.id, username);
                    return interaction.editReply({
                        content: success ? `✅ Successfully removed Twitch live alerts subscription for **${username}**.` : `❌ No active subscription was found for **${username}**.`,
                        ephemeral: !success
                    });
                }

                if (action === 'list') {
                    const alertsList = await db.getTwitchAlerts(guild.id);
                    if (alertsList.length === 0) {
                        return interaction.editReply({ content: '📜 There are currently no Twitch live alert subscriptions configured.' });
                    }

                    const listText = alertsList.map((item, idx) => `${idx + 1}. **Channel**: <#${item.channelId}> • **Twitch User**: \`${item.twitchUsername}\``).join('\n');

                    const embed = new EmbedBuilder()
                        .setTitle('🎮 Twitch Live Alert Subscriptions')
                        .setColor('#9146FF')
                        .setDescription(listText)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }
            }

        } catch (err) {
            console.error('[ALERTS COMMAND ERROR] Failed:', err);
            const _errMsg = { content: '❌ Failed to process social media alerts configuration.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
