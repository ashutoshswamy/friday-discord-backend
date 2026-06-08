const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

const SCENARIOS = {
 pickpocket: {
  label: 'Pickpocket',
  reqLevel: 1,
  cooldown: 300, // 5 min
  prompt: 'You spot a wealthy noble walking through the market district. How do you approach the swipe?',
  options: [
   {
    id: 'pp_sleight',
    label: '🔍 Sleight of Hand',
    style: ButtonStyle.Primary,
    chance: 0.65,
    minCoins: 100, maxCoins: 250,
    fine: 120,
    xp: 20,
    successMsg: 'You smoothly bumped into the noble, slid your fingers into their pocket, and slipped away with their purse.',
    failMsg: 'Your fingers slipped! The noble grabbed your arm and called the guards. You paid a fine to escape arrest.'
   },
   {
    id: 'pp_bump',
    label: '💨 Bump & Run',
    style: ButtonStyle.Secondary,
    chance: 0.45,
    minCoins: 180, maxCoins: 350,
    fine: 75,
    xp: 25,
    successMsg: 'You violently jostled them, snatched the purse dangling from their belt, and dashed through a side alley before they could yell.',
    failMsg: 'You bumped them, but they had a tight grip on their purse. You dropped your own coins while scrambling to escape.'
   }
  ]
 },
 carjack: {
  label: 'Carjack',
  reqLevel: 3,
  cooldown: 600, // 10 min
  prompt: 'You target a parked luxury sports car down a dark street. How do you steal it?',
  options: [
   {
    id: 'cj_smash',
    label: '🔨 Smash & Grab',
    style: ButtonStyle.Danger,
    chance: 0.50,
    minCoins: 400, maxCoins: 800,
    fine: 350,
    xp: 45,
    successMsg: 'You broke the window, jumped inside, hotwired the column, and sped off before the alarm alerted the street.',
    failMsg: 'The window shatter triggered a loud alarm. You panicked and ran, dropping some bribe coins to a patrolling guard.'
   },
   {
    id: 'cj_hotwire',
    label: '🔑 Hotwire',
    style: ButtonStyle.Secondary,
    chance: 0.35,
    minCoins: 650, maxCoins: 1200,
    fine: 500,
    xp: 60,
    successMsg: 'You picked the door lock silently, spliced the starter wires under the dashboard, and drove off without a trace.',
    failMsg: 'You spent too much time trying to pick the lock. The owner walked up behind you with a bat, forcing you to throw coins to escape.'
   },
   {
    id: 'cj_jam',
    label: '📱 Signal Jammer',
    style: ButtonStyle.Primary,
    chance: 0.75,
    minCoins: 800, maxCoins: 1500,
    fine: 700,
    xp: 50,
    reqItem: 'Hacker Laptop',
    successMsg: 'You opened the doors instantly using a signal jammer and cloned the transponder key. Clean getaway.',
    failMsg: 'The laptop connection failed. The transponder lock routed a warning directly to police GPS. You paid a massive bribe to escape.'
   }
  ]
 },
 fraud: {
  label: 'Bank Fraud',
  reqLevel: 6,
  cooldown: 1800, // 30 min
  prompt: 'You set up a phishing node targeting high-value corporate bank transfers. Choose your attack vector:',
  options: [
   {
    id: 'bf_phish',
    label: '💻 Phishing Node',
    style: ButtonStyle.Primary,
    chance: 0.45,
    minCoins: 1200, maxCoins: 2800,
    fine: 1000,
    xp: 90,
    reqItem: 'Hacker Laptop',
    successMsg: 'Your duplicate portal captured corporate login keys. You successfully authorized an international wire transfer.',
    failMsg: 'An automated security bot detected your redirect node. Firewalls logged your MAC address and fined your account.'
   },
   {
    id: 'bf_social',
    label: '🏦 Social Engineering',
    style: ButtonStyle.Secondary,
    chance: 0.30,
    minCoins: 2000, maxCoins: 4500,
    fine: 1500,
    xp: 120,
    successMsg: 'You posed as a system administrator, called the bank branch manager, and talked them into disabling 2FA security codes.',
    failMsg: 'The manager asked security verification questions you couldn\'t bypass. They froze your linked accounts and fined you.'
   },
   {
    id: 'bf_forge',
    label: '🖨️ Forged Wire Transfer',
    style: ButtonStyle.Danger,
    chance: 0.15,
    minCoins: 4000, maxCoins: 8500,
    fine: 2500,
    xp: 180,
    successMsg: '**JACKPOT!** Your forged routing slip successfully cleared auditing. A massive cargo deposit cleared into your bank.',
    failMsg: 'Auditors instantly flagged the routing slip. Federal agents tracked the payout and seized a massive fine from your wallet.'
   }
  ]
 }
};

module.exports = {
 data: new SlashCommandBuilder()
  .setName('crime')
  .setDescription('Commit a high-stakes crime scenario for huge coin payouts.')
  .addStringOption(opt =>
   opt.setName('type')
    .setDescription('Select the target crime scenario')
    .setRequired(true)
    .addChoices(
     { name: 'Pickpocket (Low Risk, Cooldown: 5m)', value: 'pickpocket' },
     { name: 'Carjack (Level 3 Required, Cooldown: 10m)', value: 'carjack' },
     { name: 'Bank Fraud (Level 6 Required, Cooldown: 30m)', value: 'fraud' }
    )
  ),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const type = options.getString('type');
  const scenario = SCENARIOS[type];

  // Fetch crime profile
  const crimeProfile = await db.getCrimeProfile(guild.id, user.id);

  if (crimeProfile.level < scenario.reqLevel) {
   return interaction.editReply({
    content: `You lack the street experience to pull off this heist! You need **Crime Level ${scenario.reqLevel}** to attempt **${scenario.label}** (Your current Crime Level is **${crimeProfile.level}**).`,
    ephemeral: true
   });
  }

  // Check cooldown
  const cd = checkCooldown(`crime_${type}`, user.id, scenario.cooldown);
  if (cd.onCooldown) {
   return interaction.editReply({
    content: `You need to lay low before attempting another **${scenario.label}**. Try again in **${cd.remaining}s**.`,
    ephemeral: true
   });
  }

  try {
   const inventory = await db.getInventory(guild.id, user.id);

   // Create buttons for options
   const buttons = scenario.options.map(opt => {
    return new ButtonBuilder()
     .setCustomId(opt.id)
     .setLabel(opt.label)
     .setStyle(opt.style);
   });

   const row = new ActionRowBuilder().addComponents(buttons);

   const initialContainer = new ContainerBuilder()
    .setAccentColor(0x34495E) // Midnight dark slate
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## 🚨 Crime Scenario: ${scenario.label}\n` +
        `**Street Experience:** Crime Level **${crimeProfile.level}** (XP: ${crimeProfile.xp}/${crimeProfile.level * 500})\n\n` +
        `*${scenario.prompt}*`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Select your tactical approach below. Hacking options require a Hacker Laptop.'));

   const response = await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [initialContainer, row]
   });

   const collector = response.createMessageComponentCollector({
    filter: i => i.user.id === user.id,
    time: 30000
   });

   collector.on('collect', async i => {
    await i.deferUpdate();
    collector.stop('selected');

    const chosenOption = scenario.options.find(o => o.id === i.customId);

    // Check if item is required
    if (chosenOption.reqItem) {
     const hasItem = inventory.some(item => item.toLowerCase() === chosenOption.reqItem.toLowerCase());
     if (!hasItem) {
      return i.followUp({
       content: `Failed: You do not possess a **${chosenOption.reqItem}** required for this option!`,
       ephemeral: true
      });
     }
    }

    const profile = await db.getProfile(guild.id, user.id);
    const roll = Math.random();
    const isSuccess = roll <= chosenOption.chance;

    let coinChange = 0;
    let resultText = '';
    let color = 0x00FF00;
    let xpMsg = '';

    if (isSuccess) {
     coinChange = Math.floor(Math.random() * (chosenOption.maxCoins - chosenOption.minCoins + 1)) + chosenOption.minCoins;
     await db.updateCoins(guild.id, user.id, coinChange);
     await db.incrementQuestProgress(guild.id, user.id, 'crime', null, 1);

     // Award crime XP
     const xpResult = await db.addCrimeXp(guild.id, user.id, chosenOption.xp);
     xpMsg = `\n**Crime XP Gained:** **+${chosenOption.xp} XP** (Level **${xpResult.newLevel}** · ${xpResult.newXp}/${xpResult.newLevel * 500})`;
     if (xpResult.levelUp) {
      xpMsg += `\n🎉 **LEVEL UP!** Your street credibility increased! You are now **Crime Level ${xpResult.newLevel}**!`;
     }

     resultText = `**Success!** ${chosenOption.successMsg}\n\n` +
      `**Payout:** ${EMOJIS.coin} **+${coinChange.toLocaleString()}** coins added to wallet.` +
      xpMsg;
     color = 0x00FF66;
    } else {
     coinChange = -Math.min(chosenOption.fine, Number(profile.coins));
     await db.updateCoins(guild.id, user.id, coinChange);

     resultText = `**BUSTED!** ${chosenOption.failMsg}\n\n` +
      `**Fine Paid:** ${EMOJIS.coin} **${Math.abs(coinChange).toLocaleString()}** coins lost.`;
     color = 0xFF3333;
    }

    const finalProfile = await db.getProfile(guild.id, user.id);

    const resultContainer = new ContainerBuilder()
     .setAccentColor(color)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🚨 Crime Result: ${scenario.label}\n${resultText}`)
       )
     )
     .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `**New Balance:** ${EMOJIS.coin} **${finalProfile.coins.toLocaleString()}**\n` +
       `-# Success rate for this approach: ${Math.round(chosenOption.chance * 100)}%`
      )
     );

    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [resultContainer] });
   });

   collector.on('end', async (collected, reason) => {
    if (reason === 'time') {
     const expiredContainer = new ContainerBuilder()
      .setAccentColor(0x7F8C8D)
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(
          `## 🚨 Crime Aborted\nYou hesitated for too long! The opportunity passed, and the target slipped away.`
         )
        )
      );
     await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
    }
   });

  } catch (err) {
   console.error('[CRIME ERROR]', err);
   const errMsg = { content: 'Failed to process crime scene.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
