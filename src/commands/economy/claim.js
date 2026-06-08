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
    .setName('claim')
    .setDescription('Claim your periodic server allowance (daily, weekly, or monthly coins).')
    .addStringOption(opt =>
      opt.setName('reward')
        .setDescription('Select the allowance interval to claim')
        .setRequired(true)
        .addChoices(
          { name: ' Daily Allowance (200 coins)', value: 'daily' },
          { name: ' Weekly Allowance (1,000–3,500 coins)', value: 'weekly' },
          { name: ' Monthly Allowance (5,000–15,000 coins)', value: 'monthly' }
        )
    ),

  async execute(interaction) {
    const { guild, user } = interaction;
    if (!guild) return;

    const rewardType = interaction.options.getString('reward');

    try {
      let result = null;
      let title = '';
      let accentColor = 0xFFD700;
      let nextClaimText = '';
      let tipText = '';
      let cooldownDurationMs = 86400000;

      if (rewardType === 'daily') {
        result = await db.claimDaily(guild.id, user.id);
        title = 'Daily Reward';
        accentColor = 0xFFD700; // Gold
        cooldownDurationMs = 24 * 60 * 60 * 1000;
        tipText = '-# Tip: Use /work every hour and /beg every 45s for extra coins!';
      } else if (rewardType === 'weekly') {
        result = await db.claimWeekly(guild.id, user.id);
        title = 'Weekly Reward';
        accentColor = 0xA855F7; // Purple
        cooldownDurationMs = 7 * 24 * 60 * 60 * 1000;
        tipText = '-# Tip: Reward is random every week — claim `/daily` every day and `/work` every hour for more coins!';
      } else if (rewardType === 'monthly') {
        result = await db.claimMonthly(guild.id, user.id);
        title = 'Monthly Reward';
        accentColor = 0xF59E0B; // Amber
        cooldownDurationMs = 30 * 24 * 60 * 60 * 1000;
        tipText = '-# Tip: Reward is random every month — stack with `/daily` and `/weekly` for maximum coin income!';
      }

      if (!result.success) {
        const nextClaimUnix = Math.floor((Date.now() + result.cooldownLeft) / 1000);
        const timeFormat = rewardType === 'daily' ? 't' : 'F';

        const container = new ContainerBuilder()
          .setAccentColor(0xFF8C00)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## ${EMOJIS.coin} ${title} Already Claimed\nYou have already collected your ${rewardType} allowance.\n\n` +
                  `**Next Claim:** <t:${nextClaimUnix}:R> (at <t:${nextClaimUnix}:${timeFormat}>)`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
          )
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Come back later for your next ${rewardType} reward!`)
          );

        return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container], ephemeral: true });
      }

      const workBtn = new ButtonBuilder().setCustomId('claim_work_reminder').setLabel('Work for More').setStyle(ButtonStyle.Success);
      const shopBtn = new ButtonBuilder().setCustomId('claim_shop_reminder').setLabel('Visit Shop').setStyle(ButtonStyle.Secondary);

      const nextClaimUnix = Math.floor((Date.now() + cooldownDurationMs) / 1000);

      const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## ${title} Claimed!\nYour periodic allowance has been deposited into your wallet.`
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
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(tipText))
        .addActionRowComponents(new ActionRowBuilder().addComponents(workBtn, shopBtn));

      const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === user.id,
        time: 30000,
        max: 1
      });

      collector.on('collect', async i => {
        if (i.customId === 'claim_work_reminder') {
          await i.reply({ content: 'Use `/work` to earn coins every hour! Your pay scales with your job tier.', ephemeral: true });
        } else if (i.customId === 'claim_shop_reminder') {
          await i.reply({ content: 'Use `/shop view` to browse items you can purchase with your coins!', ephemeral: true });
        }
      });

      collector.on('end', async () => {
        const disabledContainer = new ContainerBuilder()
          .setAccentColor(accentColor)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## ${title} Claimed!\nYour periodic allowance has been deposited into your wallet.`
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
      console.error(`[ERROR] ${rewardType} claim command failed:`, err);
      const errMsg = { content: `Failed to claim ${rewardType} allowance. Please try again later.`, ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
      else await interaction.editReply(errMsg).catch(() => null);
    }
  }
};
