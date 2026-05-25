const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('Modify a server member\'s experience points (XP) manually.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add XP', value: 'ADD' },
                    { name: 'Remove XP', value: 'REMOVE' },
                    { name: 'Set XP', value: 'SET' }
                ))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to adjust XP for')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The amount of XP')
                .setMinValue(1)
                .setRequired(true)),

    /**
     * Executes the xp command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const { guild } = interaction;

        if (!guild) return;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Bots do not support leveling operations.', ephemeral: true });
        }

        try {
            // Apply XP update in Supabase and obtain new Level + XP boundaries
            const result = await db.updateXpAdmin(guild.id, targetUser.id, action, amount);

            const actionTexts = {
                ADD: `Added **${amount} XP** to`,
                REMOVE: `Deducted **${amount} XP** from`,
                SET: `Overwrote XP balance to **${amount} XP** for`
            };

            const embed = new EmbedBuilder()
                .setTitle('✨ XP Balance Modified')
                .setColor('#00FFCC')
                .setDescription(`${actionTexts[action]} ${targetUser}.`)
                .addFields(
                    { name: 'Resulting Level', value: `✨ **Level ${result.level}**`, inline: true },
                    { name: 'Resulting XP', value: `🏆 \`${result.xp}\` XP`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Admin XP modification failed:', err);
            const _errMsg = { content: "❌ Failed to update the user's XP.", ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
