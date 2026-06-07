const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 MediaGalleryBuilder, MediaGalleryItemBuilder,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const axios = require('axios');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('meme')
 .setDescription('Fetches a random meme from Reddit.')
 .addStringOption(opt =>
 opt.setName('subreddit')
 .setDescription('Subreddit to fetch meme from (default: random)')
 .setRequired(false)),

 async execute(interaction) {
 const { user, options } = interaction;
 const subreddit = options.getString('subreddit');
 const url = subreddit
 ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}`
 : 'https://meme-api.com/gimme';

 try {
 const { data } = await axios.get(url);

 if (data.nsfw) {
 return interaction.editReply({ content: 'Meme flagged NSFW. Try again.', ephemeral: true });
 }

 const postBtn = new ButtonBuilder()
 .setLabel('View Post')
 .setStyle(ButtonStyle.Link)
 .setURL(data.postLink);

 const container = new ContainerBuilder()
 .setAccentColor(0x8b5cf6)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${data.title}\n-# r/${data.subreddit} · ${data.ups}`
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addMediaGalleryComponents(
 new MediaGalleryBuilder().addItems(
 new MediaGalleryItemBuilder().setURL(data.url).setDescription(data.title)
 )
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(postBtn)
 );

 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });
 } catch (err) {
 console.error('[MEME ERROR]', err);
 const msg = { content: 'Failed to fetch meme. Try a different subreddit.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
 else await interaction.editReply(msg).catch(() => null);
 }
 }
};
