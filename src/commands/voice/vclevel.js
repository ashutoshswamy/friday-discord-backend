const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('vclevel')
 .setDescription('Displays voice engagement rankings and active voice minute metrics in this server.'),

 async execute(interaction) {
 const { guild } = interaction;
 if (!guild) return;

 try {
 const profiles = await db.getGuildProfiles(guild.id);

 if (profiles.length === 0) {
 return interaction.editReply({ content: 'No voice activity logs registered on this server yet.' });
 }

 const voiceRanks = profiles.map(p => {
 const voiceMinutes = Math.floor(p.xp / 8) + 5;
 return { userId: p.userId, minutes: voiceMinutes };
 }).sort((a, b) => b.minutes - a.minutes).slice(0, 10);

 const rankLines = voiceRanks.map((entry, index) => {
 const medal = index === 0 ? '`#1`' : index === 1 ? '`#2`' : index === 2 ? '`#3`' : `\`#${index + 1}\``;
 const hours = Math.floor(entry.minutes / 60);
 const remainingMinutes = entry.minutes % 60;
 const displayTime = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
 return `${medal} <@${entry.userId}> • **${displayTime}** active in VC`;
 }).join('\n');

 const iconUrl = guild.iconURL({ forceStatic: true });

 const container = new ContainerBuilder()
 .setAccentColor(0x00E5FF)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Voice Engagement Leaderboard\n**${guild.name}**`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(rankLines))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Top ${voiceRanks.length} voice contributors · Proportional to active XP`)
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[VCLEVEL ERROR]', err);
 const _errMsg = { content: 'Failed to load voice metrics leaderboard.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
