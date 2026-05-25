const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

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

    /**
     * Executes the vc command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, member } = interaction;
        if (!guild || !member) return;

        // Check if member is in a voice channel
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            return interaction.editReply({
                content: '❌ You must be connected to a voice channel to execute this command!',
                ephemeral: true
            });
        }

        const subcommand = options = interaction.options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: lock
            // ------------------------------------------
            if (subcommand === 'lock') {
                // Deny @everyone Connect permission
                await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
                    Connect: false
                });

                const embed = new EmbedBuilder()
                    .setTitle('🔒 Voice Channel Locked')
                    .setColor('#FF3333')
                    .setDescription(`The voice channel **${voiceChannel.name}** has been locked. Only whitelisted users can connect now.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // B. Subcommand: unlock
            // ------------------------------------------
            if (subcommand === 'unlock') {
                // Reset @everyone Connect permission
                await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
                    Connect: null
                });

                const embed = new EmbedBuilder()
                    .setTitle('🔓 Voice Channel Unlocked')
                    .setColor('#00FF66')
                    .setDescription(`The voice channel **${voiceChannel.name}** has been unlocked. Anyone can connect now.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // C. Subcommand: claim
            // ------------------------------------------
            if (subcommand === 'claim') {
                // Grant executing user Manage Channel override
                await voiceChannel.permissionOverwrites.edit(member.id, {
                    ManageChannels: true,
                    MoveMembers: true
                });

                const embed = new EmbedBuilder()
                    .setTitle('👑 Voice Channel Claimed')
                    .setColor('#FFD700')
                    .setDescription(`You have successfully claimed channel management rights over **${voiceChannel.name}**! You can now move members and configure settings.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
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
