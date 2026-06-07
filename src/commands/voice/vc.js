const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder, MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vc')
        .setDescription('Manage your active temporary voice channel permissions.')
        .addSubcommand(sub =>
            sub.setName('lock')
                .setDescription('Locks your active voice channel so others cannot join.'))
        .addSubcommand(sub =>
            sub.setName('unlock')
                .setDescription('Unlocks your active voice channel, allowing anyone to join.'))
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Claim ownership and manager overrides of your active voice channel.')),

    async execute(interaction) {
        const { guild, member } = interaction;
        if (!guild || !member) return;

        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            return interaction.editReply({
                content: '❌ You must be connected to a voice channel to execute this command!',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'lock') {
                await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: false });

                const container = new ContainerBuilder()
                    .setAccentColor(0xFF3333)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## 🔒 Voice Channel Locked\nThe voice channel **${voiceChannel.name}** has been locked. Only whitelisted users can connect now.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (subcommand === 'unlock') {
                await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: null });

                const container = new ContainerBuilder()
                    .setAccentColor(0x00FF66)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## 🔓 Voice Channel Unlocked\nThe voice channel **${voiceChannel.name}** has been unlocked. Anyone can connect now.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (subcommand === 'claim') {
                await voiceChannel.permissionOverwrites.edit(member.id, {
                    ManageChannels: true,
                    MoveMembers: true
                });

                const container = new ContainerBuilder()
                    .setAccentColor(0xFFD700)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## 👑 Voice Channel Claimed\nYou have successfully claimed channel management rights over **${voiceChannel.name}**! You can now move members and configure settings.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

        } catch (err) {
            console.error('[VC INFRASTRUCTURE ERROR]', err);
            const _errMsg = { content: '❌ Failed to execute voice channel action.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
