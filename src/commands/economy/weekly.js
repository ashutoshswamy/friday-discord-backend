const {
  SlashCommandBuilder,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Claims your weekly reward of 1,000–3,500 random server coins.'),

  async execute(interaction) {
    const { guild, user } = interaction;
    if (!guild) return;

    try {
      const result = await db.claimWeekly(guild.id, user.id);

      if (!result.success) {
        const nextClaimUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);

        const container = new ContainerBuilder()
          .setAccentColor(0xFF8C00)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## ${EMOJIS.coin} Weekly Already Claimed\nYou have already collected your weekly coins this week.\n\n` +
                  `**Next Claim:** <t:${nextClaimUnix}:R> (at <t:${nextClaimUnix}:F>)`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
          )
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('-# Come back next week for your next reward!')
          );

        return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container], ephemeral: true });
      }

      const workBtn = new ButtonBuilder().setCustomId('weekly_work_reminder').setLabel('Work for More').setStyle(ButtonStyle.Success);
      const shopBtn = new ButtonBuilder().setCustomId('weekly_shop_reminder').setLabel('Visit Shop').setStyle(ButtonStyle.Secondary);

      const nextClaimUnix = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000);

      const container = new ContainerBuilder()
        .setAccentColor(0xA855F7)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## Weekly Reward Claimed!\nYour weekly allowance has been deposited into your wallet.`
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Reward:** ${EMOJIS.coin} **+${result.reward.toLocaleString()}** coins\n` +
            `**Wallet Balance:** ${EMOJIS.coin} **${result.newBalance.toLocaleString()}** coins\n` +
            `**Next Claim:** <t:${nextClaimUnix}:R>`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# Tip: Reward is random every week — claim `/daily` every day and `/work` every hour for more coins!')
        )
        .addActionRowComponents(new ActionRowBuilder().addComponents(workBtn, shopBtn));

      const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === user.id,
        time: 30000,
        max: 1
      });

      collector.on('collect', async i => {
        if (i.customId === 'weekly_work_reminder') {
          await i.reply({ content: 'Use `/work` to earn coins every hour! Your pay scales with your job tier.', ephemeral: true });
        } else if (i.customId === 'weekly_shop_reminder') {
          await i.reply({ content: 'Use `/shop view` to browse items you can purchase with your coins!', ephemeral: true });
        }
      });

      collector.on('end', async () => {
        const disabledContainer = new ContainerBuilder()
          .setAccentColor(0xA855F7)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## Weekly Reward Claimed!\nYour weekly allowance has been deposited into your wallet.`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
          )
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Reward:** ${EMOJIS.coin} **+${result.reward.toLocaleString()}** coins\n` +
              `**Wallet Balance:** ${EMOJIS.coin} **${result.newBalance.toLocaleString()}** coins\n` +
              `**Next Claim:** <t:${nextClaimUnix}:R>`
            )
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              ButtonBuilder.from(workBtn).setDisabled(true),
              ButtonBuilder.from(shopBtn).setDisabled(true)
            )
          );
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [disabledContainer] }).catch(() => null);
      });

    } catch (err) {
      console.error('[ERROR] Weekly command failed:', err);
      const errMsg = { content: 'Failed to claim weekly allowance. Please try again later.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
      else await interaction.editReply(errMsg).catch(() => null);
    }
  }
};
