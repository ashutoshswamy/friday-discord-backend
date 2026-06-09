const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');

function parseTime(timeStr) {
 const regex = /^(\d+)([smhd])$/;
 const match = timeStr.match(regex);
 if (!match) return null;
 const value = parseInt(match[1]);
 const unit = match[2];
 if (unit === 's') return value * 1000;
 if (unit === 'm') return value * 60 * 1000;
 if (unit === 'h') return value * 60 * 60 * 1000;
 if (unit === 'd') return value * 24 * 60 * 60 * 1000;
 return null;
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('remind')
 .setDescription('Schedules a deferred background timer notification.')
 .addStringOption(opt =>
 opt.setName('time')
 .setDescription('When to remind you (e.g. 10s, 5m, 2h, 1d)')
 .setRequired(true))
 .addStringOption(opt =>
 opt.setName('message')
 .setDescription('The reminder note to notify you with')
 .setRequired(true)),

 async execute(interaction) {
 const { user, options } = interaction;
 const timeInput = options.getString('time').trim().toLowerCase();
 const message = options.getString('message');

 try {
 const durationMs = parseTime(timeInput);
 if (!durationMs || durationMs < 5000) {
 return interaction.editReply({
 content: 'Invalid time formatting! Use structures like: `10s`, `5m`, `2h`, or `1d`. Minimum reminder is 5s.',
 ephemeral: true
 });
 }

 if (durationMs > 14 * 24 * 60 * 60 * 1000) {
 return interaction.editReply({ content: 'Reminders cannot exceed 14 days!', ephemeral: true });
 }

 const alertTimeUnix = Math.floor((Date.now() + durationMs) / 1000);

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Reminder Scheduled\nI will DM you a reminder **<t:${alertTimeUnix}:R>** (at <t:${alertTimeUnix}:F>).`
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Reminder Note:** *"${message}"*`)
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 setTimeout(async () => {
 const dmContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## REMINDER NOTIFICATION!\nYou scheduled a reminder for now!`
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Your Note:** *"${message}"*\n` +
 `**Originally set:** <t:${Math.floor((Date.now() - durationMs) / 1000)}:f>`
 )
 );

 await user.send({ flags: MessageFlags.IsComponentsV2, components: [dmContainer] }).catch(() => {
 console.log(`[REMINDER WARNING] Could not DM user ${user.id} (DMs closed).`);
 });
 }, durationMs);

 } catch (err) {
 console.error('[REMINDER ERROR]', err);
 const errMsg = { content: 'Failed to register reminder task.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
