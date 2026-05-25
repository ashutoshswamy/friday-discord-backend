const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level-config')
        .setDescription('Configure leveling multiplier parameters for the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addNumberOption(option => 
            option.setName('multiplier')
                .setDescription('The XP generation multiplier (e.g., 2.0 for Double XP)')
                .setMinValue(0.1)
                .setMaxValue(10.0)
                .setRequired(true)),

    /**
     * Executes the level-config command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const multiplier = interaction.options.getNumber('multiplier');
        const { guild } = interaction;

        if (!guild) return;

        try {
            // Update the xpMultiplier attribute inside our guild configs table in Supabase
            await db.updateGuildConfig(guild.id, { xpMultiplier: multiplier });

            const embed = new EmbedBuilder()
                .setTitle('✨ Leveling Config Updated')
                .setColor('#00FFCC')
                .setDescription(`Successfully updated server-wide XP generation to **${multiplier}x** speed.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Level config command failed:', err);
            const _errMsg = { content: '❌ Failed to save leveling multiplier settings in the database.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
