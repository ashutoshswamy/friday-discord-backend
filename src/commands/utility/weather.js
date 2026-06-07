const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
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

    async execute(interaction) {
        const { options } = interaction;
        const location = options.getString('location').trim();

        try {
            await interaction.deferReply();

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
            const locationDisplay = region ? `${city}, ${region} (${country})` : `${city} (${country})`;

            let weatherIcon = '☀️';
            const lowerDesc = desc.toLowerCase();
            if (lowerDesc.includes('rain') || lowerDesc.includes('drizzle')) weatherIcon = '🌧️';
            else if (lowerDesc.includes('snow') || lowerDesc.includes('sleet')) weatherIcon = '❄️';
            else if (lowerDesc.includes('thunder') || lowerDesc.includes('storm')) weatherIcon = '⛈️';
            else if (lowerDesc.includes('cloud') || lowerDesc.includes('overcast')) weatherIcon = '☁️';
            else if (lowerDesc.includes('fog') || lowerDesc.includes('mist') || lowerDesc.includes('haze')) weatherIcon = '🌫️';
            else if (lowerDesc.includes('wind')) weatherIcon = '💨';

            const container = new ContainerBuilder()
                .setAccentColor(0x0ea5e9)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${weatherIcon} Weather Report: ${locationDisplay}\nCurrently experiencing: **${desc}**`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**🌡️ Temperature:** **${tempC}°C** / **${tempF}°F**\n` +
                        `**👤 Feels Like:** **${feelsLikeC}°C** / **${feelsLikeF}°F**\n` +
                        `**💧 Humidity:** **${humidity}%**\n` +
                        `**💨 Wind Speed:** **${wind} km/h**`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[WEATHER ERROR]', err);
            await interaction.editReply({ content: '❌ Failed to connect to wttr.in weather system.' });
        }
    }
};
