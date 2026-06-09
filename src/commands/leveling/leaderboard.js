const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { EMOJIS } = require('../../utils/emojis');

const MEDALS = ['🥇', '🥈', '🥉'];
const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the top members in this server.')
    .addSubcommand(sub =>
      sub.setName('xp')
        .setDescription('Top members ranked by Level and XP.'))
    .addSubcommand(sub =>
      sub.setName('economy')
        .setDescription('Top members ranked by Server Coins.')),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) return;

    const subcommand = options.getSubcommand();
    const mode = subcommand === 'xp' ? 'xp' : 'economy';

    let entries = [];
    if (mode === 'xp') {
      entries = await db.getLeaderboard(guild.id);
      if (!entries.length) {
        return interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(new TextDisplayBuilder().setContent('No rank profiles yet. Chat to start earning XP!'))
          ]
        });
      }
    } else {
      entries = await db.getEconomyLeaderboard(guild.id);
      if (!entries.length) {
        return interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(new TextDisplayBuilder().setContent('No economy profiles yet. Start working to earn coins!'))
          ]
        });
      }
    }

    // Fetch member display names
    const membersMap = new Map();
    try {
      const fetched = await guild.members.fetch({ user: entries.map(e => e.userId) });
      fetched.forEach(m => membersMap.set(m.id, m));
    } catch { /* fallback to userId */ }

    const totalPages = Math.ceil(entries.length / PAGE_SIZE);
    let currentPage = 0;

    const buildPage = (page, disabled = false) => {
      const slice = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      const startRank = page * PAGE_SIZE;
      const pageLabel = totalPages > 1 ? ` — Page ${page + 1}/${totalPages}` : '';
      const title = mode === 'xp' ? 'XP Leaderboard' : 'Economy Leaderboard';

      const lines = slice.map((entry, idx) => {
        const rank = startRank + idx + 1;
        const member = membersMap.get(entry.userId);
        const name = member?.displayName || member?.user?.username || `User …${entry.userId.slice(-4)}`;
        const medal = rank <= 3 ? MEDALS[rank - 1] : `**#${rank}**`;

        if (mode === 'xp') {
          return `${medal} ${name} — Lv. **${entry.level}** · ${(entry.xp || 0).toLocaleString()} XP`;
        } else {
          return `${medal} ${name} — **${(entry.coins || 0).toLocaleString()}** ${EMOJIS.coin || 'coins'}`;
        }
      }).join('\n');

      const c = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}${pageLabel}\n${guild.name}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${entries.length} member${entries.length !== 1 ? 's' : ''} ranked`));

      if (totalPages > 1) {
        const prevBtn = new ButtonBuilder().setCustomId('lb_prev').setLabel('← Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || disabled);
        const pageInd = new ButtonBuilder().setCustomId('lb_page_ind').setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true);
        const nextBtn = new ButtonBuilder().setCustomId('lb_next').setLabel('Next →').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1 || disabled);
        c.addActionRowComponents(new ActionRowBuilder().addComponents(prevBtn, pageInd, nextBtn));
      }

      return c;
    };

    const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildPage(0)] });

    if (totalPages > 1) {
      const collector = response.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 120000 });
      collector.on('collect', async i => {
        await i.deferUpdate();
        if (i.customId === 'lb_prev') currentPage = Math.max(0, currentPage - 1);
        else if (i.customId === 'lb_next') currentPage = Math.min(totalPages - 1, currentPage + 1);
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildPage(currentPage)] });
      });
      collector.on('end', async () => {
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildPage(currentPage, true)] }).catch(() => null);
      });
    }
  }
};
