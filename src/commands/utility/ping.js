const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong! and latency information.'),
    
    /**
     * Executes the ping command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        // Send a temporary reply and retrieve the message object to calculate roundtrip latency
        const sent = await interaction.editReply({ 
            content: 'Calculating latency... 🏓', 
            fetchReply: true 
        });
        
        const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.editReply(
            `Pong! 🏓\n` +
            `• **Roundtrip Latency:** \`${roundtripLatency}ms\`\n` +
            `• **WebSocket/API Latency:** \`${apiLatency}ms\``
        );
    },
};
