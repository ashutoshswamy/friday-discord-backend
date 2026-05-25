const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Inspect server activity audit logs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addSubcommand(sub =>
            sub.setName('message')
                .setDescription('View recent deleted and edited chat messages logs.')
                .addUserOption(opt => opt.setName('user').setDescription('Filter logs for a specific member').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('voice')
                .setDescription('View recent voice channel connection activity.')
                .addUserOption(opt => opt.setName('user').setDescription('Filter voice logs for a specific member').setRequired(false))),

    /**
     * Executes the logs command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options, client } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();
        const targetUser = options.getUser('user');

        try {
            if (subcommand === 'message') {
                const logs = client.messageAuditLog || [];
                // Filter by guild and user if specified
                let filtered = logs.filter(l => l.guildId === guild.id);
                if (targetUser) {
                    filtered = filtered.filter(l => l.userId === targetUser.id);
                }

                if (filtered.length === 0) {
                    return interaction.editReply({ content: '📜 No recent chat message edits or deletions logged.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📝 Chat Activity Logs: ${guild.name}`)
                    .setColor('#FF9900')
                    .setTimestamp();

                const logsText = filtered.slice(0, 15).map((l, index) => {
                    const time = `<t:${Math.floor(l.timestamp / 1000)}:T>`;
                    if (l.type === 'DELETE') {
                        return `${time} 🗑️ **[DELETE]** <@${l.userId}> in **#${l.channelName}**:\n> *${l.content.substring(0, 100)}*`;
                    } else {
                        return `${time} ✏️ **[EDIT]** <@${l.userId}> in **#${l.channelName}**:\n> **Old:** *${l.oldContent.substring(0, 80)}*\n> **New:** *${l.newContent.substring(0, 80)}*`;
                    }
                }).join('\n\n');

                embed.setDescription(logsText);
                await interaction.editReply({ embeds: [embed] });
            } 
            
            else if (subcommand === 'voice') {
                const logs = client.voiceAuditLog || [];
                // Filter by guild and user if specified
                let filtered = logs.filter(l => l.guildId === guild.id);
                if (targetUser) {
                    filtered = filtered.filter(l => l.userId === targetUser.id);
                }

                if (filtered.length === 0) {
                    return interaction.editReply({ content: '📜 No recent voice activity logged.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🎙️ Voice Connection Logs: ${guild.name}`)
                    .setColor('#00CCFF')
                    .setTimestamp();

                const logsText = filtered.slice(0, 15).map(l => {
                    const time = `<t:${Math.floor(l.timestamp / 1000)}:T>`;
                    return `${time} 👤 <@${l.userId}>: ${l.details}`;
                }).join('\n');

                embed.setDescription(logsText);
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[LOGS COMMAND ERROR]', err);
            const _errMsg = { content: '❌ Failed to load incident logs.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
