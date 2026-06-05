const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for kicking this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const { guild, user } = interaction;

        if (!guild) return;

        if (targetUser.id === user.id) {
            return interaction.editReply({ content: '❌ You cannot kick yourself.', ephemeral: true });
        }

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.editReply({ content: '❌ This user is not currently in the server.', ephemeral: true });
        }

        if (!targetMember.kickable) {
            return interaction.editReply({
                content: '❌ I cannot kick this user — they may outrank me or I lack permission.',
                ephemeral: true
            });
        }

        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
            return interaction.editReply({
                content: '❌ You cannot kick this user — they have an equal or higher role.',
                ephemeral: true
            });
        }

        const confirmBtn = new ButtonBuilder()
            .setCustomId('kick_confirm')
            .setLabel('👢 Confirm Kick')
            .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('kick_cancel')
            .setLabel('✕ Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Kick')
            .setColor('#FFA500')
            .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
            .setDescription(`You are about to **kick** <@${targetUser.id}> from **${guild.name}**.`)
            .addFields(
                { name: 'User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                { name: 'Reason', value: reason }
            )
            .setFooter({ text: 'They can rejoin with an invite. Confirm within 30 seconds.' });

        const response = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 30000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'kick_cancel') {
                return i.update({ content: '✅ Kick cancelled.', embeds: [], components: [] });
            }

            try {
                await targetMember.kick(`${reason} | Kicked by ${user.tag}`);
                await db.logInfraction(guild.id, targetUser.id, user.id, 'KICK', reason);

                const embed = new EmbedBuilder()
                    .setTitle('👢 User Kicked')
                    .setColor('#FFA500')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription(`**${targetUser.tag}** has been kicked from **${guild.name}**.`)
                    .addFields(
                        { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                        { name: 'Moderator', value: `<@${user.id}>`, inline: true },
                        { name: 'Reason', value: reason }
                    )
                    .setTimestamp();

                await i.update({ embeds: [embed], components: [] });
            } catch (err) {
                console.error('[ERROR] Kick failed:', err);
                await i.update({
                    content: '❌ Failed to kick this user. Verify my role has the Kick Members permission.',
                    embeds: [],
                    components: []
                });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                await interaction.editReply({
                    content: '⏰ Confirmation timed out. Kick cancelled.',
                    embeds: [],
                    components: []
                }).catch(() => null);
            }
        });
    }
};
