const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Manage server events and scheduled activities.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        
        // Subcommand: create
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Deploy a guild event RSVP card.')
                .addStringOption(opt => opt.setName('title').setDescription('Event title / heading').setRequired(true))
                .addStringOption(opt => opt.setName('description').setDescription('Context details of the event').setRequired(true))
                .addStringOption(opt => opt.setName('date').setDescription('Time and date (e.g. Tomorrow at 8 PM)').setRequired(true))
                .addStringOption(opt => opt.setName('location').setDescription('Voice channel or physical location').setRequired(true))),

    /**
     * Executes the event command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, channel, options, client } = interaction;
        if (!guild || !channel) return;

        const subcommand = options.getSubcommand();

        client.events = client.events || new Map();

        try {
            if (subcommand === 'create') {
                const title = options.getString('title');
                const desc = options.getString('description');
                const date = options.getString('date');
                const location = options.getString('location');

                await interaction.editReply({ content: '✅ Deploying event card...', ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle(`📅 Guild Event: ${title}`)
                    .setColor('#FFCC00')
                    .setThumbnail(guild.iconURL({ forceStatic: true }))
                    .setDescription(desc)
                    .addFields(
                        { name: '⏰ Date / Time', value: `\`${date}\``, inline: true },
                        { name: '📍 Location', value: `\`${location}\``, inline: true },
                        { name: '👥 RSVPs (0)', value: '*No one yet*', inline: false }
                    )
                    .setFooter({ text: 'Click button below to RSVP!' })
                    .setTimestamp();

                const rsvpBtn = new ButtonBuilder()
                    .setCustomId(`event_rsvp_TEMP`)
                    .setLabel('⏰ RSVP / Attend')
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder().addComponents(rsvpBtn);

                const msg = await channel.send({ embeds: [embed], components: [row] });

                // Update custom ID with real message ID
                const realBtn = new ButtonBuilder()
                    .setCustomId(`event_rsvp_${msg.id}`)
                    .setLabel('⏰ RSVP / Attend')
                    .setStyle(ButtonStyle.Success);
                const realRow = new ActionRowBuilder().addComponents(realBtn);
                await msg.edit({ components: [realRow] });

                // Register event in client memory
                client.events.set(msg.id, {
                    messageId: msg.id,
                    title,
                    desc,
                    date,
                    location,
                    rsvps: new Set()
                });
            }
        } catch (err) {
            console.error('[EVENT CREATE ERROR]', err);
            const _errMsg = { content: '❌ Failed to deploy server event.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
