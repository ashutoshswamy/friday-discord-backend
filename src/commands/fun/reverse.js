const {
 SlashCommandBuilder,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
  .setName('reverse')
  .setDescription('Reverses your input text backwards.')
  .addStringOption(opt =>
   opt.setName('text').setDescription('The text to reverse').setRequired(true)),

 async execute(interaction) {
  const text = interaction.options.getString('text');
  if (text.length > 500) {
   return interaction.editReply({ content: 'Text must be 500 characters or less.', ephemeral: true });
  }

  const reversed = [...text].reverse().join('');

  const container = new ContainerBuilder()
   .setAccentColor(0x00E5FF)
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Reversed Text\n${reversed}`)
   )
   .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Original: ${text.length > 100 ? text.substring(0, 97) + '...' : text}`)
   );

  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
};
