const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('rob')
 .setDescription("Attempt to syphon coins from another member's wallet.")
 .addUserOption(opt =>
 opt.setName('target').setDescription('The member you want to rob').setRequired(true)),

 async execute(interaction) {
 const { guild, user, options } = interaction;
 if (!guild) return;

 const targetUser = options.getUser('target');

 if (targetUser.id === user.id) return interaction.editReply({ content: 'You cannot rob yourself!', ephemeral: true });
 if (targetUser.bot) return interaction.editReply({ content: 'You cannot rob bot accounts!', ephemeral: true });

 const cd = checkCooldown('rob', user.id, 60);
 if (cd.onCooldown) {
 return interaction.editReply({ content: `Rob is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
 }

 try {
 const robberProfile = await db.getProfile(guild.id, user.id);
 const victimProfile = await db.getProfile(guild.id, targetUser.id);

 if (robberProfile.coins < 100) {
 return interaction.editReply({ content: 'You must possess at least <:coin:1512926963239489606> **100** coins to plan a heist!', ephemeral: true });
 }

 if (victimProfile.coins < 50) {
 return interaction.editReply({
 content: `<@${targetUser.id}> is practically broke! They only have <:coin:1512926963239489606> **${victimProfile.coins.toLocaleString()}** coins. Not worth the risk.`,
 ephemeral: true
 });
 }

 let accentColor, title, descText, detailText;

 const victimPet = await db.getPet(guild.id, targetUser.id);
 if (victimPet && victimPet.hunger > 10) {
 const defendChance = Math.min(0.50, 0.10 + (victimPet.defense * 0.015));

 if (Math.random() < defendChance) {
 let fineAmount = Math.floor(robberProfile.coins * 0.15);
 fineAmount = Math.max(100, Math.min(fineAmount, 2000));

 await db.updateCoins(guild.id, user.id, -fineAmount);
 await db.updateCoins(guild.id, targetUser.id, fineAmount);

 const container = new ContainerBuilder()
 .setAccentColor(0xFF3333)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## GUARD PET DEFENDED!\n` +
 `You sneaked up to rob <@${targetUser.id}>, but their guard pet **${victimPet.name}** (${victimPet.type}) caught your scent!\n` +
 `You were forced to retreat and paid **<:coin:1512926963239489606> ${fineAmount.toLocaleString()} coins** in damages.`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Caught By:** **${victimPet.name}** (Lv. ${victimPet.level})\n` +
 `**Compensation Paid:** <:coin:1512926963239489606> **-${fineAmount.toLocaleString()}** coins`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }
 }

 const isSuccess = Math.random() < 0.45;

 if (isSuccess) {
 const pct = Math.floor(Math.random() * 21) + 10;
 let stolenAmount = Math.floor(victimProfile.coins * (pct / 100));
 stolenAmount = Math.max(10, Math.min(stolenAmount, 5000));

 await db.updateCoins(guild.id, user.id, stolenAmount);
 await db.updateCoins(guild.id, targetUser.id, -stolenAmount);

 accentColor = 0x00FF66;
 title = ' Successful Heist!';
 descText = `You successfully infiltrated <@${targetUser.id}>'s vault and escaped with **<:coin:1512926963239489606> ${stolenAmount.toLocaleString()}** coins!`;
 detailText = `**Stolen Loot:** <:coin:1512926963239489606> **+${stolenAmount.toLocaleString()}** coins\n**Victim Loss:** <:coin:1512926963239489606> **-${stolenAmount.toLocaleString()}** coins`;
 } else {
 const pct = Math.floor(Math.random() * 11) + 15;
 let fineAmount = Math.floor(robberProfile.coins * (pct / 100));
 fineAmount = Math.max(50, Math.min(fineAmount, 2500));

 await db.updateCoins(guild.id, user.id, -fineAmount);
 await db.updateCoins(guild.id, targetUser.id, fineAmount);

 accentColor = 0xFF3333;
 title = ' BUSTED!';
 descText = `You were caught red-handed attempting to rob <@${targetUser.id}>! Fined **<:coin:1512926963239489606> ${fineAmount.toLocaleString()}** coins paid directly to the victim.`;
 detailText = `**Fine Paid:** <:coin:1512926963239489606> **-${fineAmount.toLocaleString()}** coins\n**Victim Compensated:** <:coin:1512926963239489606> **+${fineAmount.toLocaleString()}** coins`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(accentColor)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## ${title}\n${descText}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[ROB ERROR]', err);
 const errMsg = { content: 'Failed to process Rob transaction.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
