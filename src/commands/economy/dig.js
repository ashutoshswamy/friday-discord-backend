const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const cooldowns = new Map();

const DIG_CHANCES = [
 { name: "Common Worm",    chance: 0.28, msg: " You dug in the mud and found a wriggling **Common Worm**." },
 { name: "Old Coin",       chance: 0.44, msg: " You brushed away dirt to reveal a weathered **Old Coin** from centuries past!" },
 { name: "Cracked Geode",  chance: 0.58, msg: " You unearthed a rough **Cracked Geode** — crystals sparkle inside!" },
 { name: "Dirt Fossil",    chance: 0.74, msg: " You hit something hard! You excavated a petrified **Dirt Fossil**!" },
 { name: "Ancient Vase",   chance: 0.88, msg: " Spectacular! You uncovered a dusty, intact **Ancient Vase** from an old ruin!" },
 { name: "Sapphire",       chance: 0.95, msg: " **GEM FOUND!** A deep blue **Sapphire** glinted beneath your blade!" },
 { name: "Ruby",           chance: 0.985, msg: " **PRECIOUS!** You struck a blood-red **Ruby** embedded in a stone vein!" },
 { name: "Diamond",        chance: 0.997, msg: " **LEGENDARY!** A flawless **Diamond** sits in the palm of your hand!" },
 { name: "Buried Gold Chest",chance: 1.00, msg: " **JACKPOT!** You struck gold and excavated a locked **Buried Gold Chest**!" }
];

module.exports = {
 data: new SlashCommandBuilder()
 .setName('dig')
 .setDescription('Dig in the dirt for buried treasure. Requires purchasing a Shovel from the shop.'),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const now = Date.now();
 const cooldownMs = 45 * 1000;
 const userCooldown = cooldowns.get(user.id);

 if (userCooldown && (now - userCooldown < cooldownMs)) {
 const timeLeft = Math.ceil((cooldownMs - (now - userCooldown)) / 1000);
 return interaction.editReply({ content: `Rest your back! Wait **${timeLeft}s** before digging again.`, ephemeral: true });
 }

 try {
 const inventory = await db.getInventory(guild.id, user.id);
 const hasShovel = inventory.some(item => item.toLowerCase() === 'shovel');

 if (!hasShovel) {
 return interaction.editReply({ content: 'You do not possess a **Shovel**! Purchase one from the virtual shop first using `/buy`.', ephemeral: true });
 }

 cooldowns.set(user.id, now);

 const roll = Math.random();
 const reward = DIG_CHANCES.find(loot => roll <= loot.chance);
 await db.addItemToInventory(guild.id, user.id, reward.name);

 const container = new ContainerBuilder()
 .setAccentColor(0xFF8C00)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Scavenge Excavation\n${reward.msg}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Excavation Stored:**Added **${reward.name}** to your inventory\n` +
 `-# Use \`/sell\` to cash it in!`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[DIG ERROR]', err);
 const errMsg = { content: 'Failed to execute excavation dig.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
