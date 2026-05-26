const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/db');
const { renderRankCard } = require('../../utils/renderRankCard');

module.exports = {
    noDefer: true,
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription("Displays a member's current level, XP, and rank progress.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view rank details for')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { guild } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.reply({ content: '🤖 Bots do not accumulate XP or levels!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const profile = await db.getProfile(guild.id, targetUser.id);
            if (!profile) {
                return interaction.editReply({ content: '❌ Failed to load level profile.' });
            }

            const profiles = await db.getGuildProfiles(guild.id);
            profiles.sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);
            const rankPos = profiles.findIndex(p => p.userId === targetUser.id) + 1 || '?';

            const rankConfig = await db.getRankCardConfig(guild.id).catch(() => null);
            const buffer = await renderRankCard(
                targetUser,
                profile,
                rankPos,
                rankConfig?.theme || 'cyber',
                rankConfig?.accentColor || null,
                db
            );

            const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });
            await interaction.editReply({ files: [attachment] });
        } catch (err) {
            console.error('[ERROR] Rank command failed:', err);
            await interaction.editReply({ content: '❌ An error occurred while retrieving rank statistics.' });
        }
    }
};
