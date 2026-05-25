const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Creates a standardized poll with reaction voting buttons.')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('The question or topic to poll')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('options')
                .setDescription('Comma-separated list of options (e.g. Yes, No, Maybe)')
                .setRequired(true)),

    /**
     * Executes the poll command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const question = interaction.options.getString('question');
        const rawOptions = interaction.options.getString('options');

        // Split options by comma and clean up whitespaces
        const optionsList = rawOptions.split(',').map(o => o.trim()).filter(o => o !== '');

        // Validation bounds check
        if (optionsList.length < 2) {
            return interaction.editReply({ 
                content: '❌ You must provide at least **2** options for a valid poll!', 
                ephemeral: true 
            });
        }

        if (optionsList.length > 10) {
            return interaction.editReply({ 
                content: '❌ You can only specify up to a maximum of **10** options for reaction polls.', 
                ephemeral: true 
            });
        }

        const digitEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

        try {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Server Poll: ${question}`)
                .setColor('#00FFCC')
                .setDescription(optionsList.map((opt, idx) => `${digitEmojis[idx]} ${opt}`).join('\n\n'))
                .setFooter({ text: `Created by ${interaction.user.tag}` })
                .setTimestamp();

            // Reply and retrieve the message object to append reaction triggers
            const responseMessage = await interaction.editReply({ 
                embeds: [embed], 
                fetchReply: true 
            });

            // React with standard digit emojis sequentially
            for (let i = 0; i < optionsList.length; i++) {
                await responseMessage.react(digitEmojis[i]).catch(() => null);
            }
        } catch (err) {
            console.error('[POLL COMMAND ERROR] Failed to deploy poll:', err);
            const _errMsg = { content: '❌ Failed to deploy server poll.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
