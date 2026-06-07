const {
 SlashCommandBuilder,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

const FONT = {
 ' ': ['     ', '     ', '     ', '     ', '     '],
 'A': [' ### ', '#   #', '#####', '#   #', '#   #'],
 'B': ['#### ', '#   #', '#### ', '#   #', '#### '],
 'C': [' ####', '#    ', '#    ', '#    ', ' ####'],
 'D': ['#### ', '#   #', '#   #', '#   #', '#### '],
 'E': ['#####', '#    ', '###  ', '#    ', '#####'],
 'F': ['#####', '#    ', '###  ', '#    ', '#    '],
 'G': [' ####', '#    ', '# ###', '#   #', ' ####'],
 'H': ['#   #', '#   #', '#####', '#   #', '#   #'],
 'I': ['#####', '  #  ', '  #  ', '  #  ', '#####'],
 'J': ['#####', '   # ', '   # ', '#  # ', ' ##  '],
 'K': ['#  # ', '# #  ', '##   ', '# #  ', '#  # '],
 'L': ['#    ', '#    ', '#    ', '#    ', '#####'],
 'M': ['#   #', '## ##', '# # #', '#   #', '#   #'],
 'N': ['#   #', '##  #', '# # #', '#  ##', '#   #'],
 'O': [' ### ', '#   #', '#   #', '#   #', ' ### '],
 'P': ['#### ', '#   #', '#### ', '#    ', '#    '],
 'Q': [' ### ', '#   #', '# # #', '#  # ', ' ## #'],
 'R': ['#### ', '#   #', '#### ', '# #  ', '#  ##'],
 'S': [' ####', '#    ', ' ### ', '    #', '#### '],
 'T': ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
 'U': ['#   #', '#   #', '#   #', '#   #', ' ### '],
 'V': ['#   #', '#   #', '#   #', ' # # ', '  #  '],
 'W': ['#   #', '#   #', '# # #', '## ##', '#   #'],
 'X': ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
 'Y': ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
 'Z': ['#####', '   # ', '  #  ', ' #   ', '#####'],
 '0': [' ### ', '#  ##', '# # #', '##  #', ' ### '],
 '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '#####'],
 '2': [' ### ', '#   #', '  ## ', ' #   ', '#####'],
 '3': ['#### ', '    #', ' ### ', '    #', '#### '],
 '4': ['#  # ', '#  # ', '#####', '   # ', '   # '],
 '5': ['#####', '#    ', '#### ', '    #', '#### '],
 '6': [' ### ', '#    ', '#### ', '#   #', ' ### '],
 '7': ['#####', '    #', '   # ', '  #  ', '  #  '],
 '8': [' ### ', '#   #', ' ### ', '#   #', ' ### '],
 '9': [' ### ', '#   #', ' ####', '    #', ' ### '],
 '!': ['  #  ', '  #  ', '  #  ', '     ', '  #  '],
 '?': [' ### ', '#   #', '  ## ', '     ', '  #  '],
};

function renderAscii(text) {
 const chars = text.toUpperCase().split('').filter(c => FONT[c]);
 if (chars.length === 0) return null;

 const lines = ['', '', '', '', ''];
 for (const char of chars) {
  const glyph = FONT[char];
  for (let i = 0; i < 5; i++) lines[i] += glyph[i] + ' ';
 }
 return '```\n' + lines.join('\n') + '\n```';
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('ascii')
  .setDescription('Renders your text as large ASCII block letters in a code block.')
  .addStringOption(opt =>
   opt.setName('text')
    .setDescription('Text to render (A-Z, 0-9, max 10 chars)')
    .setRequired(true)),

 async execute(interaction) {
  const raw = interaction.options.getString('text');
  const text = raw.replace(/[^a-zA-Z0-9 !?]/g, '').substring(0, 10);

  if (!text.trim()) {
   return interaction.editReply({
    content: 'Only letters A–Z, digits 0–9, spaces, `!` and `?` are supported.',
    ephemeral: true
   });
  }

  const rendered = renderAscii(text);
  if (!rendered) {
   return interaction.editReply({ content: 'Could not render that text.', ephemeral: true });
  }

  const container = new ContainerBuilder()
   .setAccentColor(0xA855F7)
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ASCII Art\n${rendered}`)
   )
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Input: "${text.toUpperCase()}" • Max 10 characters`)
   );

  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
};
