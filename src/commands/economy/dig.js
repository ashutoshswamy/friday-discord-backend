const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

// Cooldown map: userId -> timestamp
const cooldowns = new Map();

const DIG_CHANCES = [
    { name: "Common Worm", chance: 0.40, msg: "🪱 You dug in the mud and found a wriggling **Common Worm**." },
    { name: "Dirt Fossil", chance: 0.70, msg: "🦴 You hit something hard! You excavated a petrified **Dirt Fossil**!" },
    { name: "Ancient Vase", chance: 0.90, msg: "🏺 Spectacular! You uncovered a dusty, intact **Ancient Vase** from an old ruin!" },
    { name: "Buried Gold Chest", chance: 1.00, msg: "👑 **JACKPOT!** You struck gold and excavated a locked **Buried Gold Chest**!" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dig')
        .setDescription('Dig in the dirt for buried treasure. Requires purchasing a Shovel from the shop.'),

    /**
     * Executes the dig command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        // 45 seconds cooldown check
        const now = Date.now();
        const cooldownMs = 45 * 1000;
        const userCooldown = cooldowns.get(user.id);

        if (userCooldown && (now - userCooldown < cooldownMs)) {
            const timeLeft = Math.ceil((cooldownMs - (now - userCooldown)) / 1000);
            return interaction.editReply({
                content: `⏳ Rest your back! You must wait **${timeLeft}s** before digging again.`,
                ephemeral: true
            });
        }

        try {
            // Verify if user possesses a Shovel
            const inventory = await db.getInventory(guild.id, user.id);
            const hasShovel = inventory.some(item => item.toLowerCase() === 'shovel');

            if (!hasShovel) {
                return interaction.editReply({
                    content: '❌ You do not possess a **Shovel**! Purchase one from the virtual shop first using `/buy`.',
                    ephemeral: true
                });
            }

            // Apply cooldown
            cooldowns.set(user.id, now);

            // Roll loot
            const roll = Math.random();
            const reward = DIG_CHANCES.find(loot => roll <= loot.chance);

            // Save to inventory
            await db.addItemToInventory(guild.id, user.id, reward.name);

            const embed = new EmbedBuilder()
                .setTitle('⛏️ Scavenge Excavation')
                .setColor('#FF8C00')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(reward.msg)
                .addFields({
                    name: '📦 Excavation Stored',
                    value: `Added **${reward.name}** to your inventory (Use \`/sell\` to cash it in!)`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[DIG ERROR]', err);
            const _errMsg = { content: '❌ Failed to execute excavation dig.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
