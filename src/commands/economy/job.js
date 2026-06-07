const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');
const { JOBS, TIER_LABELS, TIER_COLORS, getJobByKey } = require('../../utils/jobs');

const JOB_CHOICES = Object.values(JOBS).map(j => ({ name: `${j.emoji} ${j.name} (Tier ${j.tier})`, value: j.key }));
const TIER_EMOJIS = { 1: '', 2: '', 3: '', 4: '' };

function buildTierContainer(tier) {
 const jobs = Object.values(JOBS).filter(j => j.tier === tier);
 const tierFirstJob = jobs[0];
 const accentColor = parseInt(TIER_COLORS[tier].replace('#', ''), 16);

 const jobsText = jobs.map(j =>
 `**${j.emoji} ${j.name}**\n*${j.description}*\n${EMOJIS.coin} **${j.minPay.toLocaleString()}–${j.maxPay.toLocaleString()}**/shift${j.xpBonus > 0 ? ` · **+${j.xpBonus.toLocaleString()} XP**` : ''}`
 ).join('\n\n');

 return new ContainerBuilder()
 .setAccentColor(accentColor)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Job Board — ${TIER_EMOJIS[tier]} ${TIER_LABELS[tier]} (Tier ${tier})\n` +
 `**Level Required:** ${tierFirstJob.levelRequired}+\n` +
 `Apply with \`/job apply\`. Higher tiers pay more per \`/work\` shift.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(jobsText));
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

 if (sub === 'list') {
 let currentTier = 1;

 const tierSelect = new StringSelectMenuBuilder()
 .setCustomId('job_tier_select')
 .setPlaceholder('Filter by Tier...')
 .addOptions(
 { label: `${TIER_EMOJIS[1]} Tier 1 — ${TIER_LABELS[1]} (Level 1+)`, value: '1', default: true },
 { label: `${TIER_EMOJIS[2]} Tier 2 — ${TIER_LABELS[2]} (Level 5+)`, value: '2' },
 { label: `${TIER_EMOJIS[3]} Tier 3 — ${TIER_LABELS[3]} (Level 10+)`, value: '3' },
 { label: `${TIER_EMOJIS[4]} Tier 4 — ${TIER_LABELS[4]} (Level 20+)`, value: '4' }
 );

 const container = buildTierContainer(currentTier);
 container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 container.addActionRowComponents(new ActionRowBuilder().addComponents(tierSelect));

 const response = await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
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
 .setPlaceholder('Filter by Tier...')
 .addOptions(
 { label: `${TIER_EMOJIS[1]} Tier 1 — ${TIER_LABELS[1]} (Level 1+)`, value: '1', default: currentTier === 1 },
 { label: `${TIER_EMOJIS[2]} Tier 2 — ${TIER_LABELS[2]} (Level 5+)`, value: '2', default: currentTier === 2 },
 { label: `${TIER_EMOJIS[3]} Tier 3 — ${TIER_LABELS[3]} (Level 10+)`, value: '3', default: currentTier === 3 },
 { label: `${TIER_EMOJIS[4]} Tier 4 — ${TIER_LABELS[4]} (Level 20+)`, value: '4', default: currentTier === 4 }
 );

 const updatedContainer = buildTierContainer(currentTier);
 updatedContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 updatedContainer.addActionRowComponents(new ActionRowBuilder().addComponents(updatedSelect));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [updatedContainer] });
 });

 collector.on('end', async () => {
 const disabledSelect = new StringSelectMenuBuilder()
 .setCustomId('job_tier_select')
 .setPlaceholder('Filter by Tier...')
 .setDisabled(true)
 .addOptions({ label: 'Expired', value: 'expired' });

 const expiredContainer = buildTierContainer(currentTier);
 expiredContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 expiredContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledSelect));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
 });

 return;
 }

 if (sub === 'apply') {
 const jobKey = options.getString('job');
 const job = getJobByKey(jobKey);

 if (!job) return interaction.editReply({ content: 'Unknown job.', ephemeral: true });

 const profile = await db.getProfile(guild.id, user.id);

 if (profile.level < job.levelRequired) {
 return interaction.editReply({
 content: `You need to be **Level ${job.levelRequired}** to become a ${job.emoji} **${job.name}**. You are currently Level **${profile.level}**.`,
 ephemeral: true,
 });
 }

 if (profile.currentJob === jobKey) {
 return interaction.editReply({ content: `ℹ You already work as a ${job.emoji} **${job.name}**.`, ephemeral: true });
 }

 const result = await db.applyJob(guild.id, user.id, jobKey);
 if (!result.success) {
 const nextSwitchUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
 return interaction.editReply({
 content: `You recently switched jobs. You can switch again <t:${nextSwitchUnix}:R>.`,
 ephemeral: true,
 });
 }

 const accentColor = parseInt(TIER_COLORS[job.tier].replace('#', ''), 16);

 const container = new ContainerBuilder()
 .setAccentColor(accentColor)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${job.emoji} Job Offer Accepted!\nWelcome aboard, **${user.username}**! You are now employed as a **${job.name}**.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Position:** ${job.emoji} ${job.name}\n` +
 `**Tier:** ${TIER_LABELS[job.tier]} (Tier ${job.tier})\n` +
 `**Pay Range:** ${EMOJIS.coin} ${job.minPay.toLocaleString()}–${job.maxPay.toLocaleString()} per /work shift\n` +
 `**XP Bonus:** ${job.xpBonus > 0 ? `+${job.xpBonus.toLocaleString()} XP per shift` : 'None'}\n` +
 `**Required Level:**Level ${job.levelRequired}+`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Use /work to earn coins. Job switch cooldown: 1 hour.`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (sub === 'quit') {
 const profile = await db.getProfile(guild.id, user.id);

 if (!profile.currentJob) {
 return interaction.editReply({ content: `ℹ You don't have a job to quit.`, ephemeral: true });
 }

 const prevJob = getJobByKey(profile.currentJob);

 const confirmBtn = new ButtonBuilder()
 .setCustomId('job_quit_confirm')
 .setLabel('Resign')
 .setStyle(ButtonStyle.Danger);

 const cancelBtn = new ButtonBuilder()
 .setCustomId('job_quit_cancel')
 .setLabel('Keep Job')
 .setStyle(ButtonStyle.Secondary);

 const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

 const confirmContainer = new ContainerBuilder()
 .setAccentColor(0xFF4500)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Confirm Resignation\nAre you sure you want to resign from ${prevJob ? `${prevJob.emoji} **${prevJob.name}**` : 'your current job'}?\n\n` +
 `You will revert to generic \`/work\` pay until you re-apply for a new position.`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(row);

 const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 30000,
 max: 1
 });

 collector.on('collect', async i => {
 if (i.customId === 'job_quit_confirm') {
 await db.quitJob(guild.id, user.id);

 const resignedContainer = new ContainerBuilder()
 .setAccentColor(0xFF4500)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Resigned\nYou have resigned from ${prevJob ? `${prevJob.emoji} **${prevJob.name}**` : 'your job'}.\nUse \`/job apply\` to start a new career.`
 )
 );

 await i.update({ flags: MessageFlags.IsComponentsV2, components: [resignedContainer] });
 } else {
 await i.update({ content: 'Resignation cancelled. You remain employed.', flags: MessageFlags.IsComponentsV2, components: [] });
 }
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time' && collected.size === 0) {
 await interaction.editReply({ content: 'Confirmation timed out. No changes made.', flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);
 }
 });

 return;
 }

 if (sub === 'profile') {
 const targetUser = options.getUser('user') || user;
 const profile = await db.getProfile(guild.id, targetUser.id);
 const job = profile.currentJob ? getJobByKey(profile.currentJob) : null;

 const accentColor = job ? parseInt(TIER_COLORS[job.tier].replace('#', ''), 16) : 0x6B7280;

 let profileText;
 if (job) {
 const appliedDate = profile.jobAppliedAt
 ? `<t:${Math.floor(profile.jobAppliedAt / 1000)}:R>`
 : 'Unknown';

 profileText =
 `**Position:** ${job.emoji} ${job.name}\n` +
 `**Tier:** ${TIER_LABELS[job.tier]} (Tier ${job.tier})\n` +
 `**Pay Range:** ${EMOJIS.coin} ${job.minPay.toLocaleString()}–${job.maxPay.toLocaleString()}/shift\n` +
 `**XP Bonus:** ${job.xpBonus > 0 ? `+${job.xpBonus.toLocaleString()} XP/shift` : 'None'}\n` +
 `**Employed:** ${appliedDate}\n` +
 `**Wallet:** ${EMOJIS.coin} ${profile.coins.toLocaleString()} coins`;
 } else {
 profileText = `**Status:**Unemployed — generic /work pay applies\nUse \`/job apply\` to start earning better pay!`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(accentColor)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${targetUser.username}'s Career\n${job ? `Currently employed as **${job.name}**.` : `**${targetUser.username}** is currently unemployed.`}`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(profileText));

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
 },
};
