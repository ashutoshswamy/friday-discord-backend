const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bankrob')
        .setDescription('Organize a cooperative bank heist to swipe coins from another member\'s vault.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member whose bank vault you want to target')
                .setRequired(true)),

    /**
     * Executes the bankrob command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const targetUser = options.getUser('target');

        // Validation checks
        if (targetUser.id === user.id) {
            return interaction.editReply({ content: '❌ You cannot rob your own bank vault!', ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.editReply({ content: '❌ You cannot rob bot accounts!', ephemeral: true });
        }

        const cd = checkCooldown('bankrob', user.id, 120);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Bank heist is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            // Retrieve robber (host) and victim profiles
            const hostProfile = await db.getProfile(guild.id, user.id);
            const victimProfile = await db.getProfile(guild.id, targetUser.id);

            if (hostProfile.coins < 100) {
                return interaction.editReply({
                    content: '❌ You must possess at least 🪙 **100** coins in your active wallet to fund and organize a heist crew!',
                    ephemeral: true
                });
            }

            const victimBankBalance = victimProfile.bank || 0;
            if (victimBankBalance < 200) {
                return interaction.editReply({
                    content: `❌ <@${targetUser.id}>'s bank vault is practically empty! They only have 🪙 **${victimBankBalance.toLocaleString()}** coins in the bank. It isn't worth the massive risk.`,
                    ephemeral: true
                });
            }

            // Set up crew array (starting with host)
            const crew = [{ id: user.id, username: user.username, tag: user.tag }];
            let heistStarted = false;
            let heistCancelled = false;

            const lobbyEmbed = new EmbedBuilder()
                .setTitle('🚨 Cooperative Bank Heist Lobby')
                .setColor('#FF0055')
                .setDescription(
                    `🥷 <@${user.id}> is planning a massive bank heist targeting <@${targetUser.id}>'s vault!\n\n` +
                    `They need server members to join the heist crew! At least **1 accomplice** (2 crew members total) is required to execute the heist. Success chances increase with crew size.\n\n` +
                    `**Heist Crew (1):**\n• <@${user.id}> (Host)\n\n` +
                    `*Click the button below to join the crew! Requires 🪙 100 coins in your wallet in case you get caught.*`
                )
                .setFooter({ text: 'Lobby expires in 30 seconds' })
                .setTimestamp();

            const joinButton = new ButtonBuilder()
                .setCustomId('heist_join')
                .setLabel('🔥 Join Heist Crew')
                .setStyle(ButtonStyle.Primary);

            const startButton = new ButtonBuilder()
                .setCustomId('heist_start')
                .setLabel('🚀 Start Robbery')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('heist_cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(joinButton, startButton, cancelButton);

            const response = await interaction.editReply({
                embeds: [lobbyEmbed],
                components: [row]
            });

            // Spawns interaction component collector
            const collector = response.createMessageComponentCollector({
                filter: i => i.guildId === guild.id,
                time: 30000
            });

            collector.on('collect', async i => {
                const clicker = i.user;

                // A. Join Button Click
                if (i.customId === 'heist_join') {
                    if (clicker.bot) return i.reply({ content: '🤖 Bots cannot join heists.', ephemeral: true });
                    if (clicker.id === targetUser.id) return i.reply({ content: '❌ You cannot join a robbery against your own vault!', ephemeral: true });

                    if (crew.some(member => member.id === clicker.id)) {
                        return i.reply({ content: 'ℹ️ You are already part of this heist crew!', ephemeral: true });
                    }

                    try {
                        const clickerProfile = await db.getProfile(guild.id, clicker.id);
                        if (clickerProfile.coins < 100) {
                            return i.reply({
                                content: `❌ You need at least 🪙 **100** coins in your active wallet to join this high-risk heist! (Current: 🪙 ${clickerProfile.coins.toLocaleString()})`,
                                ephemeral: true
                            });
                        }

                        // Add to crew
                        crew.push({ id: clicker.id, username: clicker.username, tag: clicker.tag });

                        // Update lobby embed
                        const crewList = crew.map((member, idx) => `• <@${member.id}>${idx === 0 ? ' (Host)' : ''}`).join('\n');
                        lobbyEmbed.setDescription(
                            `🥷 <@${user.id}> is planning a massive bank heist targeting <@${targetUser.id}>'s vault!\n\n` +
                            `They need server members to join the heist crew! At least **1 accomplice** (2 crew members total) is required to execute the heist. Success chances increase with crew size.\n\n` +
                            `**Heist Crew (${crew.length}):**\n${crewList}\n\n` +
                            `*Click the button below to join the crew! Requires 🪙 100 coins in your wallet in case you get caught.*`
                        );

                        await i.update({ embeds: [lobbyEmbed] });
                    } catch (err) {
                        console.error('[HEIST JOIN ERROR]', err);
                        await i.reply({ content: '❌ Failed to register you into the heist.', ephemeral: true });
                    }
                }

                // B. Start Button Click (Host Only)
                else if (i.customId === 'heist_start') {
                    if (clicker.id !== user.id) {
                        return i.reply({ content: '❌ Only the heist host can start the robbery!', ephemeral: true });
                    }

                    if (crew.length < 2) {
                        return i.reply({
                            content: '❌ You need at least **1 accomplice** (2 crew members total) to launch a cooperative bank robbery!',
                            ephemeral: true
                        });
                    }

                    heistStarted = true;
                    collector.stop('start');
                }

                // C. Cancel Button Click (Host Only)
                else if (i.customId === 'heist_cancel') {
                    if (clicker.id !== user.id) {
                        return i.reply({ content: '❌ Only the heist host can cancel the robbery!', ephemeral: true });
                    }

                    heistCancelled = true;
                    collector.stop('cancel');
                }
            });

            collector.on('end', async (collected, reason) => {
                // Remove components
                await interaction.editReply({ components: [] }).catch(() => null);

                if (heistCancelled || reason === 'cancel') {
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('🚨 Heist Aborted')
                        .setColor('#9CA3AF')
                        .setDescription(`❌ <@${user.id}> decided to call off the bank heist. The crew disbanded safely.`);
                    return interaction.followUp({ embeds: [cancelEmbed] });
                }

                // Auto-start if time expires and crew requirements are met
                const canExecute = crew.length >= 2;

                if (!heistStarted && reason === 'time' && !canExecute) {
                    const failLobbyEmbed = new EmbedBuilder()
                        .setTitle('🚨 Heist Aborted - No Accomplices')
                        .setColor('#9CA3AF')
                        .setDescription(`❌ Not enough accomplices joined the crew in time. The vault raid was called off.`);
                    return interaction.followUp({ embeds: [failLobbyEmbed] });
                }

                // Execute robbery!
                const crewSize = crew.length;
                let successChance = 0.35; // 2 crew members = 35%
                if (crewSize === 3) successChance = 0.50; // 3 crew members = 50%
                if (crewSize >= 4) successChance = 0.65; // 4+ crew members = 65%

                const isSuccess = Math.random() < successChance;
                const resultEmbed = new EmbedBuilder().setTimestamp();

                // Re-fetch profiles to ensure balances haven't changed during lobby wait
                const latestVictim = await db.getProfile(guild.id, targetUser.id);
                const latestVictimBank = latestVictim.bank || 0;

                if (isSuccess) {
                    // Success! Calculate loot (20% to 50% of victim's bank balance, capped at 15000)
                    const pct = Math.floor(Math.random() * 31) + 20; // 20 to 50
                    let stolenAmount = Math.floor(latestVictimBank * (pct / 100));
                    stolenAmount = Math.max(100, Math.min(stolenAmount, 15000));

                    // Distribute loot equally among crew members
                    const splitAmount = Math.floor(stolenAmount / crewSize);

                    // Perform transactions
                    await db.updateBank(guild.id, targetUser.id, -stolenAmount);
                    for (const member of crew) {
                        await db.updateCoins(guild.id, member.id, splitAmount);
                    }

                    const crewPings = crew.map(member => `<@${member.id}>`).join(', ');

                    resultEmbed.setTitle('🔥 VAULT BREACHED!')
                        .setColor('#00FF66')
                        .setDescription(
                            `🏆 **Heist Success!**\n\n` +
                            `The crew successfully infiltrated <@${targetUser.id}>'s bank vault and bypassed their security sensors!\n` +
                            `They managed to extract **🪙 ${stolenAmount.toLocaleString()}** coins from the bank vault.\n\n` +
                            `**Loot Split (${crewSize} crew members):**\n` +
                            `Each crew member receives **🪙 ${splitAmount.toLocaleString()}** coins directly in their wallet!\n\n` +
                            `**Accomplices:**\n${crewPings}`
                        )
                        .addFields(
                            { name: 'Target Loss', value: `🏦 **-${stolenAmount.toLocaleString()}** bank coins`, inline: true },
                            { name: 'Split share', value: `🪙 **+${splitAmount.toLocaleString()}** per thief`, inline: true }
                        );

                    return interaction.followUp({ embeds: [resultEmbed] });

                } else {
                    // Caught! Fines paid to the victim as compensation
                    const fineList = [];
                    let totalCompensation = 0;

                    for (const member of crew) {
                        const mProfile = await db.getProfile(guild.id, member.id);
                        // Fine is 10% of robber's wallet balance, min 100, max 2000
                        let fine = Math.floor(mProfile.coins * 0.10);
                        fine = Math.max(100, Math.min(fine, 2000));

                        // Perform transactions
                        await db.updateCoins(guild.id, member.id, -fine);
                        totalCompensation += fine;

                        fineList.push(`• <@${member.id}>: fined **🪙 ${fine.toLocaleString()}** coins`);
                    }

                    // Compensate victim's active wallet
                    await db.updateCoins(guild.id, targetUser.id, totalCompensation);

                    resultEmbed.setTitle('🚨 VAULT ALARMS TRIGGERED!')
                        .setColor('#FF3333')
                        .setDescription(
                            `👮 **BUSTED!**\n\n` +
                            `The crew triggered laser grids inside <@${targetUser.id}>'s bank vault and were captured by local security!\n` +
                            `Every crew member has been heavily fined, and all collected fines were paid directly to <@${targetUser.id}>'s wallet as compensation.\n\n` +
                            `**Crew Fines:**\n${fineList.join('\n')}\n\n` +
                            `**Total Compensated to Victim Wallet:**\n🪙 **+${totalCompensation.toLocaleString()}** coins`
                        );

                    return interaction.followUp({ embeds: [resultEmbed] });
                }
            });

        } catch (err) {
            console.error('[BANKROB ERROR]', err);
            const _errMsg = { content: '❌ Failed to initiate heist vault sensors. Please check project database config.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
