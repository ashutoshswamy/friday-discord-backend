const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

const SELLABLE_ITEMS = {
 'junk seaweed': 20, 'old boot': 50,
 'clam': 100, 'common bass': 150,
 'pufferfish': 350, 'salmon': 300,
 'goldfish': 500, 'lobster': 900,
 'tropical coral fish': 800,
 'shark tooth': 2000,
 'ancient pearl': 6000,
 'mythical whale': 5000,
 'rabbit': 180, 'eagle feather': 400,
 'duck': 250, 'deer': 500,
 'deer antler': 600, 'wild boar': 800,
 'wolf pelt': 1200,
 'grizzly bear': 2500,
 'dragon scale': 8000,
 'common worm': 15, 'old coin': 300,
 'cracked geode': 150, 'dirt fossil': 200,
 'ancient vase': 800,
 'sapphire': 2500, 'ruby': 4000,
 'diamond': 9000,
 'buried gold chest': 3000,
 'silver ring': 1000,
 'common gem': 750,
 'rare gem': 3500,
 'legendary gem': 12000,
 'lootbox': 300
};

module.exports = {
 data: new SlashCommandBuilder()
  .setName('analytics')
  .setDescription('Server economy and activity analytics (Admin only).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
   sub.setName('overview')
    .setDescription('High-level server economy and XP statistics.'))
  .addSubcommand(sub =>
   sub.setName('topspenders')
    .setDescription('Top 10 wealthiest members by total wallet + bank balance.'))
  .addSubcommand(sub =>
   sub.setName('activity')
    .setDescription('View a specific member\'s economy activity summary.')
    .addUserOption(opt => opt.setName('user').setDescription('The member to inspect').setRequired(true))),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const sub = options.getSubcommand();

  try {
   if (sub === 'overview') {
    const data = await db.getServerAnalytics(guild.id);
    if (!data) {
     return interaction.editReply({ content: 'Analytics data unavailable — database not connected.', ephemeral: true });
    }

    const topLines = data.topRich.length
     ? data.topRich.map((u, i) => `**#${i + 1}** <@${u.userId}> — ${EMOJIS.coin} ${u.wealth.toLocaleString()}`).join('\n')
     : 'No data yet.';

    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Server Analytics Overview\n**${guild.name}**`)
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || user.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `**Members with Profiles:** ${data.totalMembers.toLocaleString()}\n` +
       `**Total Coins in Circulation:** ${EMOJIS.coin} ${data.totalCoins.toLocaleString()}\n` +
       `**Total XP Distributed:** ${data.totalXp.toLocaleString()}\n` +
       `**Average Member Level:** ${data.avgLevel}`
      )
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Top 5 Wealthiest:**\n${topLines}`)
     )
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Admin only • Data sourced from Supabase profiles table')
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (sub === 'topspenders') {
    const top = await db.getTopWealthUsers(guild.id);
    if (!top.length) {
     return interaction.editReply({ content: 'No economy data found for this server.', ephemeral: true });
    }

    const lines = top.map(u =>
     `**#${u.rank}** <@${u.userId}> — ${EMOJIS.coin} **${u.wealth.toLocaleString()}** total ` +
     `*(Wallet: ${u.wallet.toLocaleString()} · Bank: ${u.bank.toLocaleString()})* · Lv.${u.level}`
    ).join('\n');

    const container = new ContainerBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## Top 10 Wealthiest Members`)
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Ranked by wallet + bank combined balance')
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (sub === 'activity') {
    const target = options.getUser('user');
    const [profile, social, pet, clan, stocksData, intradayData, inventoryItems] = await Promise.all([
     db.getProfile(guild.id, target.id),
     db.getUserSocial(guild.id, target.id),
     db.getPet(guild.id, target.id),
     db.getClanByMember(guild.id, target.id),
     db.getUserStocksTotalValue(guild.id, target.id).catch(() => ({ totalValue: 0 })),
     db.getUserIntradayTotalValue(guild.id, target.id).catch(() => ({ totalValue: 0 })),
     db.getInventory(guild.id, target.id).catch(() => [])
    ]);

    const totalStockAssets = Math.round((stocksData.totalValue || 0) + (intradayData.totalValue || 0));
    const inventoryValue = inventoryItems.reduce((sum, name) => sum + (SELLABLE_ITEMS[name.toLowerCase()] || 0), 0);
    const netWorth = profile.coins + (profile.bank || 0) + totalStockAssets + inventoryValue;

    const now = Date.now();
    const workReady = !profile.workCooldown || (now - profile.workCooldown >= 3600000);
    const dailyReady = !profile.dailyCooldown || (now - profile.dailyCooldown >= 86400000);

    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Activity Report: ${target.username}`)
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `**Level:** ${profile.level} · **XP:** ${profile.xp.toLocaleString()}\n` +
       `**Wallet:** ${EMOJIS.coin} ${profile.coins.toLocaleString()} · **Bank:** ${EMOJIS.coin} ${(profile.bank || 0).toLocaleString()}\n` +
       `**Net Worth:** ${EMOJIS.coin} ${netWorth.toLocaleString()}\n` +
       `**Job:** ${profile.currentJob || 'Unemployed'}\n` +
       `**Pet:** ${pet ? `${pet.name} (Lv.${pet.level} ${pet.type})` : 'None'}\n` +
       `**Clan:** ${clan ? clan.name : 'None'}\n` +
       `**Rep:** ${social.repCount}\n` +
       `**Work Ready:** ${workReady ? 'Yes' : 'No'} · **Daily Ready:** ${dailyReady ? 'Yes' : 'No'}`
      )
     )
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Admin activity overview')
     );

    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

  } catch (err) {
   console.error('[ANALYTICS ERROR]', err);
   const errMsg = { content: 'Failed to load analytics.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
