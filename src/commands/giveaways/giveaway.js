const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

function parseDuration(timeStr) {
    const regex = /^(\d+)([smh])$/;
    const match = timeStr.match(regex);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create and manage server giveaways.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        
        // Subcommand: start
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Launch a new interactive giveaway with button entries.')
                .addStringOption(opt => opt.setName('duration').setDescription('Giveaway duration (e.g. 30s, 5m, 2h)').setRequired(true))
                .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners to draw').setRequired(true).setMinValue(1))
                .addStringOption(opt => opt.setName('prize').setDescription('The prize item being offered').setRequired(true)))
        
        // Subcommand: end
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('Immediately close a running giveaway and draw winners.')
                .addStringOption(opt => opt.setName('id').setDescription('The Message ID of the active giveaway').setRequired(true)))
        
        // Subcommand: reroll
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('Select new winners from the participants of an ended giveaway.')
                .addStringOption(opt => opt.setName('id').setDescription('The Message ID of the ended giveaway').setRequired(true))),

    /**
     * Executes the giveaway command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, channel, options, client } = interaction;
        if (!guild || !channel) return;

        const subcommand = options.getSubcommand();
        const id = options.getString('id');

        client.giveaways = client.giveaways || new Map();

        try {
            // ------------------------------------------
            // A. Subcommand: start
            // ------------------------------------------
            if (subcommand === 'start') {
                const durationInput = options.getString('duration').trim().toLowerCase();
                const winnersCount = options.getInteger('winners');
                const prize = options.getString('prize');

                const durationMs = parseDuration(durationInput);
                if (!durationMs || durationMs < 10000) {
                    return interaction.editReply({
                        content: '❌ Invalid duration! Use formats like `30s` (30 seconds), `5m` (5 minutes), or `2h` (2 hours). Minimum duration is 10 seconds.',
                        ephemeral: true
                    });
                }

                const endUnix = Math.floor((Date.now() + durationMs) / 1000);

                const embed = new EmbedBuilder()
                    .setTitle('🎉 GIVEAWAY LAUNCHED! 🎉')
                    .setDescription(
                        `**Prize:** 🎁 **${prize}**\n` +
                        `**Winners Count:** 👥 ${winnersCount}\n` +
                        `**Time Remaining:** Ends **<t:${endUnix}:R>** (at <t:${endUnix}:f>)\n\n` +
                        `Click the button below to join the draw!`
                    )
                    .setColor('#FF0099')
                    .setFooter({ text: 'Giveaway Entry System' })
                    .setTimestamp();

                const joinBtn = new ButtonBuilder()
                    .setCustomId(`giveaway_join_TEMP_ID`) // Will replace with message ID
                    .setLabel('🎉 Enter Draw')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(joinBtn);

                await interaction.editReply({ content: '✅ Starting giveaway...', ephemeral: true });

                const msg = await channel.send({ embeds: [embed], components: [row] });
                
                // Replace joinBtn ID with the real message ID for persistence
                const realJoinBtn = new ButtonBuilder()
                    .setCustomId(`giveaway_join_${msg.id}`)
                    .setLabel('🎉 Enter Draw')
                    .setStyle(ButtonStyle.Primary);
                const realRow = new ActionRowBuilder().addComponents(realJoinBtn);
                await msg.edit({ components: [realRow] });

                // Register giveaway in client memory
                client.giveaways.set(msg.id, {
                    messageId: msg.id,
                    channelId: channel.id,
                    prize,
                    winnersCount,
                    entrants: new Set(),
                    active: true,
                    timer: setTimeout(() => endGiveaway(msg.id), durationMs)
                });

                return;
            }

            // ------------------------------------------
            // B. Subcommand: end
            // ------------------------------------------
            if (subcommand === 'end') {
                if (!client.giveaways.has(id)) {
                    return interaction.editReply({ content: '❌ Could not find an active giveaway matching that message ID!', ephemeral: true });
                }

                await interaction.editReply({ content: '🔒 Closing giveaway and drawing winners...', ephemeral: true });
                endGiveaway(id);
                return;
            }

            // ------------------------------------------
            // C. Subcommand: reroll
            // ------------------------------------------
            if (subcommand === 'reroll') {
                if (!client.giveaways.has(id)) {
                    return interaction.editReply({ content: '❌ No recorded participants found for that giveaway ID in memory!', ephemeral: true });
                }

                const giveaway = client.giveaways.get(id);
                const entrantsArray = Array.from(giveaway.entrants);

                if (entrantsArray.length === 0) {
                    return interaction.editReply({ content: '❌ No one entered the giveaway, so it cannot be re-rolled!', ephemeral: true });
                }

                // Choose new winners
                const shuffled = entrantsArray.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, giveaway.winnersCount);

                const winnerPings = winners.map(w => `<@${w}>`).join(', ');

                const embed = new EmbedBuilder()
                    .setTitle('🎉 GIVEAWAY RE-ROLLED! 🎉')
                    .setColor('#FF0099')
                    .setDescription(
                        `**Prize:** 🎁 **${giveaway.prize}**\n` +
                        `**New Winners Draw:** ${winnerPings}!\n\n` +
                        `Congratulations on your victory!`
                    )
                    .setTimestamp();

                await channel.send({ content: `🎉 Congratulations ${winnerPings}! You won the re-roll for **${giveaway.prize}**!`, embeds: [embed] });
                return interaction.editReply({ content: '✅ Giveaway successfully re-rolled!', ephemeral: true });
            }

            // ------------------------------------------
            // Helper Function: End Giveaway
            // ------------------------------------------
            async function endGiveaway(messageId) {
                if (!client.giveaways.has(messageId)) return;
                const giveaway = client.giveaways.get(messageId);
                
                if (!giveaway.active) return;
                giveaway.active = false;
                clearTimeout(giveaway.timer);

                const targetChannel = await client.channels.fetch(giveaway.channelId).catch(() => null);
                if (!targetChannel) return;

                const message = await targetChannel.messages.fetch(messageId).catch(() => null);
                if (!message) return;

                const entrantsArray = Array.from(giveaway.entrants);

                // Disable button
                const disabledBtn = new ButtonBuilder()
                    .setCustomId(`giveaway_ended_${messageId}`)
                    .setLabel('🔒 Closed')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(disabledBtn);

                if (entrantsArray.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 GIVEAWAY ENDED 🎉')
                        .setColor('#71717a')
                        .setDescription(
                            `**Prize:** 🎁 **${giveaway.prize}**\n\n` +
                            `❌ **Draw Cancelled:** No valid entrants participated in the draw.`
                        )
                        .setTimestamp();

                    await message.edit({ embeds: [embed], components: [disabledRow] });
                    return;
                }

                // Choose winners
                const shuffled = entrantsArray.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, giveaway.winnersCount);

                const winnerPings = winners.map(w => `<@${w}>`).join(', ');

                const embed = new EmbedBuilder()
                    .setTitle('🎉 GIVEAWAY RESULTS 🎉')
                    .setColor('#FF0099')
                    .setDescription(
                        `**Prize Won:** 🎁 **${giveaway.prize}**\n` +
                        `**Winners Drawn:** ${winnerPings}!\n\n` +
                        `Thank you everyone for participating!`
                    )
                    .setTimestamp();

                await message.edit({ embeds: [embed], components: [disabledRow] });
                await targetChannel.send({ content: `🎉 Congratulations ${winnerPings}! You won **${giveaway.prize}**!`, reply: { messageReference: messageId } });
            }

        } catch (err) {
            console.error('[GIVEAWAY ERROR]', err);
            const _errMsg = { content: '❌ Failed to process giveaway operation.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
