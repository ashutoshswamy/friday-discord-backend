const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
                return interaction.editReply({ content: '❌ Meme flagged NSFW. Try again.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(data.title)
                .setURL(data.postLink)
                .setColor('#8b5cf6')
                .setImage(data.url)
                .setFooter({ text: `r/${data.subreddit} • 👍 ${data.ups} • Requested by ${user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[MEME ERROR]', err);
            const msg = { content: '❌ Failed to fetch meme. Try a different subreddit.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => null);
            } else {
                await interaction.editReply(msg).catch(() => null);
            }
        }
    }
};
