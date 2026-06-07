const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const cooldowns = new Map();

const LOOT_CHANCES = [
 { name: "Rabbit",       chance: 0.28, msg: " You tracked a swift **Rabbit** and took a clean shot!" },
 { name: "Eagle Feather",chance: 0.42, msg: " A golden eagle soared overhead — you plucked a prized **Eagle Feather** from the ground!" },
 { name: "Duck",         chance: 0.60, msg: " You aimed at the skies and brought down a wild mallard **Duck**!" },
 { name: "Deer",         chance: 0.75, msg: " You patiently waited in a tree stand and successfully harvested a large **Deer**!" },
 { name: "Deer Antler",  chance: 0.84, msg: " You found a massive shed **Deer Antler** half-buried in the undergrowth!" },
 { name: "Wild Boar",    chance: 0.92, msg: " You cornered a defensive **Wild Boar** and securely captured it!" },
 { name: "Wolf Pelt",    chance: 0.97, msg: " A lone wolf crossed your path — you claimed its prized **Wolf Pelt**!" },
 { name: "Grizzly Bear", chance: 0.993, msg: " **HOLY SHIT!** You successfully hunted a massive **Grizzly Bear**!" },
 { name: "Dragon Scale", chance: 1.00, msg: " **LEGENDARY!** A mythical beast appeared from the shadows — you snatched a glowing **Dragon Scale**!" }
];

module.exports = {
 data: new SlashCommandBuilder()
 .setName('hunt')
 .setDescription('Go hunting in the virtual woods. Requires purchasing a Hunting Rifle from the shop.'),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 const now = Date.now();
 const cooldownMs = 60 * 1000;
 const userCooldown = cooldowns.get(user.id);

 if (userCooldown && (now - userCooldown < cooldownMs)) {
 const timeLeft = Math.ceil((cooldownMs - (now - userCooldown)) / 1000);
 return interaction.editReply({ content: `You are too tired to trek! Wait **${timeLeft}s** before hunting again.`, ephemeral: true });
 }

 try {
 const inventory = await db.getInventory(guild.id, user.id);
 const hasRifle = inventory.some(item => item.toLowerCase() === 'hunting rifle');

 if (!hasRifle) {
 return interaction.editReply({ content: 'You do not possess a **Hunting Rifle**! Purchase one from the virtual shop first using `/buy`.', ephemeral: true });
 }

 cooldowns.set(user.id, now);

 const roll = Math.random();
 const reward = LOOT_CHANCES.find(loot => roll <= loot.chance);
 await db.addItemToInventory(guild.id, user.id, reward.name);

 const container = new ContainerBuilder()
 .setAccentColor(0xF5A623)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Hunting Expedition\n${reward.msg}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Loot Acquired:**Added **${reward.name}** to your inventory\n` +
 `-# Use \`/sell\` to cash it in!`
 )
 );

 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

 } catch (err) {
 console.error('[HUNT ERROR]', err);
 const errMsg = { content: 'Failed to execute hunting expedition.', ephemeral: true };
 if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
 else await interaction.editReply(errMsg).catch(() => null);
 }
 }
};
