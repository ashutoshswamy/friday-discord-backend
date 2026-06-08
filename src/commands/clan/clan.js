const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle,
 ComponentType, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

const pendingInvites = new Map(); // `${guildId}_${userId}` -> { clanId, clanName, inviterId, expiresAt }

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
  .setName('clan')
  .setDescription('Create, manage, and grow your clan.')
  .addSubcommand(sub =>
   sub.setName('create')
    .setDescription('Found a new clan (costs 5,000 coins).')
    .addStringOption(opt => opt.setName('name').setDescription('Clan name (2–20 chars)').setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('invite')
    .setDescription('Invite a member to your clan (owner only).')
    .addUserOption(opt => opt.setName('user').setDescription('Member to invite').setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('join')
    .setDescription('Join a clan you have been invited to.')
    .addStringOption(opt => opt.setName('name').setDescription('Clan name to join').setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('leave')
    .setDescription('Leave your current clan.'))
  .addSubcommand(sub =>
   sub.setName('kick')
    .setDescription('Kick a member from your clan (owner only).')
    .addUserOption(opt => opt.setName('user').setDescription('Member to kick').setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('info')
    .setDescription('View a clan\'s roster and stats.')
    .addStringOption(opt => opt.setName('name').setDescription('Clan name (leave blank for your own)').setRequired(false)))
  .addSubcommand(sub =>
   sub.setName('deposit')
    .setDescription('Contribute coins from your wallet to the clan treasury.')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to deposit').setMinValue(1).setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('rename')
    .setDescription('Rename your clan (costs 2,500 coins from clan treasury, owner only).')
    .addStringOption(opt => opt.setName('name').setDescription('New clan name (2–20 chars)').setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('disband')
    .setDescription('Disband your clan permanently (owner only).'))
  .addSubcommand(sub =>
   sub.setName('leaderboard')
    .setDescription('View the top clans on this server.')
    .addStringOption(opt =>
     opt.setName('sort')
      .setDescription('Sort by treasury or level (default: treasury)')
      .setRequired(false)
      .addChoices(
       { name: ' Treasury Coins', value: 'treasury' },
       { name: ' Clan Level', value: 'level' }
      ))),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const sub = options.getSubcommand();

  const reply = async (content) => interaction.reply({ content, ephemeral: true });
  const replyContainer = async (container) => interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  try {
   // ── CREATE ──
   if (sub === 'create') {
    const name = options.getString('name').trim();
    if (name.length < 2 || name.length > 20) return reply('Clan name must be 2–20 characters.');

    const result = await db.createClan(guild.id, user.id, name);
    if (!result.success) return reply(result.reason);

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0x00FF99)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Clan Founded!\n**${name}** has been created!\n\n${EMOJIS.coin} 5,000 coins deducted as founding fee.\nUse \`/clan invite\` to recruit members.`
     )));
   }

   // ── INVITE ──
   if (sub === 'invite') {
    const target = options.getUser('user');
    if (target.bot) return reply('Cannot invite bots.');
    if (target.id === user.id) return reply('Cannot invite yourself.');

    const myClan = await db.getClanByMember(guild.id, user.id);
    if (!myClan) return reply('You are not in a clan.');
    if (myClan.ownerId !== user.id) return reply('Only the clan owner can send invites.');

    const maxMembers = 5 + (myClan.level - 1) * 3;
    if (myClan.members.length >= maxMembers) {
     return reply(`Your clan has reached its maximum member cap of **${maxMembers}** members! Grinding and selling items helps level up your clan to expand capacity.`);
    }

    const targetClan = await db.getClanByMember(guild.id, target.id);
    if (targetClan) return reply(`<@${target.id}> is already in a clan.`);

    const inviteKey = `${guild.id}_${target.id}`;
    pendingInvites.set(inviteKey, {
     clanId: myClan.id, clanName: myClan.name,
     inviterId: user.id, expiresAt: Date.now() + 120000
    });

    const inviteContainer = new ContainerBuilder()
     .setAccentColor(0x8B5CF6)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Clan Invite\n<@${user.id}> is inviting <@${target.id}> to join **${myClan.name}**!\n\n<@${target.id}>, use \`/clan join name:${myClan.name}\` to accept within 2 minutes.`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
     )
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Invite expires in 2 minutes · Roster cap: ${myClan.members.length}/${maxMembers}`));

    return replyContainer(inviteContainer);
   }

   // ── JOIN ──
   if (sub === 'join') {
    const name = options.getString('name').trim();
    const inClan = await db.getClanByMember(guild.id, user.id);
    if (inClan) return reply('You are already in a clan. Leave first.');

    const inviteKey = `${guild.id}_${user.id}`;
    const invite = pendingInvites.get(inviteKey);

    if (!invite || invite.clanName.toLowerCase() !== name.toLowerCase() || Date.now() > invite.expiresAt) {
     pendingInvites.delete(inviteKey);
     return reply(`No valid invite found for **${name}**. Ask the clan owner to invite you first.`);
    }

    const targetClan = await db.getClan(guild.id, invite.clanName);
    if (targetClan) {
     const maxMembers = 5 + (targetClan.level - 1) * 3;
     if (targetClan.members.length >= maxMembers) {
      pendingInvites.delete(inviteKey);
      return reply(`The clan **${targetClan.name}** has already reached its maximum capacity of **${maxMembers}** members!`);
     }
    }

    pendingInvites.delete(inviteKey);
    const result = await db.joinClan(guild.id, user.id, invite.clanId);
    if (!result.success) return reply(result.reason);

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0x00FF99)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Joined Clan!\n<@${user.id}> has joined **${invite.clanName}**!`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     ));
   }

   // ── LEAVE ──
   if (sub === 'leave') {
    const myClan = await db.getClanByMember(guild.id, user.id);
    if (!myClan) return reply('You are not in a clan.');
    if (myClan.ownerId === user.id) return reply('Clan owners cannot leave. Transfer ownership or disband the clan.');

    await db.leaveClan(guild.id, user.id);
    return replyContainer(new ContainerBuilder()
     .setAccentColor(0xFF4444)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Left Clan\n<@${user.id}> has left **${myClan.name}**.`
     )));
   }

   // ── KICK ──
   if (sub === 'kick') {
    const target = options.getUser('user');
    const myClan = await db.getClanByMember(guild.id, user.id);
    if (!myClan) return reply('You are not in a clan.');
    if (myClan.ownerId !== user.id) return reply('Only the clan owner can kick members.');
    if (target.id === user.id) return reply('You cannot kick yourself.');

    const targetMembership = myClan.members.find(m => m.userId === target.id);
    if (!targetMembership) return reply(`<@${target.id}> is not in your clan.`);

    await db.kickFromClan(guild.id, myClan.id, target.id);
    return replyContainer(new ContainerBuilder()
     .setAccentColor(0xFF4444)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Member Kicked\n<@${target.id}> has been removed from **${myClan.name}**.`
     )));
   }

   // ── INFO ──
   if (sub === 'info') {
    const nameInput = options.getString('name');
    const clan = nameInput ? await db.getClan(guild.id, nameInput) : await db.getClanByMember(guild.id, user.id);
    if (!clan) return reply(nameInput ? `Clan **${nameInput}** not found.` : 'You are not in a clan.');

    const memberList = clan.members.slice(0, 10)
     .map(m => m.userId === clan.ownerId ? ` [Owner] <@${m.userId}>` : `• <@${m.userId}>`)
     .join('\n') || 'No members.';

    const maxMembers = 5 + (clan.level - 1) * 3;
    const xpNeeded = clan.level * 1000;
    const xpPercentage = Math.min(100, Math.floor((clan.xpTotal / xpNeeded) * 100));
    const filledBlocks = Math.round(xpPercentage / 10);
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0x8B5CF6)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ️ Clan: ${clan.name}\n` +
        `**Level:** **${clan.level}** · **Grind Bonus:** **+${clan.level * 2}%** coins on \`/sell\`\n\n` +
        `**XP:** \`[${progressBar}]\` **${clan.xpTotal}** / **${xpNeeded}** XP (${xpPercentage}%)\n` +
        `**Owner:** <@${clan.ownerId}>\n` +
        `**Members:** **${clan.members.length}** / **${maxMembers}**\n` +
        `**Treasury:** ${EMOJIS.coin} **${clan.treasury.toLocaleString()}** coins`
       ))
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**Roster:**\n${memberList}${clan.members.length > 10 ? `\n*+${clan.members.length - 10} more members*` : ''}`
     )));
   }

   // ── DEPOSIT ──
   if (sub === 'deposit') {
    const amount = options.getInteger('amount');
    const myClan = await db.getClanByMember(guild.id, user.id);
    if (!myClan) return reply('You are not in a clan.');

    const result = await db.depositToClan(guild.id, myClan.id, user.id, amount);
    if (!result.success) return reply(result.reason);

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0x00FF99)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Deposited!\n<@${user.id}> contributed ${EMOJIS.coin} **${amount.toLocaleString()}** to **${myClan.name}**!\n\n**New Treasury:** ${EMOJIS.coin} ${result.newTreasury.toLocaleString()}`
     )));
   }

   // ── RENAME ──
   if (sub === 'rename') {
    const newName = options.getString('name').trim();
    if (newName.length < 2 || newName.length > 20) return reply('Clan name must be 2–20 characters.');

    const myClan = await db.getClanByMember(guild.id, user.id);
    if (!myClan) return reply('You are not in a clan.');
    if (myClan.ownerId !== user.id) return reply('Only the clan owner can rename the clan.');

    const result = await db.renameClan(guild.id, myClan.id, newName);
    if (!result.success) return reply(result.reason);

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0x00E5FF)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Clan Renamed!\nYour clan has been successfully renamed to **${newName}**!\n\n${EMOJIS.coin} 2,500 coins deducted from the clan treasury.`
     )));
   }

   // ── DISBAND ──
   if (sub === 'disband') {
    const myClan = await db.getClanByMember(guild.id, user.id);
    if (!myClan) return reply('You are not in a clan.');
    if (myClan.ownerId !== user.id) return reply('Only the clan owner can disband the clan.');

    const deleted = await db.disbandClan(guild.id, myClan.id);
    if (!deleted) return reply('Failed to disband clan. Try again.');

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0xFF3333)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `##  Clan Disbanded\n**${myClan.name}** has been permanently disbanded. All members have been released.`
     )));
   }

   // ── LEADERBOARD ──
   if (sub === 'leaderboard') {
    const sortBy = options.getString('sort') || 'treasury';
    const top = await db.getClanLeaderboard(guild.id, sortBy);
    if (!top.length) return reply('No clans have been founded on this server yet.');

    const lines = top.map(c =>
     sortBy === 'level'
      ? `**#${c.rank}** **${c.name}** — Lv.**${c.level}** (${c.xpTotal.toLocaleString()} XP) · ${EMOJIS.coin} ${c.treasury.toLocaleString()} treasury`
      : `**#${c.rank}** **${c.name}** — ${EMOJIS.coin} ${c.treasury.toLocaleString()} treasury · Lv.**${c.level}**`
    ).join('\n');

    const rankByText = sortBy === 'level' ? 'Ranked by clan level and XP' : 'Ranked by treasury wealth';

    return replyContainer(new ContainerBuilder()
     .setAccentColor(0xFFD700)
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `## Clan Leaderboard\n${lines}`
     ))
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${rankByText}`)));
   }

  } catch (err) {
   console.error('[CLAN ERROR]', err);
   const errMsg = { content: 'Failed to process clan command.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.reply(errMsg).catch(() => null);
  }
 }
};
