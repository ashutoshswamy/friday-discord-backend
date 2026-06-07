const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server and deletes their recent message history.')
        .addUserOption(option =>
            option.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption(option =>
            option.setName('reason').setDescription('The reason for banning this user').setRequired(false))
        .addIntegerOption(option =>
            option.setName('days').setDescription('Number of days of message history to delete (0-7 days)').setMinValue(0).setMaxValue(7).setRequired(false))
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
                return interaction.editReply({ content: '❌ I cannot ban this user — they may outrank me or I lack permission.', ephemeral: true });
            }
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && guild.ownerId !== user.id) {
                return interaction.editReply({ content: '❌ You cannot ban this user — they have an equal or higher role.', ephemeral: true });
            }
        }

        const confirmBtn = new ButtonBuilder().setCustomId('ban_confirm').setLabel('🔨 Confirm Ban').setStyle(ButtonStyle.Danger);
        const cancelBtn = new ButtonBuilder().setCustomId('ban_cancel').setLabel('✕ Cancel').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const confirmContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ⚠️ Confirm Ban\nYou are about to **permanently ban** <@${targetUser.id}> from **${guild.name}**.`
                        )
                    )
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**User:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                    `**Delete Messages:** ${days} day(s)\n` +
                    `**Reason:** ${reason}`
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# This action cannot be easily undone. Confirm within 30 seconds.`))
            .addActionRowComponents(row);

        const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer] });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 30000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'ban_cancel') {
                return i.update({ content: '✅ Ban cancelled.', flags: MessageFlags.IsComponentsV2, components: [] });
            }

            try {
                const deleteMessageSeconds = days * 24 * 60 * 60;
                await guild.members.ban(targetUser.id, { deleteMessageSeconds, reason: `${reason} | Banned by ${user.tag}` });
                await db.logInfraction(guild.id, targetUser.id, user.id, 'BAN', reason);

                const bannedContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## 🔨 User Banned\n**${targetUser.tag}** has been permanently banned from **${guild.name}**.`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**User ID:** \`${targetUser.id}\`\n` +
                            `**Moderator:** <@${user.id}>\n` +
                            `**Deleted Messages:** ${days} day(s)\n` +
                            `**Reason:** ${reason}`
                        )
                    );

                await i.update({ flags: MessageFlags.IsComponentsV2, components: [bannedContainer] });
            } catch (err) {
                console.error('[ERROR] Ban failed:', err);
                await i.update({ content: '❌ Failed to ban this user. Verify my role has the Ban Members permission.', flags: MessageFlags.IsComponentsV2, components: [] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                await interaction.editReply({ content: '⏰ Confirmation timed out. Ban cancelled.', flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);
            }
        });
    }
};
