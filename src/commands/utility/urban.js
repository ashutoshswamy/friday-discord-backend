const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const axios = require('axios');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
 .setName('urban')
 .setDescription('Lookup slang definitions from the Urban Dictionary. (NSFW channels only)')
 .setNSFW(true)
 .addStringOption(opt =>
 opt.setName('term')
 .setDescription('The word or phrase to lookup')
 .setRequired(true)),

 async execute(interaction) {
 const { options } = interaction;
 const term = options.getString('term').trim();

 if (!interaction.channel?.nsfw) {
 return interaction.reply({
 content: 'This command can only be used in **NSFW channels**. Urban Dictionary may contain explicit content.',
 ephemeral: true,
 });
 }

 try {
 await interaction.deferReply();

 const response = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
 const { list } = response.data;

 if (!list || list.length === 0) {
 return interaction.editReply({ content: `No definitions found for term: \`${term}\`.` });
 }

 const topDef = list[0];
 const cleanText = (text) => text.replace(/\[|\]/g, '');

 const definition = topDef.definition.length > 1000
 ? `${topDef.definition.substring(0, 997)}...`
 : topDef.definition;

 const example = topDef.example
 ? (topDef.example.length > 500 ? `${topDef.example.substring(0, 497)}...` : topDef.example)
 : 'No example provided.';

 const linkBtn = new ButtonBuilder()
 .setLabel('Full Entry')
 .setStyle(ButtonStyle.Link)
 .setURL(topDef.permalink);

 const container = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Urban Dictionary: ${topDef.word}\n*Definition by **${topDef.author}***`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Definition:**\n${cleanText(definition)}`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Example:**\n*${cleanText(example)}*`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Feedback:** **${topDef.thumbs_up}** · **${topDef.thumbs_down}**`
 )
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(linkBtn)
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[URBAN ERROR]', err);
 await interaction.editReply({ content: 'Failed to connect to Urban Dictionary API.' });
 }
 }
};
