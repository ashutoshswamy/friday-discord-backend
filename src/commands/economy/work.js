const {
  SlashCommandBuilder,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getJobByKey, TIER_COLORS, calcPay } = require('../../utils/jobs');
const { EMOJIS } = require('../../utils/emojis');

const GENERIC_TASKS = [
  'You worked a freelance shift and picked up an odd job around town.',
  'You helped a neighbour move furniture and pocketed some cash.',
  'You drove for a rideshare app and completed several trips.',
  'You worked a temp shift at a warehouse stacking shelves.',
  'You mowed lawns in the neighbourhood for a few hours.',
];

const JOB_TASKS = {
  cashier: ['You scanned items all day and your register balanced to the cent.', 'A Black Friday rush hit — you kept the queue moving like a pro.', 'You caught a pricing error and saved the store a hefty refund.'],
  performer: ['You played an epic set on the corner and tips piled up fast.', 'A small crowd gathered — one person dropped a 500-coin note.', 'Rough night — barely anyone stopped, but the coins still added up.'],
  delivery: ['You completed 14 runs without a single late delivery.', 'Rush hour was brutal but you hit every drop-off on time.', 'A long-haul route paid out nicely — 80 km of open road.'],
  janitor: ['Three floors mopped, two bathrooms scrubbed, and overtime approved.', 'You cleared a spillage before anyone slipped — management noticed.', 'Late-night deep-clean shift complete. The building gleams.'],
  barista: ['The morning rush was relentless — your latte art was flawless throughout.', 'A loyal regular tipped you generously for remembering their order.', 'You covered two sick colleagues and crushed it solo.'],
  farmhand: ['You harvested two full rows before noon — the foreman was impressed.', 'Long day under the sun, but the crop yield was record-breaking.', 'You repaired a broken irrigation line and saved half the field.'],
  chef: ['You crafted a tasting menu that had the restaurant fully booked.', 'Service was slammed but your station held solid all night.', 'The head chef praised your sauce technique in front of the whole kitchen.'],
  mechanic: ['You diagnosed and fixed three vehicles in one afternoon.', 'A tricky transmission rebuild took skill — you nailed every torque spec.', 'Emergency call-out at midnight — engine replaced, customer ecstatic.'],
  guard: ['A quiet patrol shift — nothing slipped past you.', 'You diffused a tense situation and kept the venue safe.', 'You spotted a suspicious bag early and averted a major incident.'],
  plumber: ['You cleared a burst pipe in record time — no water damage.', 'A major commercial fit-out: 40 metres of copper piping laid perfectly.', 'Emergency call — flooded basement pumped dry before dawn.'],
  electrician:['You rewired an entire office floor ahead of schedule.', 'A fault diagnosis that stumped the whole crew — you cracked it in minutes.', 'You installed a new distribution board cleanly and passed the safety audit first time.'],
  nurse: ['A full ward round, three IV lines, and two critical patients stabilised.', 'You stayed two hours late to cover a colleague — the team appreciated it.', 'Your calm under pressure during a code blue made all the difference.'],
  engineer: ['You shipped a feature, squashed two critical bugs, and passed code review.', 'Sprint planning, a deploy, and a hotfix all before lunch.', 'Your refactor cut API response time by 40% — the team is stoked.'],
  doctor: ['A complex procedure went flawlessly — the patient is recovering well.', 'You treated a full ward and stayed two hours past your shift.', 'Your differential diagnosis caught a rare condition the junior staff missed.'],
  lawyer: ['You won a motion hearing and your client signed off on the settlement.', 'Contract negotiation ran deep into the night — outcome: fully favourable.', "You dismantled the opposing counsel's argument in under ten minutes."],
  architect: ['Your concept drawings for the new civic centre wowed the planning committee.', 'Site inspection complete — every beam and wall aligns to the millimetre.', 'The client approved your revised facade design on the spot.'],
  pharmacist: ['You counselled 30 patients and caught a dangerous drug interaction.', 'Stock audit complete — zero discrepancies, full compliance sign-off.', 'You handled a prescription emergency with textbook precision.'],
  analyst: ['Your market model predicted the dip — the fund avoided a major loss.', 'A 60-slide deck delivered in two hours — client loved every slide.', 'Your valuation report became the basis for a nine-figure acquisition.'],
  ceo: ['Q3 earnings smashed projections. The board gave a standing ovation.', 'You closed a landmark acquisition deal over a single lunch meeting.', 'Your strategic pivot just unlocked a new market worth billions.'],
  banker: ['A leveraged buyout closed at midnight — massive payday for the team.', 'Your fund outperformed the index by 18 points this quarter.', 'You structured a $2B bond issuance in 48 hours — flawlessly executed.'],
  gamedev: ['You shipped the update — the community response is overwhelmingly positive.', 'Three sprints crushed: new level, new boss, new soundtrack.', 'Your game hit the top-10 chart within 24 hours of the patch dropping.'],
  surgeon: ['A twelve-hour spinal reconstruction — perfect outcome, zero complications.', 'You performed a last-minute bypass that saved a life tonight.', 'The medical board cited your technique as best-in-class.'],
  aerospace: ['Your propulsion design passed final testing — launch window confirmed.', 'Wind-tunnel simulations validated — the airframe is ready for production.', 'You solved a critical guidance software bug 48 hours before launch day.'],
  hedgefund: ['Your short position on the sector paid out 8× margin overnight.', 'A bold contrarian bet came good — the portfolio is up 22% this week.', 'Volatile session: you rode the wave and locked in a monster gain at the bell.'],
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work your shift and earn coins (1-hour cooldown). Pay scales with your job tier.'),

  async execute(interaction) {
    const { guild, user } = interaction;
    if (!guild) return;

    try {
      const result = await db.claimWork(guild.id, user.id);

      if (!result.success) {
        const nextClaimTimeUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
        return interaction.editReply({
          content: `You are still on shift cooldown! You can work again **<t:${nextClaimTimeUnix}:R>** (at <t:${nextClaimTimeUnix}:T>).`,
          ephemeral: true,
        });
      }

      const profile = await db.getProfile(guild.id, user.id);
      const job = profile.currentJob ? getJobByKey(profile.currentJob) : null;

      let reward = result.reward;
      let xpBonus = 0;
      let taskText = GENERIC_TASKS[Math.floor(Math.random() * GENERIC_TASKS.length)];
      let accentColor = 0x00FF66;

      if (job) {
        reward = calcPay(job);
        xpBonus = job.xpBonus;
        taskText = (JOB_TASKS[job.key] || GENERIC_TASKS)[Math.floor(Math.random() * (JOB_TASKS[job.key] || GENERIC_TASKS).length)];
        const tierHex = TIER_COLORS[job.tier];
        accentColor = parseInt((tierHex || '#00FF66').replace('#', ''), 16);

        const delta = reward - result.reward;
        if (delta !== 0) await db.updateCoins(guild.id, user.id, delta);
        if (xpBonus > 0) await db.addXp(guild.id, user.id, xpBonus);
      }

      const finalBalance = await db.getProfile(guild.id, user.id);

      const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## Shift Completed\n${taskText}`)
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Position:** ${job ? `${job.emoji} ${job.name}` : ' Unemployed'}\n` +
            `**Salary:** ${EMOJIS.coin} **+${reward.toLocaleString()}** coins\n` +
            `**XP Bonus:** ${xpBonus > 0 ? `+${xpBonus.toLocaleString()} XP` : 'None'}\n` +
            `**Wallet:** ${EMOJIS.coin} **${finalBalance.coins.toLocaleString()}** coins`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            job
              ? `-# Tier ${job.tier} job · Use /job list to explore careers`
              : '-# Use /job apply to unlock higher pay'
          )
        );

      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
    } catch (err) {
      console.error('[ERROR] Work command failed:', err);
      const errMsg = { content: 'Failed to process your work shift.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
      else await interaction.editReply(errMsg).catch(() => null);
    }
  },
};
