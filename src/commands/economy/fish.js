const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

// Cooldown map: userId -> timestamp
const cooldowns = new Map();

const FISH_CHANCES = [
    { name: "Junk Seaweed", chance: 0.05, msg: "🌿 You reeled in... some slimy **Junk Seaweed**. Yuck." },
    { name: "Old Boot", chance: 0.08, msg: "🥾 You fought a heavy pull, only to land a waterlogged **Old Boot**." },
    { name: "Common Bass", chance: 0.43, msg: "🐟 Nice catch! You reeled in a standard **Common Bass**." },
    { name: "Salmon", chance: 0.73, msg: "🐠 Beautiful! You caught a healthy pink **Salmon**!" },
    { name: "Goldfish", chance: 0.90, msg: "🥇 Rare catch! You hooked a shining **Goldfish**!" },
    { name: "Tropical Coral Fish", chance: 0.98, msg: "🐡 Spectacular! You netted a vibrant, highly exotic **Tropical Coral Fish**!" },
    { name: "Mythical Whale", chance: 1.00, msg: "🐋 **UNBELIEVABLE!** You hooked and reeled in a leviathan **Mythical Whale**!" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing in the virtual lake. Requires purchasing a Fishing Pole from the shop.'),

    /**
     * Executes the fish command.
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
                content: `⏳ Do not scare the fish! You must wait **${timeLeft}s** before casting your line again.`,
                ephemeral: true
            });
        }

        try {
            // Verify if user possesses a Fishing Pole
            const inventory = await db.getInventory(guild.id, user.id);
            const hasPole = inventory.some(item => item.toLowerCase() === 'fishing pole');

            if (!hasPole) {
                return interaction.editReply({
                    content: '❌ You do not possess a **Fishing Pole**! Purchase one from the virtual shop first using `/buy`.',
                    ephemeral: true
                });
            }

            // Apply cooldown
            cooldowns.set(user.id, now);

            // Roll loot
            const roll = Math.random();
            const reward = FISH_CHANCES.find(loot => roll <= loot.chance);

            // Save to inventory
            await db.addItemToInventory(guild.id, user.id, reward.name);

            const embed = new EmbedBuilder()
                .setTitle('🌊 Virtual Lake Fishing')
                .setColor('#00E5FF')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(reward.msg)
                .addFields({
                    name: '📦 Catch Stored',
                    value: `Added **${reward.name}** to your inventory (Use \`/sell\` to cash it in!)`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[FISH ERROR]', err);
            const _errMsg = { content: '❌ Failed to execute fishing expedition.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
