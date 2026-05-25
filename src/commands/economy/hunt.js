const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

// Cooldown map: userId -> timestamp
const cooldowns = new Map();

const LOOT_CHANCES = [
    { name: "Rabbit", chance: 0.35, msg: "🐇 You tracked a swift **Rabbit** and took a clean shot!" },
    { name: "Duck", chance: 0.70, msg: "🦆 You aimed at the skies and brought down a wild mallard **Duck**!" },
    { name: "Deer", chance: 0.88, msg: "🦌 You patiently waited in a tree stand and successfully harvested a large **Deer**!" },
    { name: "Wild Boar", chance: 0.97, msg: "🐗 You cornered a defensive **Wild Boar** and securely captured it!" },
    { name: "Grizzly Bear", chance: 1.00, msg: "🐻 **HOLY SHIT!** You successfully hunted a massive **Grizzly Bear**!" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunt')
        .setDescription('Go hunting in the virtual woods. Requires purchasing a Hunting Rifle from the shop.'),

    /**
     * Executes the hunt command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        // 60 seconds cooldown check
        const now = Date.now();
        const cooldownMs = 60 * 1000;
        const userCooldown = cooldowns.get(user.id);

        if (userCooldown && (now - userCooldown < cooldownMs)) {
            const timeLeft = Math.ceil((cooldownMs - (now - userCooldown)) / 1000);
            return interaction.editReply({
                content: `⏳ You are too tired to trek! You must wait **${timeLeft}s** before going hunting again.`,
                ephemeral: true
            });
        }

        try {
            // Verify if user possesses a Hunting Rifle
            const inventory = await db.getInventory(guild.id, user.id);
            const hasRifle = inventory.some(item => item.toLowerCase() === 'hunting rifle');

            if (!hasRifle) {
                return interaction.editReply({
                    content: '❌ You do not possess a **Hunting Rifle**! Purchase one from the virtual shop first using `/buy`.',
                    ephemeral: true
                });
            }

            // Apply cooldown
            cooldowns.set(user.id, now);

            // Roll loot
            const roll = Math.random();
            const reward = LOOT_CHANCES.find(loot => roll <= loot.chance);

            // Save to inventory
            await db.addItemToInventory(guild.id, user.id, reward.name);

            const embed = new EmbedBuilder()
                .setTitle('🌲 Hunting Expedition')
                .setColor('#F5A623')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(reward.msg)
                .addFields({
                    name: '📦 Loot Acquired',
                    value: `Added **${reward.name}** to your inventory (Use \`/sell\` to cash it in!)`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[HUNT ERROR]', err);
            const _errMsg = { content: '❌ Failed to execute hunting expedition.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
