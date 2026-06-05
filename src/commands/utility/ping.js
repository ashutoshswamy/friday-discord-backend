const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Displays bot latency and connection diagnostics.'),

    async execute(interaction) {
        const sent = await interaction.editReply({
            content: '`Calculating...`',
            fetchReply: true
        });

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const ws = Math.round(interaction.client.ws.ping);

        const latencyColor = ws < 100 ? '#00FF66' : ws < 200 ? '#FFD700' : '#FF3333';
        const latencyStatus = ws < 100 ? '🟢 Excellent' : ws < 200 ? '🟡 Good' : '🔴 High Latency';

        const embed = new EmbedBuilder()
            .setTitle('🏓 Connection Diagnostics')
            .setColor(latencyColor)
            .setThumbnail(interaction.client.user.displayAvatarURL({ forceStatic: true }))
            .addFields(
                { name: '📡 Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
                { name: '⚡ WebSocket Ping', value: `\`${ws}ms\``, inline: true },
                { name: '📊 Status', value: latencyStatus, inline: true }
            )
            .setFooter({ text: 'Click Refresh to recalculate' })
            .setTimestamp();

        const refreshBtn = new ButtonBuilder()
            .setCustomId('ping_refresh')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(refreshBtn);

        const response = await interaction.editReply({ content: '', embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'ping_refresh',
            time: 60000,
            max: 5
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const newWs = Math.round(interaction.client.ws.ping);
            const newColor = newWs < 100 ? '#00FF66' : newWs < 200 ? '#FFD700' : '#FF3333';
            const newStatus = newWs < 100 ? '🟢 Excellent' : newWs < 200 ? '🟡 Good' : '🔴 High Latency';

            const refreshed = await i.fetchReply();
            const newRoundtrip = refreshed.createdTimestamp - i.createdTimestamp;

            const newEmbed = new EmbedBuilder()
                .setTitle('🏓 Connection Diagnostics')
                .setColor(newColor)
                .setThumbnail(interaction.client.user.displayAvatarURL({ forceStatic: true }))
                .addFields(
                    { name: '📡 Roundtrip Latency', value: `\`${newRoundtrip}ms\``, inline: true },
                    { name: '⚡ WebSocket Ping', value: `\`${newWs}ms\``, inline: true },
                    { name: '📊 Status', value: newStatus, inline: true }
                )
                .setFooter({ text: 'Refreshed just now' })
                .setTimestamp();

            await i.editReply({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', async () => {
            const disabled = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(refreshBtn).setDisabled(true)
            );
            await interaction.editReply({ components: [disabled] }).catch(() => null);
        });
    },
};
