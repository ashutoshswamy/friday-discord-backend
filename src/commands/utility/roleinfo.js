const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Displays detailed information and metadata about a server role.')
        .addRoleOption(opt => 
            opt.setName('role')
                .setDescription('The role you want to inspect')
                .setRequired(true)),

    /**
     * Executes the roleinfo command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options } = interaction;
        if (!guild) return;

        const role = options.getRole('role');

        try {
            // Find active role in cache
            const targetRole = guild.roles.cache.get(role.id);
            if (!targetRole) {
                return interaction.editReply({ content: '❌ Failed to find the specified role in this server.', ephemeral: true });
            }

            const membersCount = targetRole.members.size;
            const createdUnix = Math.floor(targetRole.createdTimestamp / 1000);

            // Fetch key permissions to display in embed
            const keyPermissions = [];
            if (targetRole.permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
            if (targetRole.permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
            if (targetRole.permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
            if (targetRole.permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
            if (targetRole.permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
            if (targetRole.permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
            if (targetRole.permissions.has(PermissionFlagsBits.MentionEveryone)) keyPermissions.push('Mention Everyone');

            const permissionsDisplay = keyPermissions.length > 0 
                ? keyPermissions.map(p => `\`${p}\``).join(', ') 
                : '`None (Standard Member Permissions)`';

            const embed = new EmbedBuilder()
                .setTitle(`🎭 Role Profile: ${targetRole.name}`)
                .setColor(targetRole.hexColor === '#000000' ? '#71717a' : targetRole.hexColor)
                .setTimestamp()
                .addFields(
                    { name: 'Role Name', value: `${targetRole}`, inline: true },
                    { name: 'Role ID', value: `\`${targetRole.id}\``, inline: true },
                    { name: 'Color Hex', value: `\`${targetRole.hexColor}\``, inline: true },
                    { name: 'Position Rank', value: `${targetRole.position} / ${guild.roles.cache.size}`, inline: true },
                    { name: 'Members Count', value: `👤 **${membersCount}** members`, inline: true },
                    { name: 'Hoisted (Separated)', value: targetRole.hoist ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Mentionable', value: targetRole.mentionable ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Created At', value: `<t:${createdUnix}:F> (<t:${createdUnix}:R>)`, inline: false },
                    { name: 'Key Permissions Keys', value: permissionsDisplay, inline: false }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ROLEINFO ERROR]', err);
            const _errMsg = { content: '❌ Failed to fetch role information.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
