const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder,
 ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('userinfo')
 .setDescription('Displays comprehensive profile details about a server member.')
 .addUserOption(opt =>
 opt.setName('user')
 .setDescription('The member you want to inspect (defaults to you)')
 .setRequired(false)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const targetUser = options.getUser('user') || user;

 try {
 const member = await guild.members.fetch(targetUser.id).catch(() => null);
 if (!member) {
 return interaction.editReply({ content: 'Could not find the specified user in this server.', ephemeral: true });
 }

 const profile = await db.getProfile(guild.id, targetUser.id);
 const warnings = await db.getWarnings(guild.id, targetUser.id);

 const createdUnix = Math.floor(targetUser.createdTimestamp / 1000);
 const joinedUnix = Math.floor(member.joinedTimestamp / 1000);

 const rolesList = member.roles.cache
 .filter(r => r.name !== '@everyone')
 .map(r => `${r}`)
 .join(' ') || '`None`';

 const roleColor = member.roles.highest.hexColor === '#000000' ? '#8b5cf6' : member.roles.highest.hexColor;
 const accentInt = parseInt(roleColor.replace('#', ''), 16);

 const container = new ContainerBuilder()
 .setAccentColor(accentInt)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## ${targetUser.username}\n` +
 `**Tag:** ${targetUser}\n` +
 `**ID:** \`${targetUser.id}\`\n` +
 `**Nickname:** ${member.nickname ? `\`${member.nickname}\`` : '`None`'}`
 )
 )
 .setThumbnailAccessory(
 new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true }))
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**<:coin:1512926963239489606> Coins:** **${profile ? profile.coins.toLocaleString() : '100'}**\n` +
 `**⭐ Level:** **${profile ? profile.level : '1'}** (XP: \`${profile ? profile.xp.toLocaleString() : '0'}\`)\n` +
 `**Warnings:** **${warnings.length}**`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Account Created:** <t:${createdUnix}:f> (<t:${createdUnix}:R>)\n` +
 `**Joined Server:** <t:${joinedUnix}:f> (<t:${joinedUnix}:R>)`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Roles:** ${rolesList}`)
 );

 await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container]
 });
 } catch (err) {
 console.error('[USERINFO ERROR]', err);
 const errMsg = { content: 'Failed to load user profile.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
