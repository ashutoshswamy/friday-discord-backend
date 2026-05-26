const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/db');
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

module.exports = {
    noDefer: true,
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription("Displays a member's current level, XP, and rank progress.")
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to view rank details for')
                .setRequired(false)),

    /**
     * Executes the rank command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { guild } = interaction;

        if (!guild) return;

        // Bots are excluded from leveling
        if (targetUser.bot) {
            return interaction.reply({ content: '🤖 Bots do not accumulate XP or levels!', ephemeral: true });
        }

        // Defer reply since image rendering and avatar fetching takes a moment
        await interaction.deferReply();

        // Load rank card theme config
        const rankConfig = await db.getRankCardConfig(guild.id).catch(() => null);
        const t = RANK_THEMES[rankConfig?.theme] || RANK_THEMES.cyber;
        const accent1 = rankConfig?.accentColor || t.accent[0];
        const accent2 = rankConfig?.accentColor || t.accent[1];

        try {
            const profile = await db.getProfile(guild.id, targetUser.id);
            if (!profile) {
                return interaction.editReply({ content: '❌ Failed to load level profile.' });
            }

            const currentXp = profile.xp;
            const level = profile.level;
            const xpNeeded = db.xpNeededForNextLevel(level);

            // Fetch rank position across entire guild
            const profiles = await db.getGuildProfiles(guild.id);
            profiles.sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return b.xp - a.xp;
            });
            const rankPos = profiles.findIndex(p => p.userId === targetUser.id) + 1 || '?';

            // Calculate percentage
            const percentage = Math.min(100, Math.floor((currentXp / xpNeeded) * 100)) || 0;

            // Render rank card
            const canvas = createCanvas(800, 250);
            const ctx = canvas.getContext('2d');

            // 1. Clip outer card to rounded corners
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, 800, 250, 20);
            ctx.clip();

            // 2. Draw card background gradient
            const bgGradient = ctx.createLinearGradient(0, 0, 800, 250);
            bgGradient.addColorStop(0, t.bg[0]);
            bgGradient.addColorStop(0.5, t.bg[1]);
            bgGradient.addColorStop(1, t.bg[2]);
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, 800, 250);

            // 3. Add glowing left accent border
            const borderGlow = ctx.createLinearGradient(0, 0, 0, 250);
            borderGlow.addColorStop(0, accent1);
            borderGlow.addColorStop(1, accent2);
            ctx.fillStyle = borderGlow;
            ctx.fillRect(0, 0, 8, 250);

            // 4. Subtle background glow effects
            ctx.fillStyle = accent1 + '08';
            ctx.beginPath();
            ctx.arc(800, 125, 180, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = accent2 + '06';
            ctx.beginPath();
            ctx.arc(200, -50, 150, 0, Math.PI * 2);
            ctx.fill();

            // 5. Draw Avatar with neon ring
            const avatarCenterX = 130;
            const avatarCenterY = 125;
            const avatarRadius = 75;

            // Outer ring (neon dual-gradient glow)
            const ringGradient = ctx.createLinearGradient(55, 50, 205, 200);
            ringGradient.addColorStop(0, accent1);
            ringGradient.addColorStop(1, accent2);
            ctx.beginPath();
            ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
            ctx.fillStyle = ringGradient;
            ctx.fill();

            // Dark ring separator
            ctx.beginPath();
            ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 2, 0, Math.PI * 2);
            ctx.fillStyle = t.bg[0];
            ctx.fill();

            // Load and draw avatar
            let avatarImage;
            try {
                const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });
                const response = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const avatarBuffer = Buffer.from(response.data);
                avatarImage = await loadImage(avatarBuffer);
            } catch (err) {
                console.error('[ERROR] Failed to fetch user avatar, using fallback:', err);
            }

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            if (avatarImage) {
                ctx.drawImage(avatarImage, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            } else {
                // High-quality placeholder with first letter
                ctx.fillStyle = '#2A2B36';
                ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 60px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(targetUser.username.charAt(0).toUpperCase(), avatarCenterX, avatarCenterY);
            }
            ctx.restore();

            // 6. Draw User Details & Badges
            
            // Calculate Rank & Level details first to determine boundaries
            const rankText = `RANK  #${rankPos}`;
            const levelText = `LEVEL  ${level}`;

            ctx.font = 'bold 28px sans-serif';
            const rankWidth = ctx.measureText(rankText).width;
            const levelWidth = ctx.measureText(levelText).width;

            // Compute the boundary where the Level badge starts
            const levelStartBound = 750 - rankWidth - 30 - levelWidth;

            // Draw Level & Rank (Right Aligned)
            ctx.textBaseline = 'top';
            ctx.textAlign = 'right';

            // Draw Rank Number
            ctx.fillStyle = accent1;
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText(rankText, 750, 48);

            // Draw Level Badge
            ctx.fillStyle = t.levelColor;
            ctx.fillText(levelText, 750 - rankWidth - 30, 48);

            // Reset text alignment to left for drawing Username
            ctx.textAlign = 'left';

            // Draw Username (with dynamic width checking & truncation)
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px sans-serif';
            
            let name = targetUser.username;
            const maxNameWidth = levelStartBound - 250 - 20; // 250 is starting X, 20 is safety gap
            let nameWidth = ctx.measureText(name).width;

            if (nameWidth > maxNameWidth) {
                while (name.length > 0 && nameWidth > maxNameWidth) {
                    name = name.slice(0, -1);
                    nameWidth = ctx.measureText(name + '...').width;
                }
                name = name + '...';
            }

            ctx.fillText(name, 250, 45);

            // Reset alignment for remaining texts
            ctx.textAlign = 'left';

            // 7. Draw XP progress text above the progress bar
            ctx.fillStyle = '#9CA3AF'; // Slate grey
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, 250, 112);

            // Percentage above the progress bar
            ctx.textAlign = 'right';
            ctx.fillStyle = accent2;
            ctx.fillText(`${percentage}%`, 750, 112);
            ctx.textAlign = 'left';

            // 8. Progress Bar capsule
            const barX = 250;
            const barY = 145;
            const barWidth = 500;
            const barHeight = 26;
            const barRadius = 13;

            // Track background
            ctx.fillStyle = t.trackBg;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
            ctx.fill();

            // Fill
            if (percentage > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
                ctx.clip();

                const fillWidth = (percentage / 100) * barWidth;
                const fillGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
                fillGradient.addColorStop(0, accent1);
                fillGradient.addColorStop(1, accent2);

                ctx.fillStyle = fillGradient;
                ctx.fillRect(barX, barY, fillWidth, barHeight);

                // Add nice overlay sheen
                ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.fillRect(barX, barY, fillWidth, barHeight / 2);

                ctx.restore();
            }

            // Restore outer card clipping
            ctx.restore();

            // Export to buffer
            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });

            await interaction.editReply({ files: [attachment] });
        } catch (err) {
            console.error('[ERROR] Rank command failed:', err);
            await interaction.editReply({ 
                content: '❌ An error occurred while retrieving rank statistics.'
            });
        }
    }
};
