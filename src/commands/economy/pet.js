const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('pet')
 .setDescription('Interact with or manage your server leveling & guard pet.')
 .addSubcommand(sub =>
 sub.setName('view')
 .setDescription('View your active pet\'s status, level, stats, and hunger.'))
 .addSubcommand(sub =>
 sub.setName('adopt')
 .setDescription('Adopt a new companion pet to guard your coins!')
 .addStringOption(opt =>
 opt.setName('name')
 .setDescription('A custom name for your pet (e.g. Buster)')
 .setRequired(true))
 .addStringOption(opt =>
 opt.setName('type')
 .setDescription('The breed of your pet')
 .addChoices(
 { name: ' Dog', value: 'Dog' },
 { name: ' Cat', value: 'Cat' },
 { name: ' Hamster', value: 'Hamster' },
 { name: ' Lizard', value: 'Lizard' }
 )
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('feed')
 .setDescription('Feed your pet to restore their hunger meter.')
 .addStringOption(opt =>
 opt.setName('method')
 .setDescription('Choose feed method: Pay 100 coins or feed a Worm from your inventory')
 .addChoices(
 { name: '<:coin:1512926963239489606> Pay 100 coins (Restores 25 hunger)', value: 'coins' },
 { name: ' Feed "Common Worm" (Restores 50 hunger)', value: 'worm' }
 )
 .setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('train')
 .setDescription('Train your pet\'s attributes (Attack/Defense). Costs 25 energy.')
 .addStringOption(opt =>
 opt.setName('attribute')
 .setDescription('The attribute to train')
 .addChoices(
 { name: ' Attack (For training bite power)', value: 'attack' },
 { name: ' Defense (Increases guard/bite chance when others rob you)', value: 'defense' }
 )
 .setRequired(true))),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const subcommand = interaction.options.getSubcommand();

 try {
 const pet = await db.getPet(guild.id, user.id);

 if (subcommand === 'adopt') {
 if (pet) {
 return interaction.editReply({
 content: `You already have a loyal companion named **${pet.name}** (${pet.type})! Use \`/pet view\` to inspect them.`,
 ephemeral: true
 });
 }

 const petName = interaction.options.getString('name').trim();
 const petType = interaction.options.getString('type');

 if (petName.length > 15) {
 return interaction.editReply({ content: 'Pet names are limited to 15 characters!', ephemeral: true });
 }

 const profile = await db.getProfile(guild.id, user.id);
 if (profile.coins < 200) {
 return interaction.editReply({
 content: `Adoption fee is ${EMOJIS.coin} **200** coins! You currently have ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins in your active wallet.`,
 ephemeral: true
 });
 }

 await db.updateCoins(guild.id, user.id, -200);
 await db.adoptPet(guild.id, user.id, petName, petType);

 const container = new ContainerBuilder()
 .setAccentColor(0x00FFCC)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Companion Adopted!\n **Congratulations!**\n\nYou adopted a beautiful **${petType}** named **${petName}**!\nMake sure to feed and train them to guard your coins!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Companion Name:** **${petName}**\n` +
 `**Pet Type:** **${petType}**\n` +
 `**Adoption Cost:** ${EMOJIS.coin} **200** coins`
 )
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (!pet) {
 return interaction.editReply({
 content: 'You do not own a pet yet! Adopt a companion first using `/pet adopt name:[name] type:[Dog/Cat...]`.',
 ephemeral: true
 });
 }

 const now = Date.now();
 const hoursSinceFed = (now - new Date(pet.lastFed).getTime()) / (1000 * 60 * 60);
 const hungerDecay = Math.floor(hoursSinceFed * 2);
 const activeHunger = Math.max(0, pet.hunger - hungerDecay);

 const hoursSinceTrained = (now - new Date(pet.lastTrained).getTime()) / (1000 * 60 * 60);
 const energyRestore = Math.floor(hoursSinceTrained * 8);
 const activeEnergy = Math.min(100, pet.energy + energyRestore);

 await db.updatePetStats(guild.id, user.id, { hunger: activeHunger, energy: activeEnergy });

 if (subcommand === 'view') {
 const hungerEmoji = activeHunger > 75 ? ' Full' : activeHunger > 40 ? ' Hungry' : ' Starving';
 const energyEmoji = activeEnergy > 60 ? ' Full' : activeEnergy > 25 ? ' Fatigued' : ' Exhausted';
 const xpNeeded = pet.level * 200;

 const container = new ContainerBuilder()
 .setAccentColor(0x00E5FF)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Pet Statistics: ${pet.name}\n**Companion:** ${pet.type} · **Level:** **${pet.level}** (\`${pet.xp.toLocaleString()} / ${xpNeeded.toLocaleString()}\`XP)`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `• **Hunger:** \`${activeHunger}/100\` (${hungerEmoji})\n` +
 `• **Energy:** \`${activeEnergy}/100\` (${energyEmoji})\n` +
 `• **Affection:** \`${pet.affection}/100\`\n` +
 `• **Attack Power:** \`${pet.attack}\`\n` +
 `• **Defense Rating:** \`${pet.defense}\` (Adds guard/bite chance when robbed)`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Make sure to feed them; starving pets cannot defend you!`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'feed') {
 if (activeHunger >= 100) {
 return interaction.editReply({ content: `**${pet.name}** is already completely stuffed!`, ephemeral: true });
 }

 const method = interaction.options.getString('method');
 let newHunger, feedDesc;

 if (method === 'coins') {
 const profile = await db.getProfile(guild.id, user.id);
 if (profile.coins < 100) {
 return interaction.editReply({
 content: `You do not have ${EMOJIS.coin} **100** coins in your active wallet to buy pet food!`,
 ephemeral: true
 });
 }

 await db.updateCoins(guild.id, user.id, -100);
 newHunger = Math.min(100, activeHunger + 25);
 await db.updatePetStats(guild.id, user.id, { hunger: newHunger, lastFed: new Date().toISOString() });
 feedDesc = `You spent **${EMOJIS.coin} 100 coins** to feed **${pet.name}** a bag of premium pet food!\nHunger meter: ** ${newHunger}/100**.`;

 } else if (method === 'worm') {
 const inventory = await db.getInventory(guild.id, user.id);
 const hasWorm = inventory.some(item => item.toLowerCase() === 'common worm');

 if (!hasWorm) {
 return interaction.editReply({
 content: 'You do not have a **Common Worm** in your inventory to feed! Buy a Shovel and `/dig` to find them.',
 ephemeral: true
 });
 }

 await db.removeItemFromInventory(guild.id, user.id, 'Common Worm');
 newHunger = Math.min(100, activeHunger + 50);
 await db.updatePetStats(guild.id, user.id, { hunger: newHunger, lastFed: new Date().toISOString() });
 feedDesc = `You fed **${pet.name}** a tasty **Common Worm** from your inventory!\nHunger meter: ** ${newHunger}/100**.`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(0x00FF66)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Pet Fed!\n${feedDesc}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'train') {
 if (activeEnergy < 25) {
 return interaction.editReply({
 content: `**${pet.name}** is too exhausted to train! Wait for their energy to restore (restores 8 units per hour).`,
 ephemeral: true
 });
 }

 if (activeHunger < 15) {
 return interaction.editReply({
 content: `**${pet.name}** is starving! Feed them before pushing them to work and train.`,
 ephemeral: true
 });
 }

 const attribute = interaction.options.getString('attribute');
 const newEnergy = activeEnergy - 25;
 const newHunger = Math.max(0, activeHunger - 10);

 let xpGain = Math.floor(Math.random() * 51) + 40;
 let levelUp = false;
 let newLevel = pet.level;
 let newXp = pet.xp + xpGain;

 const xpNeeded = pet.level * 200;
 if (newXp >= xpNeeded) {
 newXp -= xpNeeded;
 newLevel += 1;
 levelUp = true;
 }

 const statsUpdate = {
 energy: newEnergy,
 hunger: newHunger,
 xp: newXp,
 level: newLevel,
 lastTrained: new Date().toISOString()
 };

 let attributeText = '';
 if (attribute === 'attack') {
 statsUpdate.attack = pet.attack + 1;
 attributeText = `**Attack Power** increased from \`${pet.attack}\` to \`${pet.attack + 1}\`!`;
 } else if (attribute === 'defense') {
 statsUpdate.defense = pet.defense + 1;
 attributeText = `**Defense Rating** increased from \`${pet.defense}\` to \`${pet.defense + 1}\`! (Bite chance: \`${Math.min(50, 10 + (pet.defense + 1) * 1.5)}%\`)`;
 }

 await db.updatePetStats(guild.id, user.id, statsUpdate);

 let detailText =
 `• ${attributeText}\n` +
 `• **XP Gained:** **${xpGain.toLocaleString()} Pet XP**\n` +
 `• **Energy Consumed:** **-25** (Current: \`${newEnergy}/100\`)\n` +
 `• **Calories Burned:** **-10** (Current: \`${newHunger}/100\`)`;

 if (levelUp) {
 detailText += `\n\n **LEVEL UP!** **${pet.name}** advanced to **Level ${newLevel}**!`;
 }

 const container = new ContainerBuilder()
 .setAccentColor(0xFF8C00)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Pet Training Session: ${pet.name}\nCompleted a productive training course with **${pet.name}**!`
 )
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 } catch (err) {
 console.error('[PET SYSTEM ERROR]', err);
 const _errMsg = { content: 'Failed to process companion pet coordinates in the database.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
