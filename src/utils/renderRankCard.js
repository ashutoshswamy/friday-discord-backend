const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const RANK_THEMES = {
    cyber:    { bg: ['#0F0C20', '#15102A', '#06040A'], accent: ['#00F2FE', '#4FACFE'], levelColor: '#F5A623', trackBg: '#1a1830' },
    midnight: { bg: ['#060912', '#0d1421', '#040810'], accent: ['#3b9dff', '#8b5cf6'], levelColor: '#38bdf8', trackBg: '#111827' },
    forest:   { bg: ['#0a1a0f', '#081208', '#050d04'], accent: ['#00c853', '#69f0ae'], levelColor: '#b9f6ca', trackBg: '#0a1a0d' },
    sunset:   { bg: ['#1a0a08', '#120604', '#0d0304'], accent: ['#ff4569', '#ff9100'], levelColor: '#ffd740', trackBg: '#1a0d08' },
    aurora:   { bg: ['#0a0813', '#0d0a1a', '#070510'], accent: ['#8b5cf6', '#ec4899'], levelColor: '#a78bfa', trackBg: '#100820' },
    neon:     { bg: ['#050515', '#08081f', '#020208'], accent: ['#39ff14', '#ff00ff'], levelColor: '#39ff14', trackBg: '#08081a' },
    ocean:    { bg: ['#011020', '#031a2e', '#010810'], accent: ['#00e5ff', '#0ea5e9'], levelColor: '#38bdf8', trackBg: '#041520' },
    volcano:  { bg: ['#1a0500', '#260800', '#0d0200'], accent: ['#ff6d00', '#ffab40'], levelColor: '#ffd740', trackBg: '#1a0800' },
    sakura:   { bg: ['#1a0510', '#22061a', '#0d0208'], accent: ['#f472b6', '#fda4af'], levelColor: '#fbcfe8', trackBg: '#1a0510' },
    gold:     { bg: ['#1a1200', '#221800', '#0d0900'], accent: ['#fbbf24', '#f59e0b'], levelColor: '#fde68a', trackBg: '#181200' },
    void:     { bg: ['#050005', '#0a000a', '#020002'], accent: ['#7c3aed', '#c026d3'], levelColor: '#ddd6fe', trackBg: '#080010' },
};

// Hex to rgba helper
function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Renders a rank card as a PNG buffer.
 * @param {import('discord.js').User} user
 * @param {{ xp: number, level: number }} profile
 * @param {number|string} rankPos
 * @param {string} theme
 * @param {string|null} accentColor
 * @param {import('./db')} db
 * @returns {Promise<Buffer>}
 */
async function renderRankCard(user, profile, rankPos, theme, accentColor, db) {
    const t       = RANK_THEMES[theme] || RANK_THEMES.cyber;
    const accent1 = accentColor || t.accent[0];
    const accent2 = accentColor || t.accent[1];

    const currentXp  = profile.xp;
    const level      = profile.level;
    const xpNeeded   = db.xpNeededForNextLevel(level);
    const percentage = Math.min(100, Math.floor((currentXp / xpNeeded) * 100)) || 0;

    const W = 950, H = 300;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    // ── 1. Clip card to rounded rect ──────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 28);
    ctx.clip();

    // ── 2. Background gradient ────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   t.bg[0]);
    bg.addColorStop(0.5, t.bg[1]);
    bg.addColorStop(1,   t.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── 3. Ambient glows ──────────────────────────────────────────────────
    // Left glow behind avatar
    const leftGlow = ctx.createRadialGradient(160, H / 2, 20, 160, H / 2, 200);
    leftGlow.addColorStop(0, hexAlpha(accent1, 0.18));
    leftGlow.addColorStop(1, hexAlpha(accent1, 0));
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, W, H);

    // Right glow
    const rightGlow = ctx.createRadialGradient(W, 0, 0, W, 0, 380);
    rightGlow.addColorStop(0, hexAlpha(accent2, 0.12));
    rightGlow.addColorStop(1, hexAlpha(accent2, 0));
    ctx.fillStyle = rightGlow;
    ctx.fillRect(0, 0, W, H);

    // ── 4. Subtle dot grid overlay ────────────────────────────────────────
    ctx.fillStyle = hexAlpha(accent1, 0.035);
    for (let x = 20; x < W; x += 28) {
        for (let y = 14; y < H; y += 28) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── 5. Watermark rank number ──────────────────────────────────────────
    ctx.font      = 'bold 220px sans-serif';
    ctx.fillStyle = hexAlpha(accent1, 0.04);
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`#${rankPos}`, W - 30, H + 20);

    // ── 6. Avatar (square with rounded corners + gradient border) ─────────
    const avX = 40, avY = 40, avSize = 220, avRadius = 20;
    const borderW = 4;

    // Gradient border
    const avBorderGrad = ctx.createLinearGradient(avX, avY, avX + avSize, avY + avSize);
    avBorderGrad.addColorStop(0, accent1);
    avBorderGrad.addColorStop(1, accent2);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(avX - borderW, avY - borderW, avSize + borderW * 2, avSize + borderW * 2, avRadius + borderW);
    ctx.fillStyle = avBorderGrad;
    ctx.fill();
    ctx.restore();

    // Avatar clip
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(avX, avY, avSize, avSize, avRadius);
    ctx.clip();

    let avatarImage;
    try {
        const url      = user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 512 });
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
        avatarImage    = await loadImage(Buffer.from(response.data));
    } catch { /* fallback below */ }

    if (avatarImage) {
        ctx.drawImage(avatarImage, avX, avY, avSize, avSize);
    } else {
        ctx.fillStyle = '#1a1b2e';
        ctx.fillRect(avX, avY, avSize, avSize);
        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 90px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(user.username.charAt(0).toUpperCase(), avX + avSize / 2, avY + avSize / 2);
    }

    // Subtle inner shadow over avatar bottom
    const avShade = ctx.createLinearGradient(avX, avY + avSize * 0.6, avX, avY + avSize);
    avShade.addColorStop(0, 'rgba(0,0,0,0)');
    avShade.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = avShade;
    ctx.fillRect(avX, avY, avSize, avSize);

    ctx.restore();

    // ── 7. Content area: right of avatar ──────────────────────────────────
    const cx = avX + avSize + 36; // content start X
    const contentW = W - cx - 36;

    // ── 8. RANK pill — top right ──────────────────────────────────────────
    const rankLabel = `# ${rankPos}`;
    ctx.font = 'bold 18px sans-serif';
    const rankLabelW = ctx.measureText(rankLabel).width;
    const pillW = rankLabelW + 28, pillH = 34, pillX = W - pillW - 36, pillY = 36;

    // Pill background
    const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
    pillGrad.addColorStop(0, hexAlpha(accent1, 0.22));
    pillGrad.addColorStop(1, hexAlpha(accent2, 0.22));
    ctx.fillStyle = pillGrad;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    // Pill border
    const pillBorder = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
    pillBorder.addColorStop(0, hexAlpha(accent1, 0.7));
    pillBorder.addColorStop(1, hexAlpha(accent2, 0.7));
    ctx.strokeStyle = pillBorder;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();

    // Pill text
    ctx.fillStyle    = accent1;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 16px sans-serif';
    ctx.fillText(rankLabel, pillX + pillW / 2, pillY + pillH / 2);

    // ── 9. Username ───────────────────────────────────────────────────────
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 46px sans-serif';

    // Truncate username to fit before rank pill
    const maxNameW = pillX - cx - 20;
    let name       = user.username;
    while (ctx.measureText(name).width > maxNameW && name.length > 1) {
        name = name.slice(0, -1);
    }
    if (name.length < user.username.length) name += '…';
    ctx.fillText(name, cx, 38);

    // ── 10. Level badge ───────────────────────────────────────────────────
    const lvlLabel = `LEVEL  ${level}`;
    ctx.font = 'bold 16px sans-serif';
    const lvlLabelW = ctx.measureText(lvlLabel).width;
    const lvlPillW = lvlLabelW + 24, lvlPillH = 30, lvlPillX = cx, lvlPillY = 100;

    ctx.fillStyle = hexAlpha(t.levelColor, 0.15);
    ctx.beginPath();
    ctx.roundRect(lvlPillX, lvlPillY, lvlPillW, lvlPillH, lvlPillH / 2);
    ctx.fill();

    ctx.strokeStyle = hexAlpha(t.levelColor, 0.45);
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(lvlPillX, lvlPillY, lvlPillW, lvlPillH, lvlPillH / 2);
    ctx.stroke();

    ctx.fillStyle    = t.levelColor;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 13px sans-serif';
    ctx.fillText(lvlLabel, lvlPillX + lvlPillW / 2, lvlPillY + lvlPillH / 2);

    // ── 11. Progress bar ──────────────────────────────────────────────────
    const barX = cx, barY = 152, barW = contentW, barH = 20, barR = 10;

    // Track
    ctx.fillStyle = t.trackBg;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barR);
    ctx.fill();

    // Fill
    if (percentage > 0) {
        const fillW = Math.max((percentage / 100) * barW, barH); // min width so it looks clean

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, barR);
        ctx.clip();

        const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        fillGrad.addColorStop(0, accent1);
        fillGrad.addColorStop(1, accent2);
        ctx.fillStyle = fillGrad;
        ctx.fillRect(barX, barY, fillW, barH);

        // Sheen overlay
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(barX, barY, fillW, barH / 2);

        ctx.restore();

        // Glowing dot at fill tip
        const dotX = barX + fillW;
        const dotGlow = ctx.createRadialGradient(dotX, barY + barH / 2, 0, dotX, barY + barH / 2, 18);
        dotGlow.addColorStop(0, hexAlpha(accent2, 0.9));
        dotGlow.addColorStop(0.35, hexAlpha(accent2, 0.45));
        dotGlow.addColorStop(1, hexAlpha(accent2, 0));
        ctx.fillStyle = dotGlow;
        ctx.fillRect(dotX - 18, barY - 8, 36, barH + 16);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dotX, barY + barH / 2, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 12. XP text row ───────────────────────────────────────────────────
    const xpY = barY + barH + 18;

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(255,255,255,0.45)';
    ctx.font         = '15px sans-serif';
    ctx.fillText(`${currentXp.toLocaleString()}  /  ${xpNeeded.toLocaleString()} XP`, cx, xpY);

    ctx.textAlign = 'right';
    ctx.fillStyle = hexAlpha(accent2, 0.9);
    ctx.font      = 'bold 15px sans-serif';
    ctx.fillText(`${percentage}%`, cx + contentW, xpY);

    // ── 13. Thin bottom accent line ───────────────────────────────────────
    const bottomLine = ctx.createLinearGradient(0, H - 4, W, H - 4);
    bottomLine.addColorStop(0,   hexAlpha(accent1, 0));
    bottomLine.addColorStop(0.3, hexAlpha(accent1, 0.7));
    bottomLine.addColorStop(0.7, hexAlpha(accent2, 0.7));
    bottomLine.addColorStop(1,   hexAlpha(accent2, 0));
    ctx.fillStyle = bottomLine;
    ctx.fillRect(0, H - 3, W, 3);

    // Close outer clip
    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = { renderRankCard, RANK_THEMES };
