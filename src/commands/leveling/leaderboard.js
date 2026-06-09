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
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const BASE_THEMES = {
  cyber: { bg: ['#0F0C20', '#15102A', '#06040A'], accent: ['#00F2FE', '#4FACFE'] },
  midnight: { bg: ['#060912', '#0d1421', '#040810'], accent: ['#3b9dff', '#8b5cf6'] },
  forest: { bg: ['#0a1a0f', '#081208', '#050d04'], accent: ['#00c853', '#69f0ae'] },
  sunset: { bg: ['#1a0a08', '#120604', '#0d0304'], accent: ['#ff4569', '#ff9100'] },
  aurora: { bg: ['#0a0813', '#0d0a1a', '#070510'], accent: ['#8b5cf6', '#ec4899'] },
  neon: { bg: ['#050515', '#08081f', '#020208'], accent: ['#39ff14', '#ff00ff'] },
  ocean: { bg: ['#011020', '#031a2e', '#010810'], accent: ['#00e5ff', '#0ea5e9'] },
  volcano: { bg: ['#1a0500', '#260800', '#0d0200'], accent: ['#ff6d00', '#ffab40'] },
  sakura: { bg: ['#1a0510', '#22061a', '#0d0208'], accent: ['#f472b6', '#fda4af'] },
  gold: { bg: ['#1a1200', '#221800', '#0d0900'], accent: ['#fbbf24', '#f59e0b'] },
  void: { bg: ['#050005', '#0a000a', '#020002'], accent: ['#7c3aed', '#c026d3'] },
};

// Medal gradients: gold, silver, bronze
const MEDALS = [
  { top: '#FFD700', bot: '#B8860B', glow: '#FFD70055' },
  { top: '#E8E8E8', bot: '#A0A0A0', glow: '#C0C0C055' },
  { top: '#F0A060', bot: '#8B4513', glow: '#CD7F3255' },
];

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

module.exports = {
  noDefer: true,
  data: new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Displays the top 10 members in this server.')
  .addSubcommand(sub =>
  sub.setName('xp')
  .setDescription('Top 10 highest-ranked members by Level and XP.'))
  .addSubcommand(sub =>
  sub.setName('economy')
  .setDescription('Top 10 wealthiest members by Server Coins.')),

  async execute(interaction) {
  const { guild, options } = interaction;
  if (!guild) return;

  const subcommand = options.getSubcommand();
  await interaction.deferReply();

  try {
  const mode = subcommand === 'xp' ? 'xp' : 'economy';
  let entries = [];

  if (mode === 'xp') {
  entries = await db.getLeaderboard(guild.id);
  if (!entries.length) {
    const emptyContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('No rank profiles yet. Chat to start earning XP!')
      );
    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [emptyContainer] });
  }
  } else {
  entries = await db.getEconomyLeaderboard(guild.id);
  if (!entries.length) {
    const emptyContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('No economy profiles yet. Start working to earn coins!')
      );
    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [emptyContainer] });
  }
  }

  const cardConfig = await db.getLeaderboardCardConfig(guild.id).catch(() => ({ theme: 'cyber', accentColor: null }));
  const base = BASE_THEMES[cardConfig.theme] || BASE_THEMES.cyber;
  const accent1 = cardConfig.accentColor || base.accent[0];
  const accent2 = cardConfig.accentColor || base.accent[1];
  const bg = base.bg;

  // Batch-fetch members + avatars
  const membersMap = new Map();
  try {
  const fetched = await guild.members.fetch({ user: entries.map(e => e.userId) });
  fetched.forEach(m => membersMap.set(m.id, m));
  } catch { /* fallback */ }

  const avatarImages = await Promise.all(entries.map(async entry => {
  const member = membersMap.get(entry.userId);
  if (!member) return null;
  try {
  const url = member.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 128 });
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 4000 });
  return await loadImage(Buffer.from(res.data));
  } catch { return null; }
  }));

  // Server icon
  let guildIcon = null;
  if (guild.iconURL()) {
  try {
  const res = await axios.get(
  guild.iconURL({ extension: 'png', forceStatic: true, size: 128 }),
  { responseType: 'arraybuffer', timeout: 4000 }
  );
  guildIcon = await loadImage(Buffer.from(res.data));
  } catch { /* optional */ }
  }

  // XP needed for each entry (XP mode only, for mini bars)
  let xpNeededArr = [];
  if (mode === 'xp') {
  xpNeededArr = entries.map(e => db.xpNeededForNextLevel(e.level));
  }

  // ── Canvas dimensions ─────────────────────────────────────────
  const W = 920;
  const HEADER_H = 120;
  const ROW_H = mode === 'xp' ? 72 : 64;
  const FOOTER_H = 36;
  const H = HEADER_H + entries.length * ROW_H + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Clip ──────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 24);
  ctx.clip();

  // ── Background ────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, bg[0]);
  bgGrad.addColorStop(0.5, bg[1]);
  bgGrad.addColorStop(1, bg[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Ambient glows ─────────────────────────────────────────────
  const glowTR = ctx.createRadialGradient(W, 0, 0, W, 0, 420);
  glowTR.addColorStop(0, hexAlpha(accent1, 0.14));
  glowTR.addColorStop(1, hexAlpha(accent1, 0));
  ctx.fillStyle = glowTR;
  ctx.fillRect(0, 0, W, H);

  const glowBL = ctx.createRadialGradient(0, H, 0, 0, H, 380);
  glowBL.addColorStop(0, hexAlpha(accent2, 0.10));
  glowBL.addColorStop(1, hexAlpha(accent2, 0));
  ctx.fillStyle = glowBL;
  ctx.fillRect(0, 0, W, H);

  // ── Dot grid ──────────────────────────────────────────────────
  ctx.fillStyle = hexAlpha(accent1, 0.03);
  for (let x = 20; x < W; x += 28) {
  for (let y = 14; y < H; y += 28) {
  ctx.beginPath();
  ctx.arc(x, y, 1, 0, Math.PI * 2);
  ctx.fill();
  }
  }

  // ── Header ────────────────────────────────────────────────────
  const headerCY = HEADER_H / 2;

  // Server icon (square rounded)
  const iconSize = 60, iconX = 28, iconY = headerCY - iconSize / 2, iconR = 12;
  if (guildIcon) {
  // Border
  const iconBorder = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
  iconBorder.addColorStop(0, hexAlpha(accent1, 0.8));
  iconBorder.addColorStop(1, hexAlpha(accent2, 0.8));
  ctx.fillStyle = iconBorder;
  ctx.beginPath();
  ctx.roundRect(iconX - 3, iconY - 3, iconSize + 6, iconSize + 6, iconR + 3);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(iconX, iconY, iconSize, iconSize, iconR);
  ctx.clip();
  ctx.drawImage(guildIcon, iconX, iconY, iconSize, iconSize);
  ctx.restore();
  }

  const titleX = guildIcon ? iconX + iconSize + 20 : 28;

  // Mode pill
  const modeLabel = mode === 'xp' ? 'XP LEADERBOARD' : 'ECONOMY LEADERBOARD';
  const modeColor = mode === 'xp' ? '#FFD700' : '#00e676';
  ctx.font = 'bold 13px sans-serif';
  const modePillW = ctx.measureText(modeLabel).width + 24;
  const modePillH = 26;
  const modePillY = headerCY - 44;

  ctx.fillStyle = hexAlpha(modeColor, 0.12);
  ctx.beginPath();
  ctx.roundRect(titleX, modePillY, modePillW, modePillH, modePillH / 2);
  ctx.fill();
  ctx.strokeStyle = hexAlpha(modeColor, 0.4);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(titleX, modePillY, modePillW, modePillH, modePillH / 2);
  ctx.stroke();
  ctx.fillStyle = modeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(modeLabel, titleX + modePillW / 2, modePillY + modePillH / 2);

  // Server name
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';

  let serverName = guild.name;
  const maxServerW = W - titleX - 160;
  while (ctx.measureText(serverName).width > maxServerW && serverName.length > 1) {
  serverName = serverName.slice(0, -1);
  }
  if (serverName.length < guild.name.length) serverName += '…';
  ctx.fillText(serverName, titleX, headerCY + 16);

  // "Top N" pill — top right
  const topLabel = `TOP ${entries.length}`;
  ctx.font = 'bold 13px sans-serif';
  const topPillW = ctx.measureText(topLabel).width + 22;
  const topPillH = 30;
  const topPillX = W - topPillW - 24;
  const topPillY = headerCY - topPillH / 2;

  const topPillGrad = ctx.createLinearGradient(topPillX, 0, topPillX + topPillW, 0);
  topPillGrad.addColorStop(0, hexAlpha(accent1, 0.2));
  topPillGrad.addColorStop(1, hexAlpha(accent2, 0.2));
  ctx.fillStyle = topPillGrad;
  ctx.beginPath();
  ctx.roundRect(topPillX, topPillY, topPillW, topPillH, topPillH / 2);
  ctx.fill();

  const topBorder = ctx.createLinearGradient(topPillX, 0, topPillX + topPillW, 0);
  topBorder.addColorStop(0, hexAlpha(accent1, 0.6));
  topBorder.addColorStop(1, hexAlpha(accent2, 0.6));
  ctx.strokeStyle = topBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(topPillX, topPillY, topPillW, topPillH, topPillH / 2);
  ctx.stroke();

  ctx.fillStyle = accent1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topLabel, topPillX + topPillW / 2, topPillY + topPillH / 2);

  // Header divider
  const dividerGrad = ctx.createLinearGradient(0, 0, W, 0);
  dividerGrad.addColorStop(0, hexAlpha(accent1, 0));
  dividerGrad.addColorStop(0.2, hexAlpha(accent1, 0.35));
  dividerGrad.addColorStop(0.8, hexAlpha(accent2, 0.35));
  dividerGrad.addColorStop(1, hexAlpha(accent2, 0));
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(0, HEADER_H - 1, W, 1);

  // ── Rows ──────────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i++) {
  const entry = entries[i];
  const rowY = HEADER_H + i * ROW_H;
  const rowCY = rowY + ROW_H / 2;
  const member = membersMap.get(entry.userId);
  const username = member?.user?.username || member?.displayName || `User …${entry.userId.slice(-4)}`;
  const avImg = avatarImages[i];
  const isTop3 = i < 3;
  const medal = MEDALS[i] || null;

  // Row background — top 3 get subtle accent tint
  if (isTop3) {
  const rowBg = ctx.createLinearGradient(0, rowY, W, rowY);
  rowBg.addColorStop(0, hexAlpha(medal.top, 0.06));
  rowBg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rowBg;
  ctx.fillRect(0, rowY, W, ROW_H);
  } else {
  ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, rowY, W, ROW_H);
  }

  // ── Rank badge ────────────────────────────────────────────
  const badgeW = 52, badgeH = 30, badgeX = 16, badgeY = rowCY - badgeH / 2;

  if (isTop3) {
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
  badgeGrad.addColorStop(0, hexAlpha(medal.top, 0.25));
  badgeGrad.addColorStop(1, hexAlpha(medal.bot, 0.25));
  ctx.fillStyle = badgeGrad;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();

  const badgeBorder = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
  badgeBorder.addColorStop(0, hexAlpha(medal.top, 0.8));
  badgeBorder.addColorStop(1, hexAlpha(medal.bot, 0.8));
  ctx.strokeStyle = badgeBorder;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.stroke();

  const rankGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
  rankGrad.addColorStop(0, medal.top);
  rankGrad.addColorStop(1, medal.bot);
  ctx.fillStyle = rankGrad;
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${i + 1}`, badgeX + badgeW / 2, rowCY);
  } else {
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${i + 1}`, badgeX + badgeW / 2, rowCY);
  }

  // ── Avatar (square rounded) ───────────────────────────────
  const avSize = 44, avX = 80, avY = rowCY - avSize / 2, avR = 8;

  // Avatar border
  const avBorder = ctx.createLinearGradient(avX, avY, avX + avSize, avY + avSize);
  avBorder.addColorStop(0, isTop3 ? hexAlpha(medal.top, 0.9) : hexAlpha(accent1, 0.5));
  avBorder.addColorStop(1, isTop3 ? hexAlpha(medal.bot, 0.9) : hexAlpha(accent2, 0.5));
  ctx.fillStyle = avBorder;
  ctx.beginPath();
  ctx.roundRect(avX - 2, avY - 2, avSize + 4, avSize + 4, avR + 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(avX, avY, avSize, avSize, avR);
  ctx.clip();

  if (avImg) {
  ctx.drawImage(avImg, avX, avY, avSize, avSize);
  } else {
  ctx.fillStyle = '#1a1b2e';
  ctx.fillRect(avX, avY, avSize, avSize);
  ctx.fillStyle = accent1;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(username.charAt(0).toUpperCase(), avX + avSize / 2, avY + avSize / 2);
  }
  ctx.restore();

  // ── Username + mini bar ───────────────────────────────────
  const nameX = avX + avSize + 16;
  const maxNameW = 380;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isTop3 ? '#ffffff' : 'rgba(255,255,255,0.82)';
  ctx.font = isTop3 ? 'bold 20px sans-serif' : '18px sans-serif';

  let displayName = username;
  while (ctx.measureText(displayName).width > maxNameW && displayName.length > 1) {
  displayName = displayName.slice(0, -1);
  }
  if (displayName.length < username.length) displayName += '…';

  if (mode === 'xp') {
  // Name sits above mini bar
  ctx.fillText(displayName, nameX, rowCY - 12);

  // Mini XP bar
  const barX = nameX, barY = rowCY + 8, barW = 220, barH = 5, barR = 3;
  const xpPct = Math.min(1, (entry.xp || 0) / (xpNeededArr[i] || 1));

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barR);
  ctx.fill();

  if (xpPct > 0) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barR);
  ctx.clip();

  const barFill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barFill.addColorStop(0, isTop3 ? medal.top : accent1);
  barFill.addColorStop(1, isTop3 ? medal.bot : accent2);
  ctx.fillStyle = barFill;
  ctx.fillRect(barX, barY, xpPct * barW, barH);
  ctx.restore();
  }
  } else {
  ctx.fillText(displayName, nameX, rowCY);
  }

  // ── Stat (right-aligned) ──────────────────────────────────
  ctx.textAlign = 'right';
  const statX = W - 28;

  if (mode === 'xp') {
  // Level (large)
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = isTop3 ? medal.top : accent1;
  ctx.textBaseline = 'middle';
  ctx.fillText(`Lvl ${entry.level}`, statX, rowCY - 12);

  // XP (small)
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(`${(entry.xp || 0).toLocaleString()} XP`, statX, rowCY + 9);
  } else {
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = isTop3 ? medal.top : accent1;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${(entry.coins || 0).toLocaleString()}`, statX, rowCY - 10);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('coins', statX, rowCY + 9);
  }

  // Row separator
  if (i < entries.length - 1) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(avX, rowY + ROW_H);
  ctx.lineTo(W - 20, rowY + ROW_H);
  ctx.stroke();
  }
  }

  // ── Footer ────────────────────────────────────────────────────
  const footerY = HEADER_H + entries.length * ROW_H;

  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(0, footerY, W, FOOTER_H);

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${guild.name} · Rankings update in real-time`, W / 2, footerY + FOOTER_H / 2);

  // ── Bottom accent line ────────────────────────────────────────
  const bottomLine = ctx.createLinearGradient(0, H - 3, W, H - 3);
  bottomLine.addColorStop(0, hexAlpha(accent1, 0));
  bottomLine.addColorStop(0.3, hexAlpha(accent1, 0.7));
  bottomLine.addColorStop(0.7, hexAlpha(accent2, 0.7));
  bottomLine.addColorStop(1, hexAlpha(accent2, 0));
  ctx.fillStyle = bottomLine;
  ctx.fillRect(0, H - 3, W, 3);

  ctx.restore();

  const buffer = canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buffer, { name: `leaderboard-${guild.id}.png` });

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://leaderboard-${guild.id}.png`)
          .setDescription(`${guild.name} ${mode === 'xp' ? 'XP' : 'Economy'} Leaderboard`)
      )
    );

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [attachment]
  });

  } catch (err) {
  console.error('[ERROR] Leaderboard command failed:', err);
  const errContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Failed to render the leaderboard card.')
    );
  const errMsg = { flags: MessageFlags.IsComponentsV2, components: [errContainer], ephemeral: true };
  if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
  else await interaction.editReply(errMsg).catch(() => null);
  }
  }
};
