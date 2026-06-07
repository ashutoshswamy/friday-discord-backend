const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle,
 ComponentType, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
  .setName('marry')
  .setDescription('Propose to another member or divorce your current partner.')
  .addSubcommand(sub =>
   sub.setName('propose')
    .setDescription('Send a marriage proposal to another member.')
    .addUserOption(opt =>
     opt.setName('user').setDescription('The member to propose to').setRequired(true)))
  .addSubcommand(sub =>
   sub.setName('divorce')
    .setDescription('Dissolve your current marriage.')),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const sub = options.getSubcommand();

  try {
   if (sub === 'divorce') {
    const marriage = await db.getMarriage(guild.id, user.id);
    if (!marriage) {
     return interaction.reply({ content: 'You are not currently married.', ephemeral: true });
    }

    await db.dissolveMarriage(guild.id, user.id);

    const container = new ContainerBuilder()
     .setAccentColor(0xFF4444)
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `## Divorced\n<@${user.id}> has dissolved their marriage with <@${marriage.partnerId}>.`
      )
     );

    return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (sub === 'propose') {
    const target = options.getUser('user');

    if (target.id === user.id) return interaction.reply({ content: 'You cannot marry yourself!', ephemeral: true });
    if (target.bot) return interaction.reply({ content: 'You cannot marry a bot!', ephemeral: true });

    const [proposerMarriage, targetMarriage] = await Promise.all([
     db.getMarriage(guild.id, user.id),
     db.getMarriage(guild.id, target.id)
    ]);

    if (proposerMarriage) {
     return interaction.reply({ content: `You are already married to <@${proposerMarriage.partnerId}>! Divorce first.`, ephemeral: true });
    }
    if (targetMarriage) {
     return interaction.reply({ content: `<@${target.id}> is already married to someone else.`, ephemeral: true });
    }

    const proposalContainer = new ContainerBuilder()
     .setAccentColor(0xFF69B4)
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Marriage Proposal!\n<@${user.id}> has proposed to <@${target.id}>!\n\n<@${target.id}>, do you accept?`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
     )
     .addActionRowComponents(
      new ActionRowBuilder().addComponents(
       new ButtonBuilder().setCustomId('marry_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
       new ButtonBuilder().setCustomId('marry_decline').setLabel('Decline').setStyle(ButtonStyle.Danger)
      )
     )
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Expires in 60 seconds')
     );

    const sent = await interaction.reply({
     flags: MessageFlags.IsComponentsV2,
     components: [proposalContainer],
     fetchReply: true
    });

    const collector = sent.createMessageComponentCollector({
     componentType: ComponentType.Button,
     time: 60000
    });

    collector.on('collect', async (i) => {
     if (i.user.id !== target.id) {
      return i.reply({ content: 'Only the person being proposed to can respond.', ephemeral: true });
     }

     collector.stop(i.customId);

     if (i.customId === 'marry_accept') {
      await db.setMarriage(guild.id, user.id, target.id);

      const acceptContainer = new ContainerBuilder()
       .setAccentColor(0xFF69B4)
       .addSectionComponents(
        new SectionBuilder()
         .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
           `## Just Married!\n<@${target.id}> said **yes**!\n\nCongratulations to <@${user.id}> & <@${target.id}>!`
          )
         )
         .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
       )
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Visible on both of your /profile cards')
       );

      await i.update({ flags: MessageFlags.IsComponentsV2, components: [acceptContainer] });
     } else {
      const declineContainer = new ContainerBuilder()
       .setAccentColor(0x6B7280)
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Proposal Declined\n<@${target.id}> declined the proposal from <@${user.id}>.`
        )
       );
      await i.update({ flags: MessageFlags.IsComponentsV2, components: [declineContainer] });
     }
    });

    collector.on('end', async (_, reason) => {
     if (reason === 'time') {
      const expiredContainer = new ContainerBuilder()
       .setAccentColor(0x6B7280)
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Proposal Expired\n<@${target.id}> did not respond in time.`
        )
       );
      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => {});
     }
    });
   }

  } catch (err) {
   console.error('[MARRY ERROR]', err);
   const errMsg = { content: 'Failed to process marriage action.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.reply(errMsg).catch(() => null);
  }
 }
};
