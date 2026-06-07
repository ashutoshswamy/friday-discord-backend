const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { renderRankCard } = require('../../utils/renderRankCard');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
 .setName('rank')
 .setDescription("Displays a member's current level, XP, and rank progress.")
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to view rank details for')
 .setRequired(false)),

 async execute(interaction) {
 const targetUser = interaction.options.getUser('user') || interaction.user;
 const { guild } = interaction;

 if (!guild) return;

  if (targetUser.bot) {
    const botErrContainer = new ContainerBuilder()
      .setAccentColor(0xEF4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Bots do not accumulate XP or levels!')
      );
    return interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [botErrContainer],
      ephemeral: true
    });
  }

 await interaction.deferReply();

 try {
  const profile = await db.getProfile(guild.id, targetUser.id);
  if (!profile) {
    const noProfileContainer = new ContainerBuilder()
      .setAccentColor(0xEF4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Failed to load level profile.')
      );
    return interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [noProfileContainer]
    });
  }

 const profiles = await db.getGuildProfiles(guild.id);
 profiles.sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);
 const rankPos = profiles.findIndex(p => p.userId === targetUser.id) + 1 || '?';

 const rankConfig = await db.getRankCardConfig(guild.id).catch(() => null);
 const buffer = await renderRankCard(
 targetUser,
 profile,
 rankPos,
 rankConfig?.theme || 'cyber',
 rankConfig?.accentColor || null,
 db
 );

  const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });

  const container = new ContainerBuilder()
    .setAccentColor(0x8B5CF6)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://rank-${targetUser.id}.png`)
          .setDescription(`${targetUser.username}'s Rank Card`)
      )
    );

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [attachment]
  });
  } catch (err) {
  console.error('[ERROR] Rank command failed:', err);
  const errContainer = new ContainerBuilder()
    .setAccentColor(0xEF4444)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('An error occurred while retrieving rank statistics.')
    );
  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [errContainer]
  });
  }
 }
};
