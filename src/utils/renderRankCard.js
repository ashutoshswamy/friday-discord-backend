const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const RANK_THEMES = {
    cyber:    { bg: ['#0F0C20', '#15102A', '#06040A'], accent: ['#00F2FE', '#4FACFE'], levelColor: '#F5A623', trackBg: '#232135' },
    midnight: { bg: ['#060912', '#0d1421', '#040810'], accent: ['#3b9dff', '#8b5cf6'], levelColor: '#38bdf8', trackBg: '#1a2035' },
    forest:   { bg: ['#0a1a0f', '#081208', '#050d04'], accent: ['#00c853', '#69f0ae'], levelColor: '#b9f6ca', trackBg: '#0d2010' },
    sunset:   { bg: ['#1a0a08', '#120604', '#0d0304'], accent: ['#ff4569', '#ff9100'], levelColor: '#ffd740', trackBg: '#1f0e08' },
    aurora:   { bg: ['#0a0813', '#0d0a1a', '#070510'], accent: ['#8b5cf6', '#ec4899'], levelColor: '#a78bfa', trackBg: '#130820' },
    neon:     { bg: ['#050515', '#08081f', '#020208'], accent: ['#39ff14', '#ff00ff'], levelColor: '#39ff14', trackBg: '#0a0a20' },
    ocean:    { bg: ['#011020', '#031a2e', '#010810'], accent: ['#00e5ff', '#0ea5e9'], levelColor: '#38bdf8', trackBg: '#051828' },
    volcano:  { bg: ['#1a0500', '#260800', '#0d0200'], accent: ['#ff6d00', '#ffab40'], levelColor: '#ffd740', trackBg: '#200800' },
    sakura:   { bg: ['#1a0510', '#22061a', '#0d0208'], accent: ['#f472b6', '#fda4af'], levelColor: '#fbcfe8', trackBg: '#1f0515' },
    gold:     { bg: ['#1a1200', '#221800', '#0d0900'], accent: ['#fbbf24', '#f59e0b'], levelColor: '#fde68a', trackBg: '#1c1400' },
    void:     { bg: ['#050005', '#0a000a', '#020002'], accent: ['#7c3aed', '#c026d3'], levelColor: '#ddd6fe', trackBg: '#0a0010' },
};

/**
 * Renders a rank card as a PNG buffer.
 * @param {import('discord.js').User} user
 * @param {{ xp: number, level: number }} profile
 * @param {number|string} rankPos
 * @param {string} theme  - key from RANK_THEMES
 * @param {string|null} accentColor - hex override, or null to use theme defaults
 * @param {import('../../utils/db')} db - db module (for xpNeededForNextLevel)
 * @returns {Promise<Buffer>}
 */
async function renderRankCard(user, profile, rankPos, theme, accentColor, db) {
    const t = RANK_THEMES[theme] || RANK_THEMES.cyber;
    const accent1 = accentColor || t.accent[0];
    const accent2 = accentColor || t.accent[1];

    const currentXp  = profile.xp;
    const level      = profile.level;
    const xpNeeded   = db.xpNeededForNextLevel(level);
    const percentage = Math.min(100, Math.floor((currentXp / xpNeeded) * 100)) || 0;

    const canvas = createCanvas(800, 250);
    const ctx    = canvas.getContext('2d');

    // 1. Clip outer card to rounded corners
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, 800, 250, 20);
    ctx.clip();

    // 2. Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 800, 250);
    bgGradient.addColorStop(0, t.bg[0]);
    bgGradient.addColorStop(0.5, t.bg[1]);
    bgGradient.addColorStop(1, t.bg[2]);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 800, 250);

    // 3. Left accent border
    const borderGlow = ctx.createLinearGradient(0, 0, 0, 250);
    borderGlow.addColorStop(0, accent1);
    borderGlow.addColorStop(1, accent2);
    ctx.fillStyle = borderGlow;
    ctx.fillRect(0, 0, 8, 250);

    // 4. Subtle background glows
    ctx.fillStyle = accent1 + '08';
    ctx.beginPath();
    ctx.arc(800, 125, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accent2 + '06';
    ctx.beginPath();
    ctx.arc(200, -50, 150, 0, Math.PI * 2);
    ctx.fill();

    // 5. Avatar with neon ring
    const avatarCenterX = 130;
    const avatarCenterY = 125;
    const avatarRadius  = 75;

    const ringGradient = ctx.createLinearGradient(55, 50, 205, 200);
    ringGradient.addColorStop(0, accent1);
    ringGradient.addColorStop(1, accent2);
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = ringGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = t.bg[0];
    ctx.fill();

    let avatarImage;
    try {
        const avatarUrl = user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });
        const response  = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 5000 });
        avatarImage     = await loadImage(Buffer.from(response.data));
    } catch {
        // fallback to initials placeholder below
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.clip();

    if (avatarImage) {
        ctx.drawImage(avatarImage, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    } else {
        ctx.fillStyle = '#2A2B36';
        ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 60px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(user.username.charAt(0).toUpperCase(), avatarCenterX, avatarCenterY);
    }
    ctx.restore();

    // 6. Rank & Level badges (right-aligned)
    const rankText  = `RANK  #${rankPos}`;
    const levelText = `LEVEL  ${level}`;

    ctx.font = 'bold 28px sans-serif';
    const rankWidth  = ctx.measureText(rankText).width;
    const levelWidth = ctx.measureText(levelText).width;

    const levelStartBound = 750 - rankWidth - 30 - levelWidth;

    ctx.textBaseline = 'top';
    ctx.textAlign    = 'right';
    ctx.fillStyle    = accent1;
    ctx.fillText(rankText, 750, 48);

    ctx.fillStyle = t.levelColor;
    ctx.fillText(levelText, 750 - rankWidth - 30, 48);

    // 7. Username (left-aligned, truncated)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font      = 'bold 36px sans-serif';

    let name         = user.username;
    const maxNameWidth = levelStartBound - 250 - 20;
    while (ctx.measureText(name + (name.length < user.username.length ? '...' : '')).width > maxNameWidth && name.length > 0) {
        name = name.slice(0, -1);
    }
    if (name.length < user.username.length) name += '...';
    ctx.fillText(name, 250, 45);

    // 8. XP text
    ctx.fillStyle = '#9CA3AF';
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillText(`${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, 250, 112);

    ctx.textAlign = 'right';
    ctx.fillStyle = accent2;
    ctx.fillText(`${percentage}%`, 750, 112);
    ctx.textAlign = 'left';

    // 9. Progress bar
    const barX = 250, barY = 145, barWidth = 500, barHeight = 26, barRadius = 13;

    ctx.fillStyle = t.trackBg;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
    ctx.fill();

    if (percentage > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
        ctx.clip();

        const fillWidth    = (percentage / 100) * barWidth;
        const fillGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        fillGradient.addColorStop(0, accent1);
        fillGradient.addColorStop(1, accent2);

        ctx.fillStyle = fillGradient;
        ctx.fillRect(barX, barY, fillWidth, barHeight);

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(barX, barY, fillWidth, barHeight / 2);
        ctx.restore();
    }

    // Restore outer card clip
    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = { renderRankCard, RANK_THEMES };
