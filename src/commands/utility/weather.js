const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    noDefer: true,
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Fetches real-time localized atmospheric conditions.')
        .addStringOption(opt => 
            opt.setName('location')
                .setDescription('The city or region to lookup')
                .setRequired(true)),

    /**
     * Executes the weather command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { options } = interaction;
        const location = options.getString('location').trim();

        try {
            await interaction.deferReply();

            // Request wttr JSON output format (j1)
            const response = await axios.get(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
            const data = response.data;

            const current = data.current_condition?.[0];
            const area = data.nearest_area?.[0];

            if (!current || !area) {
                return interaction.editReply({ content: `❌ Could not resolve meteorological data for location: \`${location}\`.` });
            }

            const tempC = current.temp_C;
            const tempF = current.temp_F;
            const feelsLikeC = current.FeelsLikeC;
            const feelsLikeF = current.FeelsLikeF;
            const desc = current.weatherDesc?.[0]?.value || 'Clear';
            const humidity = current.humidity;
            const wind = current.windspeedKmph;

            const city = area.areaName?.[0]?.value || location;
            const region = area.region?.[0]?.value || '';
            const country = area.country?.[0]?.value || '';

            const locationDisplay = region 
                ? `${city}, ${region} (${country})` 
                : `${city} (${country})`;

            // Map standard weather conditions to beautiful icons
            let weatherIcon = '☀️';
            const lowerDesc = desc.toLowerCase();
            if (lowerDesc.includes('rain') || lowerDesc.includes('drizzle')) weatherIcon = '🌧️';
            else if (lowerDesc.includes('snow') || lowerDesc.includes('sleet')) weatherIcon = '❄️';
            else if (lowerDesc.includes('thunder') || lowerDesc.includes('storm')) weatherIcon = '⛈️';
            else if (lowerDesc.includes('cloud') || lowerDesc.includes('overcast')) weatherIcon = '☁️';
            else if (lowerDesc.includes('fog') || lowerDesc.includes('mist') || lowerDesc.includes('haze')) weatherIcon = '🌫️';
            else if (lowerDesc.includes('wind')) weatherIcon = '💨';

            const embed = new EmbedBuilder()
                .setTitle(`${weatherIcon} Weather Report: ${locationDisplay}`)
                .setColor('#0ea5e9') // Sky blue
                .setDescription(`Currently experiencing: **${desc}**`)
                .addFields(
                    { name: 'Temperature Temp', value: `🌡️ **${tempC}°C**  /  **${tempF}°F**`, inline: true },
                    { name: 'Feels Like', value: `👤 **${feelsLikeC}°C**  /  **${feelsLikeF}°F**`, inline: true },
                    { name: 'Humidity Level', value: `💧 **${humidity}%**`, inline: true },
                    { name: 'Wind Conditions', value: `💨 **${wind} km/h**`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[WEATHER ERROR]', err);
            await interaction.editReply({ content: '❌ Failed to connect to wttr.in weather system.' });
        }
    }
};
