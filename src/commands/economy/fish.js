const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const cooldowns = new Map();

const FISH_CHANCES = [
 { name: "Junk Seaweed",      chance: 0.04, msg: " You reeled in... some slimy **Junk Seaweed**. Yuck." },
 { name: "Old Boot",          chance: 0.07, msg: " You fought a heavy pull, only to land a waterlogged **Old Boot**." },
 { name: "Clam",              chance: 0.20, msg: " You scooped a bumpy **Clam** from the lake bed!" },
 { name: "Common Bass",       chance: 0.42, msg: " Nice catch! You reeled in a standard **Common Bass**." },
 { name: "Salmon",            chance: 0.62, msg: " Beautiful! You caught a healthy pink **Salmon**!" },
 { name: "Pufferfish",        chance: 0.73, msg: " Careful! You netted a spiky **Pufferfish** — it inflated immediately!" },
 { name: "Goldfish",          chance: 0.83, msg: " Rare catch! You hooked a shining **Goldfish**!" },
 { name: "Lobster",           chance: 0.91, msg: " Excellent haul! A snapping **Lobster** was caught in your net!" },
 { name: "Tropical Coral Fish",chance: 0.95, msg: " Spectacular! You netted a vibrant, highly exotic **Tropical Coral Fish**!" },
 { name: "Shark Tooth",       chance: 0.98, msg: " No shark, but you found a massive razor-sharp **Shark Tooth** snagged in your line!" },
 { name: "Ancient Pearl",     chance: 0.997, msg: " **INCREDIBLE!** Your hook snagged an oyster holding a glowing **Ancient Pearl**!" },
 { name: "Mythical Whale",    chance: 1.00, msg: " **UNBELIEVABLE!** You hooked and reeled in a leviathan **Mythical Whale**!" }
];

module.exports = {
 data: new SlashCommandBuilder()
 .setName('fish')
 .setDescription('Go fishing in the virtual lake. Requires purchasing a Fishing Pole from the shop.'),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const now = Date.now();
 const cooldownMs = 45 * 1000;
 const userCooldown = cooldowns.get(user.id);

 if (userCooldown && (now - userCooldown < cooldownMs)) {
 const timeLeft = Math.ceil((cooldownMs - (now - userCooldown)) / 1000);
 return interaction.editReply({ content: `Do not scare the fish! Wait **${timeLeft}s** before casting again.`, ephemeral: true });
 }

 try {
 const inventory = await db.getInventory(guild.id, user.id);
 const hasPole = inventory.some(item => item.toLowerCase() === 'fishing pole');

 if (!hasPole) {
 return interaction.editReply({ content: 'You do not possess a **Fishing Pole**! Purchase one from the virtual shop first using `/buy`.', ephemeral: true });
 }

 cooldowns.set(user.id, now);

 const roll = Math.random();
 const reward = FISH_CHANCES.find(loot => roll <= loot.chance);
 await db.addItemToInventory(guild.id, user.id, reward.name);
 await db.incrementQuestProgress(guild.id, user.id, 'fish', reward.name, 1);

 const container = new ContainerBuilder()
 .setAccentColor(0x00E5FF)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Virtual Lake Fishing\n${reward.msg}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Catch Stored:** Added ${getEmoji(reward.name)} **${reward.name}** to your inventory\n` +
 `-# Use \`/sell\` to cash it in!`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[FISH ERROR]', err);
 const errMsg = { content: 'Failed to execute fishing expedition.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
