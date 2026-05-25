const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Works virtual shifts for a random salary of server coins (5-minute cooldown).'),

    /**
     * Executes the work command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;

        if (!guild) return;

        try {
            const result = await db.claimWork(guild.id, user.id);

            if (!result.success) {
                const nextClaimTimeUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
                return interaction.editReply({
                    content: `⏳ You are too exhausted to work! You can work again **<t:${nextClaimTimeUnix}:R>** (at <t:${nextClaimTimeUnix}:T>).`,
                    ephemeral: true
                });
            }

            // Fun flavor text responses to enrich the user experience
            const tasks = [
                "You worked as a software developer and resolved a production hotfix.",
                "You worked as a master barista and served exceptional espresso.",
                "You worked as a graphics designer and designed a gorgeous mobile UI mockup.",
                "You worked as an agentic AI developer and paired with Antigravity to build Discord bots.",
                "You worked as a delivery agent and delivered packages around town.",
                "You worked as a tournament competitor and placed in the top ranks.",
                "You worked as a researcher and published a state-of-the-art methodology."
            ];
            const chosenTask = tasks[Math.floor(Math.random() * tasks.length)];

            const embed = new EmbedBuilder()
                .setTitle('💼 Shift Completed')
                .setColor('#00FF66')
                .setThumbnail(user.displayAvatarURL({ forceStatic: true }))
                .setDescription(`${chosenTask}`)
                .addFields(
                    { name: 'Salary Earned', value: `🪙 **+${result.reward}** coins`, inline: true },
                    { name: 'New Wallet Balance', value: `🪙 **${result.newBalance.toLocaleString()}** coins`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[ERROR] Work command failed:', err);
            const _errMsg = { content: '❌ Failed to process your work salary. Verify database integration.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
