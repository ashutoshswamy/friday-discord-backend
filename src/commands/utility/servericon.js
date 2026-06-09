const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 MediaGalleryBuilder, MediaGalleryItemBuilder,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('servericon')
 .setDescription('Fetches and displays the high-resolution branding icon of this server.'),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 try {
 const iconUrl = guild.iconURL({ forceStatic: false, size: 1024 });

 if (!iconUrl) {
 return interaction.editReply({ content: 'This server does not have a custom branding icon set!', ephemeral: true });
 }

 const downloadUrl = guild.iconURL({ forceStatic: true, size: 2048 });

 const downloadBtn = new ButtonBuilder()
 .setLabel('Download PNG')
 .setStyle(ButtonStyle.Link)
 .setURL(downloadUrl);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Server Icon: ${guild.name}\n**Server ID:** \`${guild.id}\``
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true, size: 64 }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addMediaGalleryComponents(
 new MediaGalleryBuilder().addItems(
 new MediaGalleryItemBuilder().setURL(iconUrl).setDescription(`${guild.name} server icon`)
 )
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(downloadBtn)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Requested by ${user.tag}`)
 );

 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });
 } catch (err) {
 console.error('[SERVERICON ERROR]', err);
 const errMsg = { content: 'Failed to load server icon.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
