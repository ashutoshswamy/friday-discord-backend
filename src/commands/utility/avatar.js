const {
 SlashCommandBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder,
 ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize,
 MediaGalleryBuilder, MediaGalleryItemBuilder,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('avatar')
 .setDescription('Fetches and displays the high-resolution profile avatar of any user.')
 .addUserOption(opt =>
 opt.setName('user')
 .setDescription('The user whose avatar you want to see (defaults to you)')
 .setRequired(false)),

 async execute(interaction) {
 const { user, options } = interaction;
 const targetUser = options.getUser('user') || user;

 try {
 const avatarUrl = targetUser.displayAvatarURL({ forceStatic: false, size: 1024 });
 const downloadUrl = targetUser.displayAvatarURL({ forceStatic: true, size: 2048 });

 const pngBtn = new ButtonBuilder()
 .setLabel('Download PNG')
 .setStyle(ButtonStyle.Link)
 .setURL(downloadUrl);

 const webpBtn = new ButtonBuilder()
 .setLabel('View WebP')
 .setStyle(ButtonStyle.Link)
 .setURL(avatarUrl);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${targetUser.username}'s Avatar\n` +
 `**User:** ${targetUser}\n**ID:** \`${targetUser.id}\``
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true, size: 64 }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addMediaGalleryComponents(
 new MediaGalleryBuilder().addItems(
 new MediaGalleryItemBuilder().setURL(avatarUrl).setDescription(`${targetUser.username}'s avatar`)
 )
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(pngBtn, webpBtn)
 );

 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });
 } catch (err) {
 console.error('[AVATAR ERROR]', err);
 const errMsg = { content: 'Failed to load user avatar.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
