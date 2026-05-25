const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Displays comprehensive profile details about a server member.')
        .addUserOption(opt => 
            opt.setName('user')
                .setDescription('The member you want to inspect (defaults to you)')
                .setRequired(false)),

    /**
     * Executes the userinfo command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user, options } = interaction;
        if (!guild) return;

        const targetUser = options.getUser('user') || user;

        try {
            // Fetch target member details
            const member = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                return interaction.editReply({ content: '❌ Could not find the specified user in this server.', ephemeral: true });
            }

            // Fetch DB profile data
            const profile = await db.getProfile(guild.id, targetUser.id);
            const warnings = await db.getWarnings(guild.id, targetUser.id);

            const createdUnix = Math.floor(targetUser.createdTimestamp / 1000);
            const joinedUnix = Math.floor(member.joinedTimestamp / 1000);

            // Fetch list of roles except everyone
            const rolesList = member.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => `${r}`)
                .join(' ');

            const embed = new EmbedBuilder()
                .setTitle(`👤 Member Profile: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ forceStatic: true }))
                .setColor(member.roles.highest.hexColor === '#000000' ? '#8b5cf6' : member.roles.highest.hexColor)
                .addFields(
                    { name: 'User Tag', value: `${targetUser}`, inline: true },
                    { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: 'Nickname', value: member.nickname ? `\`${member.nickname}\`` : '`None`', inline: true },
                    { name: 'Supabase Coins', value: `🪙 **${profile ? profile.coins.toLocaleString() : '100'}**`, inline: true },
                    { name: 'Level & XP', value: `⭐ **Level ${profile ? profile.level : '1'}** (XP: \`${profile ? profile.xp.toLocaleString() : '0'}\`)`, inline: true },
                    { name: 'Active Warnings', value: `⚠️ **${warnings.length}** warnings`, inline: true },
                    { name: 'Account Created', value: `<t:${createdUnix}:f> (<t:${createdUnix}:R>)`, inline: false },
                    { name: 'Joined Server', value: `<t:${joinedUnix}:f> (<t:${joinedUnix}:R>)`, inline: false },
                    { name: 'Roles List', value: rolesList || '`None`', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[USERINFO ERROR]', err);
            const _errMsg = { content: '❌ Failed to load user profile.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
