const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');
const { JOBS, TIER_LABELS, TIER_COLORS, getJobByKey } = require('../../utils/jobs');

const JOB_CHOICES = Object.values(JOBS).map(j => ({ name: `${j.emoji} ${j.name} (Tier ${j.tier})`, value: j.key }));

const TIER_EMOJIS = { 1: '🟢', 2: '🔵', 3: '🟣', 4: '🔴' };

function buildTierEmbed(tier) {
    const jobs = Object.values(JOBS).filter(j => j.tier === tier);
    const tierFirstJob = jobs[0];

    const embed = new EmbedBuilder()
        .setTitle(`💼 Job Board — ${TIER_EMOJIS[tier]} ${TIER_LABELS[tier]} (Tier ${tier})`)
        .setColor(TIER_COLORS[tier])
        .setDescription(
            `**Level Required:** ${tierFirstJob.levelRequired}+\n` +
            `Apply with \`/job apply\`. Higher tiers pay more per \`/work\` shift.\n​`
        )
        .setTimestamp();

    jobs.forEach(j => {
        embed.addFields({
            name: `${j.emoji} ${j.name}`,
            value: `*${j.description}*\n🪙 **${j.minPay.toLocaleString()}–${j.maxPay.toLocaleString()}**/shift${j.xpBonus > 0 ? ` · **+${j.xpBonus.toLocaleString()} XP**` : ''}`,
        });
    });

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('job')
        .setDescription('Manage your career and earn better pay with higher-tier jobs.')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Browse all available jobs by tier.'))
        .addSubcommand(sub =>
            sub.setName('apply')
                .setDescription('Apply for a job. Must meet the level requirement.')
                .addStringOption(opt =>
                    opt.setName('job')
                        .setDescription('Job to apply for')
                        .setRequired(true)
                        .addChoices(...JOB_CHOICES)))
        .addSubcommand(sub =>
            sub.setName('quit')
                .setDescription('Quit your current job. You will earn generic work pay until you re-apply.'))
        .addSubcommand(sub =>
            sub.setName('profile')
                .setDescription('View your current job and career stats.')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to check (defaults to you)')
                        .setRequired(false))),

    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const sub = options.getSubcommand();

        // ── /job list ──────────────────────────────────────────────────
        if (sub === 'list') {
            let currentTier = 1;

            const tierSelect = new StringSelectMenuBuilder()
                .setCustomId('job_tier_select')
                .setPlaceholder('🔍 Filter by Tier...')
                .addOptions(
                    { label: `${TIER_EMOJIS[1]} Tier 1 — ${TIER_LABELS[1]} (Level 1+)`, value: '1', default: true },
                    { label: `${TIER_EMOJIS[2]} Tier 2 — ${TIER_LABELS[2]} (Level 5+)`, value: '2' },
                    { label: `${TIER_EMOJIS[3]} Tier 3 — ${TIER_LABELS[3]} (Level 10+)`, value: '3' },
                    { label: `${TIER_EMOJIS[4]} Tier 4 — ${TIER_LABELS[4]} (Level 20+)`, value: '4' }
                );

            const row = new ActionRowBuilder().addComponents(tierSelect);

            const response = await interaction.editReply({
                embeds: [buildTierEmbed(currentTier)],
                components: [row]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                currentTier = parseInt(i.values[0]);

                const updatedSelect = new StringSelectMenuBuilder()
                    .setCustomId('job_tier_select')
                    .setPlaceholder('🔍 Filter by Tier...')
                    .addOptions(
                        { label: `${TIER_EMOJIS[1]} Tier 1 — ${TIER_LABELS[1]} (Level 1+)`, value: '1', default: currentTier === 1 },
                        { label: `${TIER_EMOJIS[2]} Tier 2 — ${TIER_LABELS[2]} (Level 5+)`, value: '2', default: currentTier === 2 },
                        { label: `${TIER_EMOJIS[3]} Tier 3 — ${TIER_LABELS[3]} (Level 10+)`, value: '3', default: currentTier === 3 },
                        { label: `${TIER_EMOJIS[4]} Tier 4 — ${TIER_LABELS[4]} (Level 20+)`, value: '4', default: currentTier === 4 }
                    );

                await i.editReply({
                    embeds: [buildTierEmbed(currentTier)],
                    components: [new ActionRowBuilder().addComponents(updatedSelect)]
                });
            });

            collector.on('end', async () => {
                const disabledSelect = new StringSelectMenuBuilder()
                    .setCustomId('job_tier_select')
                    .setPlaceholder('🔍 Filter by Tier...')
                    .setDisabled(true)
                    .addOptions({ label: 'Expired', value: 'expired' });
                await interaction.editReply({
                    components: [new ActionRowBuilder().addComponents(disabledSelect)]
                }).catch(() => null);
            });

            return;
        }

        // ── /job apply ─────────────────────────────────────────────────
        if (sub === 'apply') {
            const jobKey = options.getString('job');
            const job = getJobByKey(jobKey);

            if (!job) return interaction.editReply({ content: '❌ Unknown job.', ephemeral: true });

            const profile = await db.getProfile(guild.id, user.id);

            if (profile.level < job.levelRequired) {
                return interaction.editReply({
                    content: `❌ You need to be **Level ${job.levelRequired}** to become a ${job.emoji} **${job.name}**. You are currently Level **${profile.level}**.`,
                    ephemeral: true,
                });
            }

            if (profile.currentJob === jobKey) {
                return interaction.editReply({ content: `ℹ️ You already work as a ${job.emoji} **${job.name}**.`, ephemeral: true });
            }

            const result = await db.applyJob(guild.id, user.id, jobKey);
            if (!result.success) {
                const nextSwitchUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
                return interaction.editReply({
                    content: `⏳ You recently switched jobs. You can switch again <t:${nextSwitchUnix}:R>.`,
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${job.emoji} Job Offer Accepted!`)
                .setColor(TIER_COLORS[job.tier])
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Welcome aboard, **${user.username}**! You are now employed as a **${job.name}**.`)
                .addFields(
                    { name: 'Position',  value: `${job.emoji} ${job.name}`,                       inline: true },
                    { name: 'Tier',      value: `${TIER_LABELS[job.tier]} (Tier ${job.tier})`,     inline: true },
                    { name: 'Pay Range', value: `🪙 ${job.minPay.toLocaleString()}–${job.maxPay.toLocaleString()} per /work shift`,  inline: true },
                    { name: 'XP Bonus',  value: job.xpBonus > 0 ? `+${job.xpBonus.toLocaleString()} XP per shift` : 'None', inline: true },
                    { name: 'Req. Level', value: `Level ${job.levelRequired}+`,                   inline: true },
                )
                .setFooter({ text: 'Use /work to earn coins. Job switch cooldown: 1 hour.' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /job quit ──────────────────────────────────────────────────
        if (sub === 'quit') {
            const profile = await db.getProfile(guild.id, user.id);

            if (!profile.currentJob) {
                return interaction.editReply({ content: `ℹ️ You don't have a job to quit.`, ephemeral: true });
            }

            const prevJob = getJobByKey(profile.currentJob);

            const confirmBtn = new ButtonBuilder()
                .setCustomId('job_quit_confirm')
                .setLabel('✅ Resign')
                .setStyle(ButtonStyle.Danger);

            const cancelBtn = new ButtonBuilder()
                .setCustomId('job_quit_cancel')
                .setLabel('❌ Keep Job')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

            const confirmEmbed = new EmbedBuilder()
                .setTitle('📤 Confirm Resignation')
                .setColor('#FF4500')
                .setDescription(
                    `Are you sure you want to resign from ${prevJob ? `${prevJob.emoji} **${prevJob.name}**` : 'your current job'}?\n\n` +
                    `You will revert to generic \`/work\` pay until you re-apply for a new position.`
                );

            const response = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async i => {
                if (i.customId === 'job_quit_confirm') {
                    await db.quitJob(guild.id, user.id);

                    const embed = new EmbedBuilder()
                        .setTitle('📤 Resigned')
                        .setColor('#FF4500')
                        .setDescription(`You have resigned from ${prevJob ? `${prevJob.emoji} **${prevJob.name}**` : 'your job'}.\nUse \`/job apply\` to start a new career.`)
                        .setTimestamp();

                    await i.update({ embeds: [embed], components: [] });
                } else {
                    await i.update({ content: '✅ Resignation cancelled. You remain employed.', embeds: [], components: [] });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    await interaction.editReply({ content: '⏰ Confirmation timed out. No changes made.', embeds: [], components: [] }).catch(() => null);
                }
            });

            return;
        }

        // ── /job profile ───────────────────────────────────────────────
        if (sub === 'profile') {
            const targetUser = options.getUser('user') || user;
            const profile = await db.getProfile(guild.id, targetUser.id);
            const job = profile.currentJob ? getJobByKey(profile.currentJob) : null;

            const embed = new EmbedBuilder()
                .setTitle(`💼 ${targetUser.username}'s Career`)
                .setColor(job ? TIER_COLORS[job.tier] : '#6B7280')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setTimestamp();

            if (job) {
                const appliedDate = profile.jobAppliedAt
                    ? `<t:${Math.floor(profile.jobAppliedAt / 1000)}:R>`
                    : 'Unknown';

                embed.setDescription(`Currently employed as **${job.name}**.`)
                    .addFields(
                        { name: 'Position',   value: `${job.emoji} ${job.name}`,                         inline: true },
                        { name: 'Tier',       value: `${TIER_LABELS[job.tier]} (Tier ${job.tier})`,       inline: true },
                        { name: 'Pay Range',  value: `🪙 ${job.minPay.toLocaleString()}–${job.maxPay.toLocaleString()}/shift`,              inline: true },
                        { name: 'XP Bonus',   value: job.xpBonus > 0 ? `+${job.xpBonus.toLocaleString()} XP/shift` : 'None', inline: true },
                        { name: 'Employed',   value: appliedDate,                                         inline: true },
                        { name: 'Wallet',     value: `🪙 ${profile.coins.toLocaleString()} coins`,       inline: true },
                    );
            } else {
                embed.setDescription(`**${targetUser.username}** is currently unemployed.\nUse \`/job apply\` to start earning better pay!`)
                    .addFields({ name: 'Status', value: '🚫 Unemployed — generic /work pay applies' });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
