const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

const CRIMES = {
 pickpocket: {
  label: 'Pickpocket',
  successChance: 0.62, rewardMin: 80, rewardMax: 250, failFine: 150,
  cooldownSec: 1800,
  successMsgs: [
   'You bumped into a distracted stranger and swiped their wallet clean.',
   'Smooth hands. You lifted coins from a merchant\'s belt pouch.',
   'You palmed a coin purse from a tourist who never noticed.'
  ],
  failMsgs: [
   'They grabbed your wrist mid-lift. You paid a fine to avoid arrest.',
   'A guard spotted the attempt and fined you on the spot.',
   'Your target turned around at the worst moment. Fine issued.'
  ]
 },
 carjack: {
  label: 'Carjack',
  successChance: 0.42, rewardMin: 400, rewardMax: 1100, failFine: 600,
  cooldownSec: 3600,
  successMsgs: [
   'You found an unlocked vehicle and stripped it for parts.',
   'A quick smash-and-grab on a parked luxury car paid off.',
   'You hotwired a sedan and sold it to a chop shop.'
  ],
  failMsgs: [
   'The car alarm blared. Police arrived. Fine paid.',
   'The owner returned early. You ran but dropped your wallet.',
   'GPS tracker. You barely escaped but lost your bribe money.'
  ]
 },
 fraud: {
  label: 'Bank Fraud',
  successChance: 0.28, rewardMin: 1200, rewardMax: 4000, failFine: 2000,
  cooldownSec: 7200,
  successMsgs: [
   'You forged authorization documents and drained a corporate account.',
   'A fake identity and a convincing story netted a massive wire transfer.',
   'The phishing kit worked perfectly. Funds transferred before detection.'
  ],
  failMsgs: [
   'Fraud detection flagged the transaction. Heavy fine imposed.',
   'The bank\'s security team traced you. Massive fine and 2h lockout.',
   'Federal agents intercepted the transfer. You\'re paying for this one.'
  ]
 }
};

module.exports = {
 data: new SlashCommandBuilder()
  .setName('crime')
  .setDescription('Attempt an illegal activity for big rewards — or face heavy penalties.')
  .addStringOption(opt =>
   opt.setName('type')
    .setDescription('The type of crime to commit')
    .setRequired(true)
    .addChoices(
     { name: 'Pickpocket — Low risk, quick cooldown (62% success)', value: 'pickpocket' },
     { name: 'Carjack — Medium risk, moderate reward (42% success)', value: 'carjack' },
     { name: 'Bank Fraud — High risk, massive reward (28% success)', value: 'fraud' }
    )),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const type = options.getString('type');
  const crime = CRIMES[type];

  const cd = checkCooldown(`crime_${type}`, user.id, crime.cooldownSec);
  if (cd.onCooldown) {
   return interaction.editReply({
    content: `You need to lay low before attempting another **${crime.label}**. Try again in **${cd.remaining}s**.`,
    ephemeral: true
   });
  }

  try {
   const profile = await db.getProfile(guild.id, user.id);
   const success = Math.random() < crime.successChance;

   let coinChange, resultText, color;

   if (success) {
    coinChange = Math.floor(Math.random() * (crime.rewardMax - crime.rewardMin + 1)) + crime.rewardMin;
    await db.updateCoins(guild.id, user.id, coinChange);
    const msg = crime.successMsgs[Math.floor(Math.random() * crime.successMsgs.length)];
    resultText = `✅ **Success!** ${msg}\n\nYou pocketed ${EMOJIS.coin} **${coinChange.toLocaleString()}** coins.`;
    color = 0x00FF66;
   } else {
    coinChange = -Math.min(crime.failFine, profile.coins);
    await db.updateCoins(guild.id, user.id, coinChange);
    const msg = crime.failMsgs[Math.floor(Math.random() * crime.failMsgs.length)];
    resultText = `❌ **Caught!** ${msg}\n\nPenalty: ${EMOJIS.coin} **${Math.abs(coinChange).toLocaleString()}** coins fined.`;
    color = 0xFF3333;
   }

   const finalProfile = await db.getProfile(guild.id, user.id);

   const container = new ContainerBuilder()
    .setAccentColor(color)
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(`## Crime: ${crime.label}\n${resultText}`)
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**Wallet:** ${EMOJIS.coin} **${finalProfile.coins.toLocaleString()}**\n` +
      `-# Cooldown: ${Math.round(crime.cooldownSec / 60)}min • Success rate: ${Math.round(crime.successChance * 100)}%`
     )
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[CRIME ERROR]', err);
   const errMsg = { content: 'Failed to execute crime operation.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
