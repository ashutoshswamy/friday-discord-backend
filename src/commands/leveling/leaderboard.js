const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/db');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const BASE_THEMES = {
    cyber:    { bg: ['#0F0C20', '#15102A', '#06040A'], accent: ['#00F2FE', '#4FACFE'] },
    midnight: { bg: ['#060912', '#0d1421', '#040810'], accent: ['#3b9dff', '#8b5cf6'] },
    forest:   { bg: ['#0a1a0f', '#081208', '#050d04'], accent: ['#00c853', '#69f0ae'] },
    sunset:   { bg: ['#1a0a08', '#120604', '#0d0304'], accent: ['#ff4569', '#ff9100'] },
    aurora:   { bg: ['#0a0813', '#0d0a1a', '#070510'], accent: ['#8b5cf6', '#ec4899'] },
    neon:     { bg: ['#050515', '#08081f', '#020208'], accent: ['#39ff14', '#ff00ff'] },
    ocean:    { bg: ['#011020', '#031a2e', '#010810'], accent: ['#00e5ff', '#0ea5e9'] },
    volcano:  { bg: ['#1a0500', '#260800', '#0d0200'], accent: ['#ff6d00', '#ffab40'] },
    sakura:   { bg: ['#1a0510', '#22061a', '#0d0208'], accent: ['#f472b6', '#fda4af'] },
    gold:     { bg: ['#1a1200', '#221800', '#0d0900'], accent: ['#fbbf24', '#f59e0b'] },
    void:     { bg: ['#050005', '#0a000a', '#020002'], accent: ['#7c3aed', '#c026d3'] },
};

const STAT_COLORS = {
    xp:      { titleColor: '#FFD700', statColor: '#00F2FE', statLabel: '#6B7280' },
    economy: { titleColor: '#00FF66', statColor: '#00FF66', statLabel: '#6B7280' },
};

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

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
            let entries = [];
            const mode = subcommand === 'xp' ? 'xp' : 'economy';

            if (mode === 'xp') {
                entries = await db.getLeaderboard(guild.id);
                if (entries.length === 0) {
                    return interaction.editReply({ content: '📜 No rank profiles found. Chat in a text channel to start earning XP!' });
                }
            } else {
                entries = await db.getEconomyLeaderboard(guild.id);
                if (entries.length === 0) {
                    return interaction.editReply({ content: '📜 No economy profiles found. Start working to earn coins!' });
                }
            }

            // Load per-guild leaderboard card config
            const cardConfig = await db.getLeaderboardCardConfig(guild.id).catch(() => ({ theme: 'cyber', accentColor: null }));
            const baseTheme = BASE_THEMES[cardConfig.theme] || BASE_THEMES.cyber;
            const modeColors = STAT_COLORS[mode];
            const t = {
                bg: baseTheme.bg,
                accent: cardConfig.accentColor ? [cardConfig.accentColor, cardConfig.accentColor] : baseTheme.accent,
                titleColor: modeColors.titleColor,
                subtitleColor: '#9CA3AF',
                statColor: cardConfig.accentColor || modeColors.statColor,
                statLabel: modeColors.statLabel,
            };

            // Batch-fetch guild members
            const membersMap = new Map();
            try {
                const fetched = await guild.members.fetch({ user: entries.map(e => e.userId) });
                fetched.forEach(m => membersMap.set(m.id, m));
            } catch { /* fallback to userId */ }

            // Batch-fetch avatars in parallel
            const avatarImages = await Promise.all(entries.map(async (entry) => {
                const member = membersMap.get(entry.userId);
                if (!member) return null;
                try {
                    const url = member.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 64 });
                    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 4000 });
                    return await loadImage(Buffer.from(res.data));
                } catch {
                    return null;
                }
            }));

            // Fetch server icon
            let guildIcon = null;
            if (guild.iconURL()) {
                try {
                    const res = await axios.get(guild.iconURL({ extension: 'png', forceStatic: true, size: 64 }), { responseType: 'arraybuffer', timeout: 4000 });
                    guildIcon = await loadImage(Buffer.from(res.data));
                } catch { /* optional */ }
            }

            // Canvas dimensions
            const CARD_W = 820;
            const HEADER_H = 110;
            const ROW_H = 60;
            const FOOTER_H = 24;
            const CARD_H = HEADER_H + entries.length * ROW_H + FOOTER_H;

            const canvas = createCanvas(CARD_W, CARD_H);
            const ctx = canvas.getContext('2d');

            // Clip to rounded card
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, CARD_W, CARD_H, 20);
            ctx.clip();

            // Background gradient
            const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
            bgGrad.addColorStop(0, t.bg[0]);
            bgGrad.addColorStop(0.5, t.bg[1]);
            bgGrad.addColorStop(1, t.bg[2]);
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, CARD_W, CARD_H);

            // Subtle glow orbs
            ctx.fillStyle = t.accent[0] + '09';
            ctx.beginPath();
            ctx.arc(CARD_W, CARD_H * 0.3, 220, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = t.accent[1] + '07';
            ctx.beginPath();
            ctx.arc(0, CARD_H * 0.7, 180, 0, Math.PI * 2);
            ctx.fill();

            // Left accent border
            const borderGrad = ctx.createLinearGradient(0, 0, 0, CARD_H);
            borderGrad.addColorStop(0, t.accent[0]);
            borderGrad.addColorStop(1, t.accent[1]);
            ctx.fillStyle = borderGrad;
            ctx.fillRect(0, 0, 8, CARD_H);

            // ── Header ──────────────────────────────────────────────
            const headerCY = HEADER_H / 2;

            // Server icon
            if (guildIcon) {
                const iconR = 28;
                const iconX = 40 + iconR;
                ctx.save();
                ctx.beginPath();
                ctx.arc(iconX, headerCY, iconR + 3, 0, Math.PI * 2);
                ctx.fillStyle = t.accent[0] + '40';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(iconX, headerCY, iconR, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(guildIcon, iconX - iconR, headerCY - iconR, iconR * 2, iconR * 2);
                ctx.restore();
            }

            const titleX = guildIcon ? 110 : 30;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';

            // Title
            ctx.fillStyle = t.titleColor;
            ctx.font = 'bold 30px sans-serif';
            const titleText = mode === 'xp' ? 'XP Leaderboard' : 'Economy Leaderboard';
            ctx.fillText(titleText, titleX, headerCY - 12);

            // Server name subtitle
            ctx.fillStyle = t.subtitleColor;
            ctx.font = '17px sans-serif';
            let serverName = guild.name;
            if (ctx.measureText(serverName).width > CARD_W - titleX - 250) {
                while (ctx.measureText(serverName + '…').width > CARD_W - titleX - 250 && serverName.length > 1) {
                    serverName = serverName.slice(0, -1);
                }
                serverName += '…';
            }
            ctx.fillText(serverName, titleX, headerCY + 16);

            // Entry count badge (top-right)
            ctx.textAlign = 'right';
            ctx.fillStyle = t.accent[0] + '99';
            ctx.font = '15px sans-serif';
            ctx.fillText(`Top ${entries.length}`, CARD_W - 24, headerCY);

            // Header divider
            ctx.strokeStyle = t.accent[0] + '30';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, HEADER_H);
            ctx.lineTo(CARD_W - 20, HEADER_H);
            ctx.stroke();

            // ── Rows ─────────────────────────────────────────────────
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const rowY = HEADER_H + i * ROW_H;
                const rowCY = rowY + ROW_H / 2;
                const member = membersMap.get(entry.userId);
                const username = member?.user?.username || member?.displayName || `User …${entry.userId.slice(-4)}`;
                const avatarImg = avatarImages[i];

                // Row background
                ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.18)';
                ctx.fillRect(8, rowY, CARD_W - 8, ROW_H);

                // Rank badge (top-3 get accent color, rest grey)
                const rankStr = `#${i + 1}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (i < 3) {
                    // Colored badge background
                    const badgeColor = MEDAL_COLORS[i];
                    ctx.fillStyle = badgeColor + '22';
                    ctx.beginPath();
                    ctx.roundRect(18, rowCY - 14, 44, 28, 6);
                    ctx.fill();
                    ctx.fillStyle = badgeColor;
                    ctx.font = 'bold 18px sans-serif';
                } else {
                    ctx.fillStyle = '#4B5563';
                    ctx.font = 'bold 16px sans-serif';
                }
                ctx.fillText(rankStr, 40, rowCY);

                // Avatar (38px diameter)
                const avatarX = 86;
                const avatarR = 19;

                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX, rowCY, avatarR + 2, 0, Math.PI * 2);
                ctx.fillStyle = i < 3 ? MEDAL_COLORS[i] + '55' : t.accent[0] + '25';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(avatarX, rowCY, avatarR, 0, Math.PI * 2);
                ctx.clip();

                if (avatarImg) {
                    ctx.drawImage(avatarImg, avatarX - avatarR, rowCY - avatarR, avatarR * 2, avatarR * 2);
                } else {
                    ctx.fillStyle = '#1F2937';
                    ctx.fillRect(avatarX - avatarR, rowCY - avatarR, avatarR * 2, avatarR * 2);
                    ctx.fillStyle = t.accent[0];
                    ctx.font = `bold ${avatarR}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(username.charAt(0).toUpperCase(), avatarX, rowCY);
                }
                ctx.restore();

                // Username
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = i < 3 ? '#FFFFFF' : '#D1D5DB';
                ctx.font = i < 3 ? 'bold 20px sans-serif' : '19px sans-serif';

                let displayName = username;
                const maxNameW = 360;
                if (ctx.measureText(displayName).width > maxNameW) {
                    while (ctx.measureText(displayName + '…').width > maxNameW && displayName.length > 1) {
                        displayName = displayName.slice(0, -1);
                    }
                    displayName += '…';
                }
                ctx.fillText(displayName, 116, rowCY);

                // Stats (right-aligned)
                ctx.textAlign = 'right';
                if (mode === 'xp') {
                    // Level (large) + XP (small, below)
                    ctx.fillStyle = i < 3 ? MEDAL_COLORS[i] : t.statColor;
                    ctx.font = 'bold 20px sans-serif';
                    ctx.fillText(`Level ${entry.level}`, CARD_W - 24, rowCY - 10);
                    ctx.fillStyle = t.statLabel;
                    ctx.font = '14px sans-serif';
                    ctx.fillText(`${entry.xp.toLocaleString()} XP`, CARD_W - 24, rowCY + 11);
                } else {
                    ctx.fillStyle = i < 3 ? MEDAL_COLORS[i] : t.statColor;
                    ctx.font = 'bold 20px sans-serif';
                    ctx.fillText(`${entry.coins.toLocaleString()} coins`, CARD_W - 24, rowCY);
                }

                // Row bottom separator (subtle)
                if (i < entries.length - 1) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(75, rowY + ROW_H);
                    ctx.lineTo(CARD_W - 20, rowY + ROW_H);
                    ctx.stroke();
                }
            }

            // Footer
            const footerY = HEADER_H + entries.length * ROW_H + FOOTER_H / 2;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#374151';
            ctx.font = '12px sans-serif';
            ctx.fillText('Fictional simulation · Rankings update in real-time', CARD_W / 2, footerY);

            ctx.restore();

            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: `leaderboard-${guild.id}.png` });
            await interaction.editReply({ files: [attachment] });

        } catch (err) {
            console.error('[ERROR] Leaderboard command failed:', err);
            const errMsg = { content: '❌ Failed to render the leaderboard card.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => null);
            } else {
                await interaction.editReply(errMsg).catch(() => null);
            }
        }
    }
};
