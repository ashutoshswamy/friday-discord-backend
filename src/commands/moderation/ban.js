const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server and deletes their recent message history.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for banning this user')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days of message history to delete (0-7 days)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days = interaction.options.getInteger('days') || 0;
        const { guild, user } = interaction;

        if (!guild) return;

        if (targetUser.id === user.id) {
            return interaction.editReply({ content: '❌ You cannot ban yourself.', ephemeral: true });
        }

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (targetMember) {
            if (!targetMember.bannable) {
                return interaction.editReply({
                    content: '❌ I cannot ban this user — they may outrank me or I lack permission.',
                    ephemeral: true
                });
            }

            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
                return interaction.editReply({
                    content: '❌ You cannot ban this user — they have an equal or higher role.',
                    ephemeral: true
                });
            }
        }

        const confirmBtn = new ButtonBuilder()
            .setCustomId('ban_confirm')
            .setLabel('🔨 Confirm Ban')
            .setStyle(ButtonStyle.Danger);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('ban_cancel')
            .setLabel('✕ Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Ban')
            .setColor('#FF0000')
            .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
            .setDescription(`You are about to **permanently ban** <@${targetUser.id}> from **${guild.name}**.`)
            .addFields(
                { name: 'User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                { name: 'Delete Messages', value: `${days} day(s)`, inline: true },
                { name: 'Reason', value: reason }
            )
            .setFooter({ text: 'This action cannot be easily undone. Confirm within 30 seconds.' });

        const response = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 30000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'ban_cancel') {
                return i.update({
                    content: '✅ Ban cancelled.',
                    embeds: [],
                    components: []
                });
            }

            try {
                const deleteMessageSeconds = days * 24 * 60 * 60;
                await guild.members.ban(targetUser.id, {
                    deleteMessageSeconds,
                    reason: `${reason} | Banned by ${user.tag}`
                });

                await db.logInfraction(guild.id, targetUser.id, user.id, 'BAN', reason);

                const embed = new EmbedBuilder()
                    .setTitle('🔨 User Banned')
                    .setColor('#FF0000')
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                    .setDescription(`**${targetUser.tag}** has been permanently banned from **${guild.name}**.`)
                    .addFields(
                        { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                        { name: 'Moderator', value: `<@${user.id}>`, inline: true },
                        { name: 'Deleted Messages', value: `${days} day(s)`, inline: true },
                        { name: 'Reason', value: reason }
                    )
                    .setTimestamp();

                await i.update({ embeds: [embed], components: [] });
            } catch (err) {
                console.error('[ERROR] Ban failed:', err);
                await i.update({
                    content: '❌ Failed to ban this user. Verify my role has the Ban Members permission.',
                    embeds: [],
                    components: []
                });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                await interaction.editReply({
                    content: '⏰ Confirmation timed out. Ban cancelled.',
                    embeds: [],
                    components: []
                }).catch(() => null);
            }
        });
    }
};
