const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issues a formal warning to a user.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for issuing this warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    /**
     * Executes the warn command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const { guild, user } = interaction;

        if (!guild) return;

        // Check if user is trying to warn themselves
        if (targetUser.id === user.id) {
            return interaction.editReply({ content: 'You cannot warn yourself!', ephemeral: true });
        }

        // Check if user is a bot
        if (targetUser.bot) {
            return interaction.editReply({ content: 'You cannot warn bot accounts!', ephemeral: true });
        }

        // Block warnings against the server owner
        if (targetUser.id === guild.ownerId) {
            return interaction.editReply({ content: 'You cannot warn the server owner.', ephemeral: true });
        }

        // Enforce role hierarchy — cannot warn someone equal or higher ranking
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (targetMember && guild.ownerId !== user.id) {
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.editReply({
                    content: 'You cannot warn this user because they have an equal or higher role than you.',
                    ephemeral: true
                });
            }
        }

        try {
            // Write warning record to our local JSON database wrapper
            const warning = await db.addWarning(guild.id, targetUser.id, user.id, reason);

            // Log infraction
            await db.logInfraction(guild.id, targetUser.id, user.id, 'WARN', reason);

            // Fetch current warn count for escalation check
            const allWarns = await db.getWarnings(guild.id, targetUser.id);
            const warnCount = allWarns.length;

            // Attempt to DM the warned user
            const dmsSent = await targetUser.send(
                `⚠️ **Warning Issued**\n` +
                `You have been formally warned in the server **${guild.name}**.\n` +
                `• **Reason:** ${reason}`
            ).then(() => true).catch(() => false);

            const embed = new EmbedBuilder()
                .setTitle('Warning Issued')
                .setColor('#FF8C00')
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setDescription(`Successfully warned **${targetUser.tag}**. (Warning #${warnCount})`)
                .addFields(
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Warning ID', value: `\`${warning.id}\``, inline: true },
                    { name: 'Moderator', value: `${user}`, inline: true },
                    { name: 'User Notified via DM', value: dmsSent ? '✅ Yes' : '❌ No (DMs closed)', inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Check all punishment escalation rules for exact threshold match
            const rules = await db.getPunishmentRules(guild.id);
            const matchingRule = rules.find(r => warnCount === r.warnThreshold);
            if (matchingRule) {
                const member = await guild.members.fetch(targetUser.id).catch(() => null);
                if (member) {
                    const escReason = `[AUTOMOD ESCALATION] Reached ${matchingRule.warnThreshold} warnings.`;
                    try {
                        if (matchingRule.punishmentType === 'TIMEOUT' && member.moderatable) {
                            await member.timeout(matchingRule.durationMs, escReason);
                            await db.logInfraction(guild.id, targetUser.id, interaction.client.user.id, 'TIMEOUT', escReason);
                        } else if (matchingRule.punishmentType === 'KICK' && member.kickable) {
                            await member.kick(escReason);
                            await db.logInfraction(guild.id, targetUser.id, interaction.client.user.id, 'KICK', escReason);
                        } else if (matchingRule.punishmentType === 'BAN' && member.bannable) {
                            await member.ban({ reason: escReason });
                            await db.logInfraction(guild.id, targetUser.id, interaction.client.user.id, 'BAN', escReason);
                        }
                    } catch (escErr) {
                        console.error('[WARN] Escalation failed:', escErr);
                    }
                }
            }
        } catch (err) {
            console.error('[ERROR] Warn failed:', err);
            const _errMsg = { content: 'An error occurred while attempting to issue this warning.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
