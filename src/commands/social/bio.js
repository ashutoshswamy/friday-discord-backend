const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
  .setName('bio')
  .setDescription('Set, view, or clear your custom profile bio tagline.')
  .addStringOption(opt =>
   opt.setName('text')
    .setDescription('Your new bio (max 150 chars). Omit to view your current bio.')
    .setRequired(false))
  .addBooleanOption(opt =>
   opt.setName('clear')
    .setDescription('Clear your current bio.')
    .setRequired(false)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const text = options.getString('text');
  const clear = options.getBoolean('clear');

  try {
   if (clear) {
    await db.setBio(guild.id, user.id, null);
    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## Bio Cleared\n*Your bio has been removed.*')
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     );
    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (!text) {
    const social = await db.getUserSocial(guild.id, user.id);
    const container = new ContainerBuilder()
     .addSectionComponents(
      new SectionBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Your Bio\n${social.bio || '*No bio set. Use \`/bio text:[your text]\` to set one.*'}`
        )
       )
       .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
     );
    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
   }

   if (text.length > 150) {
    return interaction.editReply({ content: 'Bio must be 150 characters or less.', ephemeral: true });
   }

   await db.setBio(guild.id, user.id, text);

   const container = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(`## Bio Updated\n${text}`)
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent('-# Visible on your /profile')
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[BIO ERROR]', err);
   const errMsg = { content: 'Failed to update bio.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
