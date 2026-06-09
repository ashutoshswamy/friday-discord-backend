const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');

const cooldowns = new Map();

const LOCATIONS_POOL = [
 { name: "Couch Cushions", icon: "" },
 { name: "City Sewer", icon: "" },
 { name: "Car Glovebox", icon: "" },
 { name: "Old Dresser", icon: "" },
 { name: "Dark Alleyway", icon: "" },
 { name: "Coat Pocket", icon: "" },
 { name: "Dog House", icon: "" },
 { name: "Abandoned Locker", icon: "" }
];

module.exports = {
 data: new SlashCommandBuilder()
 .setName('search')
 .setDescription('Presents 3 locations to search for coins and items. High risk of finding nothing or losing coins.'),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const now = Date.now();
 const cooldownMs = 60 * 1000;
 const userCooldown = cooldowns.get(user.id);

 if (userCooldown && (now - userCooldown < cooldownMs)) {
 const timeLeft = Math.ceil((cooldownMs - (now - userCooldown)) / 1000);
 return interaction.editReply({ content: `Be patient! Wait **${timeLeft}s** before searching again.`, ephemeral: true });
 }

 try {
 cooldowns.set(user.id, now);

 const shuffled = [...LOCATIONS_POOL].sort(() => 0.5 - Math.random());
 const selected = shuffled.slice(0, 3);

 const row = new ActionRowBuilder();
 selected.forEach((loc, idx) => {
 row.addComponents(
 new ButtonBuilder()
 .setCustomId(`search_${idx}_${loc.name.toLowerCase().replace(/ /g, '_')}`)
 .setLabel(`${loc.icon} ${loc.name}`)
 .setStyle(ButtonStyle.Primary)
 );
 });

 const lobbyContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Active Search & Scavenge\nWhere would you like to search? Pick a location below!\n` +
 `*Scavenging in dark places can sometimes lead to finding nothing or losing coins.*`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Select a location within 15 seconds'))
 .addActionRowComponents(row);

 const response = await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [lobbyContainer]
 });

 const collector = response.createMessageComponentCollector({
 filter: i => i.user.id === user.id,
 time: 15000,
 max: 1
 });

 collector.on('collect', async i => {
 const idxStr = i.customId.split('_')[1];
 const locObj = selected[parseInt(idxStr)];
 const roll = Math.random();

 let accentColor, resultText;

 if (roll < 0.40) {
 const coinGain = Math.floor(Math.random() * 351) + 150;
 await db.updateCoins(guild.id, user.id, coinGain);
 accentColor = 0x00FF66;
 resultText = `**Bingo!**\nYou carefully searched the **${locObj.name}** and found a stash of spare coins!\nAdded **${EMOJIS.coin} ${coinGain.toLocaleString()} coins** to your wallet.`;
 } else if (roll < 0.60) {
 const items = ["Silver Ring", "Common Worm", "Lootbox"];
 const foundItem = items[Math.floor(Math.random() * items.length)];
 await db.addItemToInventory(guild.id, user.id, foundItem);
 accentColor = 0x00FFCC;
 resultText = `**Loot Extracted!**\nYou reached deep into the **${locObj.name}** and pulled out a collectible:\n **${foundItem}** added to your inventory!`;
 } else if (roll < 0.90) {
 accentColor = 0x9CA3AF;
 resultText = `**Empty...**\nYou thoroughly searched the **${locObj.name}** but found nothing but dust bunnies and lint.`;
 } else {
 const uProfile = await db.getProfile(guild.id, user.id);
 let coinLoss = Math.floor(Math.random() * 301) + 100;
 coinLoss = Math.min(coinLoss, uProfile.coins);
 await db.updateCoins(guild.id, user.id, -coinLoss);
 accentColor = 0xFF3333;
 resultText = `**OUCH!**\nWhile searching the **${locObj.name}**, you were caught by angry security!\nYou lost **${EMOJIS.coin} ${coinLoss.toLocaleString()} coins** while running away.`;
 }

 const resultContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Searched: ${locObj.name}\n${resultText}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 );

 await i.update({ flags: MessageFlags.IsComponentsV2, components: [resultContainer] });
 });

 collector.on('end', async (collected, reason) => {
 if (reason === 'time') {
 const timeoutContainer = new ContainerBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent('## Search Cancelled\n You took too long to choose a location. The search opportunity expired.')
 );
 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [timeoutContainer] }).catch(() => null);
 }
 });

 } catch (err) {
 console.error('[SEARCH ERROR]', err);
 const errMsg = { content: 'Failed to execute search protocol.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
