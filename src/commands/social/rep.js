const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

function formatMs(ms) {
 const h = Math.floor(ms / 3600000);
 const m = Math.floor((ms % 3600000) / 60000);
 return `${h}h ${m}m`;
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('rep')
  .setDescription('Give a reputation point to another member (once every 24 hours).')
  .addUserOption(opt =>
   opt.setName('user').setDescription('The member to give rep to').setRequired(true)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const target = options.getUser('user');

  if (target.id === user.id) {
   return interaction.editReply({ content: 'You cannot give rep to yourself!', ephemeral: true });
  }
  if (target.bot) {
   return interaction.editReply({ content: 'You cannot give rep to a bot.', ephemeral: true });
  }

  try {
   const result = await db.giveRep(guild.id, user.id, target.id);

   if (!result.success) {
    const remaining = formatMs(result.cooldownLeft);
    return interaction.editReply({
     content: `You already gave rep today! Next rep available in **${remaining}**.`,
     ephemeral: true
    });
   }

   const container = new ContainerBuilder()
    .setAccentColor(0xFFD700)
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## Rep Given!\n<@${user.id}> gave a reputation point to <@${target.id}>!`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**${target.username}'s Total Rep:** **${result.newRepCount.toLocaleString()}**\n` +
      `-# You can give rep again in 24 hours`
     )
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[REP ERROR]', err);
   const errMsg = { content: 'Failed to process rep transaction.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
