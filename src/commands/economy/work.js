const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { getJobByKey, TIER_COLORS, calcPay } = require('../../utils/jobs');

const GENERIC_TASKS = [
    'You worked a freelance shift and picked up an odd job around town.',
    'You helped a neighbour move furniture and pocketed some cash.',
    'You drove for a rideshare app and completed several trips.',
    'You worked a temp shift at a warehouse stacking shelves.',
    'You mowed lawns in the neighbourhood for a few hours.',
];

const JOB_TASKS = {
    cashier:   ['You scanned items and handled the checkout rush.', 'A busy Saturday shift flew by and your register balanced perfectly.'],
    performer: ['You played an epic set on the street corner and the crowd loved it.', 'Tips were flying — your busking skills paid off tonight.'],
    delivery:  ['You completed 12 delivery runs without a single mishap.', 'Rush hour was brutal but you hit every drop-off on time.'],
    chef:      ['You crafted a tasting menu that had the restaurant fully booked.', 'Service was slammed but your station held solid all night.'],
    mechanic:  ['You diagnosed and repaired three vehicles in a single afternoon.', 'A tricky transmission job took skill — you nailed it.'],
    guard:     ['A quiet patrol shift — nothing slipped past you tonight.', 'You diffused a tense situation and kept the venue secure.'],
    engineer:  ['You shipped a feature, squashed two critical bugs, and passed code review.', 'Sprint planning, a deploy, and a hotfix all before lunch.'],
    doctor:    ['A complex procedure went flawlessly — the patient is recovering well.', 'You treated a full ward and stayed two hours past your shift.'],
    lawyer:    ['You won a motion hearing and your client signed off on the settlement.', 'Contract negotiation went deep into the night — outcome: favourable.'],
    ceo:       ['Q3 earnings smashed projections. The board is delighted.', 'You closed a landmark acquisition deal and celebrated with the team.'],
    banker:    ['A leveraged buyout closed at midnight — massive payday.', 'Your fund outperformed the index by 12 points this quarter.'],
    gamedev:   ['You shipped the new update — the community response is overwhelmingly positive.', 'Three sprints crushed: new level, new boss, new soundtrack track.'],
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work your shift and earn coins (5-minute cooldown). Pay scales with your job tier.'),

    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        try {
            const result = await db.claimWork(guild.id, user.id);

            if (!result.success) {
                const nextClaimTimeUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
                return interaction.editReply({
                    content: `⏳ You are too exhausted to work! You can work again **<t:${nextClaimTimeUnix}:R>** (at <t:${nextClaimTimeUnix}:T>).`,
                    ephemeral: true,
                });
            }

            // Fetch profile to check current job
            const profile = await db.getProfile(guild.id, user.id);
            const job     = profile.currentJob ? getJobByKey(profile.currentJob) : null;

            let reward    = result.reward; // default 50–150 from claimWork
            let xpBonus   = 0;
            let taskText  = GENERIC_TASKS[Math.floor(Math.random() * GENERIC_TASKS.length)];
            let embedColor = '#00FF66';

            if (job) {
                // Override reward with job-tier pay
                reward     = calcPay(job);
                xpBonus    = job.xpBonus;
                taskText   = (JOB_TASKS[job.key] || GENERIC_TASKS)[Math.floor(Math.random() * (JOB_TASKS[job.key] || GENERIC_TASKS).length)];
                embedColor = TIER_COLORS[job.tier];

                // Apply reward delta to db (claimWork already deducted 0 net — we override)
                // claimWork adds result.reward; we need to add the difference
                const delta = reward - result.reward;
                if (delta !== 0) await db.updateCoins(guild.id, user.id, delta);

                // Award XP bonus
                if (xpBonus > 0) await db.addXp(guild.id, user.id, xpBonus);
            }

            const finalBalance = await db.getProfile(guild.id, user.id);

            const embed = new EmbedBuilder()
                .setTitle('💼 Shift Completed')
                .setColor(embedColor)
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(taskText)
                .addFields(
                    { name: 'Position',    value: job ? `${job.emoji} ${job.name}` : '🧑 Unemployed',           inline: true },
                    { name: 'Salary',      value: `🪙 **+${reward.toLocaleString()}** coins`,                    inline: true },
                    { name: 'XP Bonus',    value: xpBonus > 0 ? `+${xpBonus} XP` : 'None',                      inline: true },
                    { name: 'Wallet',      value: `🪙 **${finalBalance.coins.toLocaleString()}** coins`,         inline: true },
                )
                .setFooter({ text: job ? `Tier ${job.tier} job · Use /job list to explore careers` : 'Use /job apply to unlock higher pay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Work command failed:', err);
            const _errMsg = { content: '❌ Failed to process your work shift.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(_errMsg).catch(() => null);
            else await interaction.editReply(_errMsg).catch(() => null);
        }
    },
};
