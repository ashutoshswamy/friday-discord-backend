const {
  SlashCommandBuilder,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');
const { checkCooldown } = require('../../utils/cooldowns');

// Note: {coin} placeholder will be dynamically replaced with EMOJIS.coin
const BEG_RESPONSES = [
  "A kind stranger threw {coin} **{amount}** coins at you.",
  "A generous businessman noticed you shivering in the cold and handed you {coin} **{amount}** coins.",
  "You found a lost wallet on the floor containing {coin} **{amount}** coins! Nobody was looking.",
  "An old grandma felt bad and gave you {coin} **{amount}** coins for some candy.",
  "You played a terrible song on a cardboard guitar and somehow raised {coin} **{amount}** coins.",
  "A rich streamer walked past and dropped {coin} **{amount}** coins on your head.",
  "You dug in a garbage bin and found {coin} **{amount}** coins under a soggy newspaper."
];

const BEG_ITEMS = ['Common Worm', 'Junk Seaweed', 'Old Boot'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('beg')
    .setDescription('Beg for spare change. High cooldown, small payouts, occasionally awards junk items.'),

  async execute(interaction) {
    const { guild, user } = interaction;
    if (!guild) return;

    const cd = await checkCooldown('beg', user.id, 45);
    if (cd.onCooldown) {
      return interaction.editReply({
        content: `Keep your dignity! You must wait **${cd.remaining}s** before begging again.`,
        ephemeral: true
      });
    }

    try {
      const payout = Math.floor(Math.random() * 101) + 20;
      await db.updateCoins(guild.id, user.id, payout);

      let itemAwarded = null;
      if (Math.random() < 0.15) {
        itemAwarded = BEG_ITEMS[Math.floor(Math.random() * BEG_ITEMS.length)];
        await db.addItemToInventory(guild.id, user.id, itemAwarded);
      }

      const baseText = BEG_RESPONSES[Math.floor(Math.random() * BEG_RESPONSES.length)];
      const formattedText = baseText.replace('{coin}', EMOJIS.coin).replace('{amount}', payout.toLocaleString());

      let extraText = `**${EMOJIS.coin} Coins Pocketed:** +${payout.toLocaleString()} coins`;
      if (itemAwarded) extraText += `\n**Bonus Item:** Added **${itemAwarded}** to your inventory`;

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## Begging for Change\n${formattedText}`)
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(extraText));

      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

    } catch (err) {
      console.error('[BEG ERROR]', err);
      const errMsg = { content: 'Failed to collect spare coins.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
      else await interaction.editReply(errMsg).catch(() => null);
    }
  }
};
