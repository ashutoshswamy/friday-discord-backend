const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

    /**
     * Executes the urban command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const { options } = interaction;
        const term = options.getString('term').trim();

        if (!interaction.channel?.nsfw) {
            return interaction.reply({
                content: '🔞 This command can only be used in **NSFW channels**. Urban Dictionary may contain explicit content.',
                ephemeral: true,
            });
        }

        try {
            await interaction.deferReply();

            const response = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
            const { list } = response.data;

            if (!list || list.length === 0) {
                return interaction.editReply({ content: `❌ No definitions found for term: \`${term}\`.` });
            }

            // Grab top definition
            const topDef = list[0];
            
            // Clean square brackets [] commonly used in Urban Dictionary markdown links
            const cleanText = (text) => text.replace(/\[|\]/g, '');

            const definition = topDef.definition.length > 1024 
                ? `${topDef.definition.substring(0, 1021)}...` 
                : topDef.definition;

            const example = topDef.example 
                ? (topDef.example.length > 1024 ? `${topDef.example.substring(0, 1021)}...` : topDef.example)
                : 'No example provided.';

            const embed = new EmbedBuilder()
                .setTitle(`📚 Urban Dictionary: ${topDef.word}`)
                .setURL(topDef.permalink)
                .setColor('#1D2439') // Sleek dark slate
                .setDescription(`*Definition by **${topDef.author}***`)
                .addFields(
                    { name: 'Definition', value: cleanText(definition), inline: false },
                    { name: 'Example Case', value: `*${cleanText(example)}*`, inline: false },
                    { name: 'Feedback Ratio', value: `👍 **${topDef.thumbs_up}**  /  👎 **${topDef.thumbs_down}**`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[URBAN ERROR]', err);
            await interaction.editReply({ content: '❌ Failed to connect to Urban Dictionary API.' });
        }
    }
};
