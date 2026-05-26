const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { JOBS, TIER_LABELS, TIER_COLORS, getJobByKey } = require('../../utils/jobs');

const JOB_CHOICES = Object.values(JOBS).map(j => ({ name: `${j.emoji} ${j.name} (Tier ${j.tier})`, value: j.key }));

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
            const embed = new EmbedBuilder()
                .setTitle('💼 Job Board')
                .setColor('#8B5CF6')
                .setDescription('Apply with `/job apply`. Higher tiers require higher levels and pay more per `/work` shift.')
                .setTimestamp();

            for (let tier = 1; tier <= 4; tier++) {
                const jobs = Object.values(JOBS).filter(j => j.tier === tier);
                const lines = jobs.map(j =>
                    `${j.emoji} **${j.name}** — 🪙 ${j.minPay}–${j.maxPay}/shift${j.xpBonus > 0 ? ` · +${j.xpBonus} XP` : ''}\n` +
                    `↳ *${j.description}*`
                ).join('\n');

                embed.addFields({
                    name: `${TIER_LABELS[tier]} (Tier ${tier}) — Level ${tier === 1 ? '1' : Object.values(JOBS).find(j => j.tier === tier).levelRequired}+`,
                    value: lines,
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /job apply ─────────────────────────────────────────────────
        if (sub === 'apply') {
            const jobKey = options.getString('job');
            const job    = getJobByKey(jobKey);

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
                    { name: 'Position',  value: `${job.emoji} ${job.name}`,                     inline: true },
                    { name: 'Tier',      value: `${TIER_LABELS[job.tier]} (Tier ${job.tier})`,   inline: true },
                    { name: 'Pay Range', value: `🪙 ${job.minPay}–${job.maxPay} per /work shift`, inline: true },
                    { name: 'XP Bonus',  value: job.xpBonus > 0 ? `+${job.xpBonus} XP per shift` : 'None', inline: true },
                    { name: 'Role',      value: `Level ${job.levelRequired}+ required`,           inline: true },
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
            await db.quitJob(guild.id, user.id);

            const embed = new EmbedBuilder()
                .setTitle('📤 Resigned')
                .setColor('#FF4500')
                .setDescription(`You have resigned from your position as ${prevJob ? `${prevJob.emoji} **${prevJob.name}**` : 'your job'}.\nUse \`/job apply\` to start a new career.`)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /job profile ───────────────────────────────────────────────
        if (sub === 'profile') {
            const targetUser = options.getUser('user') || user;
            const profile    = await db.getProfile(guild.id, targetUser.id);
            const job        = profile.currentJob ? getJobByKey(profile.currentJob) : null;

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
                        { name: 'Position',   value: `${job.emoji} ${job.name}`,                       inline: true },
                        { name: 'Tier',       value: `${TIER_LABELS[job.tier]} (Tier ${job.tier})`,     inline: true },
                        { name: 'Pay Range',  value: `🪙 ${job.minPay}–${job.maxPay}/shift`,            inline: true },
                        { name: 'XP Bonus',   value: job.xpBonus > 0 ? `+${job.xpBonus} XP/shift` : 'None', inline: true },
                        { name: 'Employed',   value: appliedDate,                                       inline: true },
                        { name: 'Wallet',     value: `🪙 ${profile.coins.toLocaleString()} coins`,     inline: true },
                    );
            } else {
                embed.setDescription(`**${targetUser.username}** is currently unemployed.\nUse \`/job apply\` to start earning better pay!`)
                    .addFields({ name: 'Status', value: '🚫 Unemployed — generic /work pay applies' });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
