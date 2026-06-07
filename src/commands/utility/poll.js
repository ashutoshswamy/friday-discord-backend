const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create and manage native Discord polls.')

        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Post a new native Discord poll in this channel.')
                .addStringOption(opt =>
                    opt.setName('question').setDescription('The question to ask').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('options').setDescription('Comma-separated options (e.g. Yes, No, Maybe)').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('duration').setDescription('How long the poll runs in hours (1–168, default: 24)').setMinValue(1).setMaxValue(168).setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('multiselect').setDescription('Allow users to vote for multiple options (default: false)').setRequired(false)))

        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('End a running poll early and reveal final results.')
                .addStringOption(opt =>
                    opt.setName('id').setDescription('Message ID of the poll to close').setRequired(true))),

    async execute(interaction) {
        const { guild, channel, user, options } = interaction;
        const sub = options.getSubcommand();

        // ── Create
        if (sub === 'create') {
            const question    = options.getString('question');
            const rawOptions  = options.getString('options');
            const duration    = options.getInteger('duration') ?? 24;
            const multiselect = options.getBoolean('multiselect') ?? false;

            const optionsList = rawOptions.split(',').map(o => o.trim()).filter(o => o);

            if (optionsList.length < 2)
                return interaction.editReply({ content: '❌ At least **2** options required.', ephemeral: true });
            if (optionsList.length > 10)
                return interaction.editReply({ content: '❌ Maximum **10** options allowed.', ephemeral: true });

            try {
                const msg = await channel.send({
                    poll: {
                        question: { text: question },
                        answers: optionsList.map(opt => ({ text: opt })),
                        duration,
                        allowMultiselect: multiselect,
                    }
                });

                await db.savePoll(guild.id, channel.id, msg.id, question, optionsList, []);
                await interaction.editReply({ content: `📊 Poll posted! (runs for **${duration}h**)`, ephemeral: true });
            } catch (err) {
                console.error('[POLL CREATE ERROR]', err);
                const e = { content: `❌ Failed to create poll: ${err.message}`, ephemeral: true };
                interaction.replied || interaction.deferred
                    ? await interaction.followUp(e).catch(() => null)
                    : await interaction.editReply(e).catch(() => null);
            }
            return;
        }

        // ── Close
        if (sub === 'close') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.editReply({ content: '❌ You need **Manage Server** permission to close polls.', ephemeral: true });
            }

            const messageId = options.getString('id').trim();

            try {
                const polls = await db.getPolls(guild.id);
                const poll  = polls.find(p => p.id === messageId);

                if (!poll)
                    return interaction.editReply({ content: '❌ No poll found with that message ID in this server.', ephemeral: true });
                if (poll.status === 'closed')
                    return interaction.editReply({ content: '⚠️ That poll is already closed.', ephemeral: true });

                const pollChannel = await guild.channels.fetch(poll.channelId).catch(() => null);
                if (!pollChannel)
                    return interaction.editReply({ content: '❌ The channel this poll was posted in no longer exists.', ephemeral: true });

                const msg = await pollChannel.messages.fetch(messageId).catch(() => null);
                if (!msg)
                    return interaction.editReply({ content: '❌ Could not find the poll message. It may have been deleted.', ephemeral: true });

                const endedMsg = await pollChannel.messages.endPoll(messageId).catch(async (err) => {
                    console.error('[POLL CLOSE ERROR] endPoll failed:', err);
                    return null;
                });

                const freshMsg = endedMsg
                    ? await pollChannel.messages.fetch(messageId).catch(() => endedMsg)
                    : null;

                let results = null;

                if (freshMsg?.poll) {
                    const answers    = [...(freshMsg.poll.answers).values()];
                    const totalVotes = answers.reduce((s, a) => s + (a.voteCount ?? 0), 0);
                    const maxVotes   = Math.max(0, ...answers.map(a => a.voteCount ?? 0));

                    results = answers.map(a => {
                        const count = a.voteCount ?? 0;
                        const pct   = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        return { text: a.text, count, pct, winner: count === maxVotes && maxVotes > 0 };
                    });

                    const resultsText = results.map(r => {
                        const filled = Math.round(r.pct / 10);
                        const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
                        return `**${r.text}**${r.winner ? ' 🏆' : ''}\n\`${bar}\` ${r.pct}% (${r.count.toLocaleString()} vote${r.count !== 1 ? 's' : ''})`;
                    }).join('\n\n');

                    await db.closePoll(messageId, results);

                    const container = new ContainerBuilder()
                        .setAccentColor(0x71717a)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 📊 Poll Closed\n**${poll.question}**`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(resultsText || '*No votes recorded.*')
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `-# Closed by ${user.tag} · ${totalVotes.toLocaleString()} total vote${totalVotes !== 1 ? 's' : ''}`
                            )
                        );

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
                }

                await db.closePoll(messageId, results);
                await interaction.editReply({ content: `🔒 Poll closed! Results visible in <#${poll.channelId}>.` });
            } catch (err) {
                console.error('[POLL CLOSE ERROR]', err);
                const e = { content: '❌ Failed to close poll.', ephemeral: true };
                interaction.replied || interaction.deferred
                    ? await interaction.followUp(e).catch(() => null)
                    : await interaction.editReply(e).catch(() => null);
            }
        }
    }
};
