const {
 SlashCommandBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder,
 ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

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

 const latencyColor = ws < 100 ? 0x00FF66 : ws < 200 ? 0xFFD700 : 0xFF3333;
 const latencyStatus = ws < 100 ? ' Excellent' : ws < 200 ? ' Good' : ' High Latency';

 const refreshBtn = new ButtonBuilder()
 .setCustomId('ping_refresh')
 .setLabel('Refresh')
 .setStyle(ButtonStyle.Secondary);

 const buildContainer = (rt, wsMs, status, color, footerText) =>
 new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Connection Diagnostics`)
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(interaction.client.user.displayAvatarURL({ forceStatic: true }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Roundtrip Latency:** \`${rt}ms\`\n` +
 `**WebSocket Ping:** \`${wsMs}ms\`\n` +
 `**Status:** ${status}`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# ${footerText}`)
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(refreshBtn)
 );

 const response = await interaction.editReply({
 content: '',
 flags: MessageFlags.IsComponentsV2,
 components: [buildContainer(roundtrip, ws, latencyStatus, latencyColor, 'Click Refresh to recalculate')]
 });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === interaction.user.id && i.customId === 'ping_refresh',
 time: 60000,
 max: 5
 });

 collector.on('collect', async i => {
 await i.deferUpdate();
 const newWs = Math.round(interaction.client.ws.ping);
 const newColor = newWs < 100 ? 0x00FF66 : newWs < 200 ? 0xFFD700 : 0xFF3333;
 const newStatus = newWs < 100 ? ' Excellent' : newWs < 200 ? ' Good' : ' High Latency';
 const refreshed = await i.fetchReply();
 const newRoundtrip = refreshed.createdTimestamp - i.createdTimestamp;
 await i.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [buildContainer(newRoundtrip, newWs, newStatus, newColor, 'Refreshed just now')]
 });
 });

 collector.on('end', async () => {
 const disabled = new ActionRowBuilder().addComponents(
 ButtonBuilder.from(refreshBtn).setDisabled(true)
 );
 const finalContainer = buildContainer(roundtrip, ws, latencyStatus, latencyColor, 'Expired');
 finalContainer.spliceComponents(-1, 1, disabled);
 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [finalContainer]
 }).catch(() => null);
 });
 },
};
