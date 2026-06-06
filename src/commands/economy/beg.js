const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

// Cooldown map: userId -> timestamp
const cooldowns = new Map();

const BEG_RESPONSES = [
    "A kind stranger threw 🪙 **{amount}** coins at you.",
    "A generous businessman noticed you shivering in the cold and handed you 🪙 **{amount}** coins.",
    "You found a lost wallet on the floor containing 🪙 **{amount}** coins! Nobody was looking.",
    "An old grandma felt bad and gave you 🪙 **{amount}** coins for some candy.",
    "You played a terrible song on a cardboard guitar and somehow raised 🪙 **{amount}** coins.",
    "A rich streamer walked past and dropped 🪙 **{amount}** coins on your head.",
    "You dug in a garbage bin and found 🪙 **{amount}** coins under a soggy newspaper."
];

const BEG_ITEMS = [
    "Common Worm",
    "Junk Seaweed",
    "Old Boot"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for spare change. High cooldown, small payouts, occasionally awards junk items.'),

    /**
     * Executes the beg command.
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
                content: `⏳ Keep your dignity! You must wait **${timeLeft}s** before begging again.`,
                ephemeral: true
            });
        }

        try {
            // Apply cooldown
            cooldowns.set(user.id, now);

            // Generate randomized payout: 20 to 120 coins
            const payout = Math.floor(Math.random() * 101) + 20;
            await db.updateCoins(guild.id, user.id, payout);

            // 15% chance to award a junk item
            let itemAwarded = null;
            if (Math.random() < 0.15) {
                itemAwarded = BEG_ITEMS[Math.floor(Math.random() * BEG_ITEMS.length)];
                await db.addItemToInventory(guild.id, user.id, itemAwarded);
            }

            // Construct response text
            const baseText = BEG_RESPONSES[Math.floor(Math.random() * BEG_RESPONSES.length)];
            const formattedText = baseText.replace('{amount}', payout.toLocaleString());

            const embed = new EmbedBuilder()
                .setTitle('👛 Begging for Change')
                .setColor('#00E5FF')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(formattedText)
                .addFields({
                    name: 'Coins Pocketed',
                    value: `🪙 **+${payout.toLocaleString()}** coins`,
                    inline: true
                })
                .setTimestamp();

            if (itemAwarded) {
                embed.addFields({
                    name: '📦 Extra Junk item found!',
                    value: `Added **${itemAwarded}** to your inventory`,
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[BEG ERROR]', err);
            const _errMsg = { content: '❌ Failed to collect spare coins.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
