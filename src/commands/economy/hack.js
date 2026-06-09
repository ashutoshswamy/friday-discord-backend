const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS, getEmoji } = require('../../utils/emojis');

module.exports = {
 data: new SlashCommandBuilder()
  .setName('hack')
  .setDescription('Bypass digital mainframes to steal coins or valuable files. Requires a Hacker Laptop.'),

 async execute(interaction) {
  const { guild, user } = interaction;
  if (!guild) return;

  // 10-minute cooldown
  const cd = checkCooldown('hack', user.id, 600);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `Mainframe firewall is alert! Wait **${cd.remaining}s** before launching another intrusion.`, ephemeral: true });
  }

  try {
   const inventory = await db.getInventory(guild.id, user.id);
   const hasLaptop = inventory.some(item => item.toLowerCase() === 'hacker laptop');

   if (!hasLaptop) {
    return interaction.editReply({ content: 'You do not own a **Hacker Laptop**! Purchase one from the shop first using `/buy`.', ephemeral: true });
   }

   // Target Select Buttons
   const lowBtn = new ButtonBuilder().setCustomId('hack_low').setLabel('Low Risk (Sparsely Secured Node)').setStyle(ButtonStyle.Success);
   const medBtn = new ButtonBuilder().setCustomId('hack_med').setLabel('Medium Risk (Corporate Mainframe)').setStyle(ButtonStyle.Primary);
   const highBtn = new ButtonBuilder().setCustomId('hack_high').setLabel('High Risk (National Reserve)').setStyle(ButtonStyle.Danger);
   const row = new ActionRowBuilder().addComponents(lowBtn, medBtn, highBtn);

   const initialContainer = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `##  Mainframe Terminal Connection\n` +
        `` +
        `\`\`\`\n` +
        `[INTRUDER ALERT] Cybernetic bypass protocols active.\n` +
        `Choose a mainframe target node below to bypass firewalls and download files.\n` +
        `\`\`\`\n` +
        `• **Sparsely Secured Node:** 80% Success Rate | Small Coins / Decrypted Hard Drive\n` +
        `• **Corporate Mainframe:** 50% Success Rate | Medium Coins / Mainframe Core\n` +
        `• **National Reserve:** 25% Success Rate | Huge Coins / Stolen Crypto Key`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    );

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

    let successChance = 0.80;
    let coinsMin = 100, coinsMax = 300;
    let itemReward = 'Decrypted Hard Drive';
    let targetName = 'Sparsely Secured Node';
    let failFine = 150;

    if (i.customId === 'hack_med') {
     successChance = 0.50;
     coinsMin = 400;
     coinsMax = 900;
     itemReward = 'Mainframe Core';
     targetName = 'Corporate Mainframe';
     failFine = 400;
    } else if (i.customId === 'hack_high') {
     successChance = 0.25;
     coinsMin = 1500;
     coinsMax = 3500;
     itemReward = 'Stolen Crypto Key';
     targetName = 'National Reserve';
     failFine = 1000;
    }

    const roll = Math.random();
    const isSuccess = roll <= successChance;

    if (isSuccess) {
     const coinsWon = Math.floor(Math.random() * (coinsMax - coinsMin + 1)) + coinsMin;
     await db.updateCoins(guild.id, user.id, coinsWon);
     await db.addItemToInventory(guild.id, user.id, itemReward);
     await db.incrementQuestProgress(guild.id, user.id, 'hack', null, 1);

     const successContainer = new ContainerBuilder()
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(
          `##  HACK SUCCESS: ${targetName}\n` +
          `\`\`\`diff\n` +
          `+ CONNECTION ESTABLISHED\n` +
          `+ FIREWALLS BYPASSED SUCCESSFULLY\n` +
          `+ DOWNLOAD COMPLETE: Cryptographic vaults decrypted.\n` +
          `\`\`\`\n` +
          `**Credits Exfiltrated:** ${EMOJIS.coin} **${coinsWon.toLocaleString()}** coins added to wallet!\n` +
          `**Data Packet Recovered:** Added ${getEmoji(itemReward)} **${itemReward}** to your inventory (sell via \`/sell\`).`
         )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
      );

     await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [successContainer] });
    } else {
     // Apply fine
     const profile = await db.getProfile(guild.id, user.id);
     const actualFine = Math.min(Number(profile.coins), failFine);
     await db.updateCoins(guild.id, user.id, -actualFine);

     const failContainer = new ContainerBuilder()
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(
          `##  HACK FAILED: ${targetName}\n` +
          `\`\`\`diff\n` +
          `- !!! INTRUSION DETECTED !!!\n` +
          `- FIREWALL COUNTERMEASURES ACTIVATED\n` +
          `- Trace-route logged. Local authorities notified.\n` +
          `\`\`\`\n` +
          `The cyber-security system traced your connection! You were forced to pay a decryption/bribe fine of ${EMOJIS.coin} **${actualFine.toLocaleString()}** coins.`
         )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
      );

     await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [failContainer] });
    }
   });

   collector.on('end', async (collected, reason) => {
    if (reason === 'time') {
     const expiredContainer = new ContainerBuilder()
      .addSectionComponents(
       new SectionBuilder()
        .addTextDisplayComponents(
         new TextDisplayBuilder().setContent(
          `##  Terminal Disconnected\n` +
          `Intrusion session timed out. Mainframe security cycled its encryption keys.`
         )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
      );
     await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => null);
    }
   });

  } catch (err) {
   console.error('[HACK ERROR]', err);
   const errMsg = { content: 'Failed to execute network intrusion.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
