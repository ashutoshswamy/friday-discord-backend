const {
 SlashCommandBuilder,
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

const JOB_DISPLAY = {
 cashier: 'Cashier', street_performer: 'Street Performer', delivery_driver: 'Delivery Driver',
 janitor: 'Janitor', barista: 'Barista', farmhand: 'Farmhand',
 chef: 'Chef', mechanic: 'Mechanic', security_guard: 'Security Guard',
 plumber: 'Plumber', electrician: 'Electrician', nurse: 'Nurse',
 software_engineer: 'Software Engineer', doctor: 'Doctor', lawyer: 'Lawyer',
 architect: 'Architect', pharmacist: 'Pharmacist', financial_analyst: 'Financial Analyst',
 ceo: 'CEO', investment_banker: 'Investment Banker', game_developer: 'Game Developer',
 surgeon: 'Surgeon', aerospace_engineer: 'Aerospace Engineer', hedge_fund_manager: 'Hedge Fund Manager'
};

module.exports = {
 data: new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View a member\'s full social and economy profile card.')
  .addUserOption(opt =>
   opt.setName('user').setDescription('The member to view (defaults to yourself)').setRequired(false)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const target = options.getUser('user') || user;

  try {
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
   const jobDisplay = profile.currentJob ? (JOB_DISPLAY[profile.currentJob] || profile.currentJob) : 'Unemployed';
   const petDisplay = pet ? `${pet.name} (Lv.${pet.level} ${pet.type})` : 'No pet';
   const marriageDisplay = social.partnerId ? `Married to <@${social.partnerId}>` : 'Single';
   const clanDisplay = clan ? `**${clan.name}**` : 'No clan';
   const bioDisplay = social.bio || '*No bio set*';

   const container = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## ${target.username}\n${bioDisplay}`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**Level:** ${profile.level} · **XP:** ${profile.xp.toLocaleString()}\n` +
      `**Net Worth:** ${EMOJIS.coin} ${netWorth.toLocaleString()} (Wallet: ${profile.coins.toLocaleString()} + Bank: ${(profile.bank || 0).toLocaleString()} + Stocks: ${totalStockAssets.toLocaleString()} + Inv: ${inventoryValue.toLocaleString()})\n` +
      `**Job:** ${jobDisplay}`
     )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**Pet:** ${petDisplay}\n` +
      `**Clan:** ${clanDisplay}\n` +
      `${marriageDisplay}\n` +
      `**Rep:** ${social.repCount.toLocaleString()}`
     )
    )
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`-# Use /bio to set your tagline • /rep to give reputation`)
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[PROFILE ERROR]', err);
   const errMsg = { content: 'Failed to load profile.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
