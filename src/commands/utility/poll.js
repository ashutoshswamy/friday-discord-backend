const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/db');

const DEFAULT_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create and manage reaction polls.')

        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Post a new reaction poll in this channel.')
                .addStringOption(opt =>
                    opt.setName('question').setDescription('The question to poll').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('options').setDescription('Comma-separated options (e.g. Yes, No, Maybe)').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('emojis').setDescription('Comma-separated emojis matching each option (e.g. ✅,❌,🤔)').setRequired(false)))

        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close a poll and show final results.')
                .addStringOption(opt =>
                    opt.setName('id').setDescription('Message ID of the poll to close').setRequired(true))),

    async execute(interaction) {
        const { guild, channel, user, options } = interaction;
        const sub = options.getSubcommand();

        // ── Create
        if (sub === 'create') {
            const question  = options.getString('question');
            const rawOptions = options.getString('options');
            const rawEmojis  = options.getString('emojis');

            const optionsList = rawOptions.split(',').map(o => o.trim()).filter(o => o);

            if (optionsList.length < 2)
                return interaction.editReply({ content: '❌ At least **2** options required.', ephemeral: true });
            if (optionsList.length > 10)
                return interaction.editReply({ content: '❌ Maximum **10** options allowed.', ephemeral: true });

            let emojiList = DEFAULT_EMOJIS;
            if (rawEmojis) {
                const parsed = rawEmojis.split(',').map(e => e.trim()).filter(e => e);
                if (parsed.length !== optionsList.length)
                    return interaction.editReply({ content: `❌ Emoji count (**${parsed.length}**) must match option count (**${optionsList.length}**).`, ephemeral: true });
                emojiList = parsed;
            }

            try {
                const embed = new EmbedBuilder()
                    .setTitle(`📊 ${question}`)
                    .setColor('#00FFCC')
                    .setDescription(optionsList.map((opt, i) => `${emojiList[i]} ${opt}`).join('\n\n'))
                    .setFooter({ text: `Created by ${user.tag}` })
                    .setTimestamp();

                // Send as a normal channel message — interaction reply objects
                // don't support .react() reliably in discord.js v14
                const msg = await channel.send({ embeds: [embed] });

                for (let i = 0; i < optionsList.length; i++) {
                    await msg.react(emojiList[i]);
                }

                await db.savePoll(guild.id, channel.id, msg.id, question, optionsList, emojiList);
                await interaction.editReply({ content: `📊 Poll posted!`, ephemeral: true });
            } catch (err) {
                console.error('[POLL CREATE ERROR]', err);
                const e = { content: `❌ Failed to create poll: ${err.message}`, ephemeral: true };
                interaction.replied || interaction.deferred ? await interaction.followUp(e).catch(() => null) : await interaction.editReply(e).catch(() => null);
            }
            return;
        }

        // ── Close
        if (sub === 'close') {
            // Only admins/manage-guild can close polls
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

                const pollEmojis = (poll.emojis?.length === poll.options.length) ? poll.emojis : DEFAULT_EMOJIS;

                const votes = poll.options.map((opt, i) => {
                    const reaction = msg.reactions.cache.get(pollEmojis[i]);
                    const count = reaction ? Math.max(0, reaction.count - 1) : 0;
                    return { opt, count };
                });

                const totalVotes = votes.reduce((s, v) => s + v.count, 0);
                const maxVotes   = Math.max(...votes.map(v => v.count));

                const resultsText = votes.map((v, i) => {
                    const pct    = totalVotes > 0 ? Math.round((v.count / totalVotes) * 100) : 0;
                    const filled = Math.round(pct / 10);
                    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
                    const winner = v.count === maxVotes && maxVotes > 0 ? ' 🏆' : '';
                    return `${pollEmojis[i]} **${v.opt}**${winner}\n\`${bar}\` ${pct}% (${v.count} vote${v.count !== 1 ? 's' : ''})`;
                }).join('\n\n');

                const closedEmbed = new EmbedBuilder()
                    .setTitle(`📊 [CLOSED] ${poll.question}`)
                    .setColor('#71717a')
                    .setDescription(resultsText || '*No votes recorded.*')
                    .setFooter({ text: `Closed by ${user.tag} · ${totalVotes} total vote${totalVotes !== 1 ? 's' : ''}` })
                    .setTimestamp();

                await msg.edit({ embeds: [closedEmbed] });
                await msg.reactions.removeAll().catch(() => null);
                await db.closePoll(messageId);

                await interaction.editReply({ content: `🔒 Poll closed! Results posted in <#${poll.channelId}>.`, ephemeral: true });
            } catch (err) {
                console.error('[POLL CLOSE ERROR]', err);
                const e = { content: '❌ Failed to close poll.', ephemeral: true };
                interaction.replied || interaction.deferred ? await interaction.followUp(e).catch(() => null) : await interaction.editReply(e).catch(() => null);
            }
        }
    }
};
