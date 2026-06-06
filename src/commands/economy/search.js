const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const db = require('../../utils/db');

// Cooldown map: userId -> timestamp
const cooldowns = new Map();

const LOCATIONS_POOL = [
    { name: "Couch Cushions", icon: "🛋️" },
    { name: "City Sewer", icon: "🕳️" },
    { name: "Car Glovebox", icon: "🚗" },
    { name: "Old Dresser", icon: "🗄️" },
    { name: "Dark Alleyway", icon: "🛣️" },
    { name: "Coat Pocket", icon: "🧥" },
    { name: "Dog House", icon: "🐕" },
    { name: "Abandoned Locker", icon: "🔒" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Presents 3 locations to search for coins and items. High risk of finding nothing or losing coins.'),

    /**
     * Executes the search command.
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
                content: `⏳ Be patient! You need to wait **${timeLeft}s** before searching for loot again.`,
                ephemeral: true
            });
        }

        try {
            // Apply cooldown immediately
            cooldowns.set(user.id, now);

            // Select 3 random unique locations from the pool
            const shuffled = [...LOCATIONS_POOL].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 3);

            const lobbyEmbed = new EmbedBuilder()
                .setTitle('🔍 Active Search & Scavenge')
                .setColor('#00E5FF')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(
                    `Where would you like to search? Click one of the buttons below to investigate!\n` +
                    `*Be careful! Scavenging in dark places can sometimes lead to finding nothing or losing coins.*`
                )
                .setFooter({ text: 'Select a location within 15 seconds' });

            const row = new ActionRowBuilder();
            selected.forEach((loc, idx) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`search_${idx}_${loc.name.toLowerCase().replace(/ /g, '_')}`)
                        .setLabel(`${loc.icon} ${loc.name}`)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            const response = await interaction.editReply({
                embeds: [lobbyEmbed],
                components: [row]
            });

            // Spawns button collector
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 15000,
                max: 1
            });

            collector.on('collect', async i => {
                const clickedCustomId = i.customId;
                const idxStr = clickedCustomId.split('_')[1];
                const locObj = selected[parseInt(idxStr)];

                const roll = Math.random();
                const resultEmbed = new EmbedBuilder().setTimestamp();

                // 40% chance: Find coins (150 to 500)
                if (roll < 0.40) {
                    const coinGain = Math.floor(Math.random() * 351) + 150; // 150 to 500
                    await db.updateCoins(guild.id, user.id, coinGain);

                    resultEmbed.setTitle(`🔍 Searched: ${locObj.name}`)
                        .setColor('#00FF66')
                        .setDescription(
                            `✨ **Bingo!**\n` +
                            `You carefully searched the **${locObj.name}** and found a stash of spare coins!\n` +
                            `You added **🪙 ${coinGain.toLocaleString()} coins** to your active wallet.`
                        );
                }
                // 20% chance: Find a rare collectible item!
                else if (roll < 0.60) {
                    const items = ["Silver Ring", "Common Worm", "Lootbox"];
                    const foundItem = items[Math.floor(Math.random() * items.length)];
                    await db.addItemToInventory(guild.id, user.id, foundItem);

                    resultEmbed.setTitle(`🔍 Searched: ${locObj.name}`)
                        .setColor('#00FFCC')
                        .setDescription(
                            `📦 **Loot Extracted!**\n` +
                            `You reached deep into the **${locObj.name}** and pulled out a solid collectible:\n\n` +
                            `🎁 **${foundItem}** has been added directly to your inventory!`
                        );
                }
                // 30% chance: Nothing found
                else if (roll < 0.90) {
                    resultEmbed.setTitle(`🔍 Searched: ${locObj.name}`)
                        .setColor('#9CA3AF')
                        .setDescription(
                            `💨 **Empty...**\n` +
                            `You thoroughly searched the **${locObj.name}** but found nothing but dust bunnies and lint.`
                        );
                }
                // 10% chance: Lose coins (fined or hurt, 100 to 400 coins)
                else {
                    const uProfile = await db.getProfile(guild.id, user.id);
                    let coinLoss = Math.floor(Math.random() * 301) + 100; // 100 to 400
                    coinLoss = Math.min(coinLoss, uProfile.coins);

                    await db.updateCoins(guild.id, user.id, -coinLoss);

                    resultEmbed.setTitle(`🔍 Searched: ${locObj.name}`)
                        .setColor('#FF3333')
                        .setDescription(
                            `🚨 **OUCH!**\n` +
                            `While searching the **${locObj.name}**, you were bitten by a stray rat / caught by angry security!\n` +
                            `You dropped and lost **🪙 ${coinLoss.toLocaleString()} coins** while running away.`
                        );
                }

                await i.update({ embeds: [resultEmbed], components: [] });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    // Remove components on timeout
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('🔍 Search Cancelled')
                        .setColor('#9CA3AF')
                        .setDescription('❌ You took too long to choose a location. The search opportunity expired.');
                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[SEARCH ERROR]', err);
            const _errMsg = { content: '❌ Failed to execute search protocol.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
