const {
 SlashCommandBuilder,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

function mockText(text) {
 return text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('mock')
  .setDescription('Transforms text into the classic SpongeBob mocking alternating-case format.')
  .addStringOption(opt =>
   opt.setName('text').setDescription('The text to mock').setRequired(true)),

 async execute(interaction) {
  const text = interaction.options.getString('text');
  if (text.length > 500) {
   return interaction.editReply({ content: 'Text must be 500 characters or less.', ephemeral: true });
  }

  const mocked = mockText(text);

  const container = new ContainerBuilder()
   .setAccentColor(0xFFD700)
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Mock Text\n${mocked}`)
   )
   .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Original: ${text.length > 100 ? text.substring(0, 97) + '...' : text}`)
   );

  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
};
