const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to syphon coins from another member\'s wallet.')
        .addUserOption(opt => 
            opt.setName('target')
                .setDescription('The member you want to rob')
                .setRequired(true)),

    /**
     * Executes the rob command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const targetUser = options.getUser('target');

        if (targetUser.id === user.id) {
            return interaction.editReply({ content: '❌ You cannot rob yourself!', ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.editReply({ content: '❌ You cannot rob bot accounts!', ephemeral: true });
        }

        const cd = checkCooldown('rob', user.id, 60);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `⏳ Rob is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            // Retrieve both profiles
            const robberProfile = await db.getProfile(guild.id, user.id);
            const victimProfile = await db.getProfile(guild.id, targetUser.id);

            if (robberProfile.coins < 100) {
                return interaction.editReply({
                    content: '❌ You must possess at least 🪙 **100** coins to plan a heist (in case you get caught and fined)!',
                    ephemeral: true
                });
            }

            if (victimProfile.coins < 50) {
                return interaction.editReply({
                    content: `❌ <@${targetUser.id}> is practically broke! They only have 🪙 **${victimProfile.coins}** coins. It isn't worth the risk.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder().setTimestamp();

            // Check if the victim has a guard pet that defends them!
            const victimPet = await db.getPet(guild.id, targetUser.id);
            if (victimPet && victimPet.hunger > 10) { // Pet needs some food energy to defend!
                // Base 10% defense chance + 1.5% for every point of Defense, capped at 50%
                const defendChance = Math.min(0.50, 0.10 + (victimPet.defense * 0.015));
                
                if (Math.random() < defendChance) {
                    // Guard pet bites the robber! Heist fails!
                    let fineAmount = Math.floor(robberProfile.coins * 0.15);
                    fineAmount = Math.max(100, Math.min(fineAmount, 2000));

                    // Perform compensation transaction
                    await db.updateCoins(guild.id, user.id, -fineAmount);
                    await db.updateCoins(guild.id, targetUser.id, fineAmount);

                    embed.setTitle('🐕 GUARD PET DEFENDED!')
                        .setColor('#FF3333')
                        .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                        .setDescription(
                            `You sneaked up to rob <@${targetUser.id}>, but their loyal guard pet **${victimPet.name}** (${victimPet.type}) caught your scent!\n` +
                            `The pet barked fiercely and bit your ankle, forcing you to retreat!\n\n` +
                            `You paid **🪙 ${fineAmount.toLocaleString()} coins** directly to <@${targetUser.id}> for medical damages.`
                        )
                        .addFields(
                            { name: 'Caught By', value: `🐾 **${victimPet.name}** (Lv. ${victimPet.level})`, inline: true },
                            { name: 'Compensation Paid', value: `🪙 **-${fineAmount.toLocaleString()}** coins`, inline: true }
                        );

                    return interaction.editReply({ embeds: [embed] });
                }
            }

            const isSuccess = Math.random() < 0.45; // 45% success chance

            if (isSuccess) {
                // Steal 10% to 30% of victim's coins, capped at 5000
                const pct = Math.floor(Math.random() * 21) + 10; // 10 to 30
                let stolenAmount = Math.floor(victimProfile.coins * (pct / 100));
                stolenAmount = Math.max(10, Math.min(stolenAmount, 5000));

                // Perform transaction
                await db.updateCoins(guild.id, user.id, stolenAmount);
                await db.updateCoins(guild.id, targetUser.id, -stolenAmount);

                embed.setTitle('🥷 Successful Heist!')
                    .setColor('#00FF66')
                    .setDescription(
                        `You successfully infiltrated <@${targetUser.id}>'s vault!\n` +
                        `You managed to escape with **🪙 ${stolenAmount.toLocaleString()}** coins!`
                    )
                    .addFields(
                        { name: 'Stolen Loot', value: `🪙 **+${stolenAmount}** coins`, inline: true },
                        { name: 'Victim Loss', value: `🪙 **-${stolenAmount}** coins`, inline: true }
                    );
            } else {
                // Caught! Pay a fine directly to the victim
                // Fine is 15% to 25% of robber's coins, capped at 2500
                const pct = Math.floor(Math.random() * 11) + 15; // 15 to 25
                let fineAmount = Math.floor(robberProfile.coins * (pct / 100));
                fineAmount = Math.max(50, Math.min(fineAmount, 2500));

                // Perform transaction
                await db.updateCoins(guild.id, user.id, -fineAmount);
                await db.updateCoins(guild.id, targetUser.id, fineAmount);

                embed.setTitle('🚨 BUSTED!')
                    .setColor('#FF3333')
                    .setDescription(
                        `You were caught red-handed attempting to rob <@${targetUser.id}>!\n` +
                        `The local guard fined you **🪙 ${fineAmount.toLocaleString()}** coins, which was paid directly to the victim.`
                    )
                    .addFields(
                        { name: 'Fine Paid', value: `🪙 **-${fineAmount}** coins`, inline: true },
                        { name: 'Victim Compensated', value: `🪙 **+${fineAmount}** coins`, inline: true }
                    );
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[ROB ERROR]', err);
            const _errMsg = { content: '❌ Failed to process Rob transaction.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
