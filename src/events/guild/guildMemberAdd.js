const { Events, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');
const db = require('../../utils/db');

const WELCOME_THEMES = {
    cyber:    { bg: ['#0F0C20', '#15102A', '#06040A'], accent: ['#00F2FE', '#4FACFE'], textColor: '#FFFFFF', subColor: '#9CA3AF' },
    midnight: { bg: ['#060912', '#0d1421', '#040810'], accent: ['#3b9dff', '#8b5cf6'], textColor: '#FFFFFF', subColor: '#94a3b8' },
    forest:   { bg: ['#0a1a0f', '#081208', '#050d04'], accent: ['#00c853', '#69f0ae'], textColor: '#FFFFFF', subColor: '#86efac' },
    sunset:   { bg: ['#1a0a08', '#120604', '#0d0304'], accent: ['#ff4569', '#ff9100'], textColor: '#FFFFFF', subColor: '#fca5a5' },
    aurora:   { bg: ['#0a0813', '#0d0a1a', '#070510'], accent: ['#8b5cf6', '#ec4899'], textColor: '#FFFFFF', subColor: '#c4b5fd' },
    neon:     { bg: ['#050515', '#08081f', '#020208'], accent: ['#39ff14', '#ff00ff'], textColor: '#FFFFFF', subColor: '#a3e635' },
    ocean:    { bg: ['#011020', '#031a2e', '#010810'], accent: ['#00e5ff', '#0ea5e9'], textColor: '#FFFFFF', subColor: '#7dd3fc' },
    volcano:  { bg: ['#1a0500', '#260800', '#0d0200'], accent: ['#ff6d00', '#ffab40'], textColor: '#FFFFFF', subColor: '#fdba74' },
    sakura:   { bg: ['#1a0510', '#22061a', '#0d0208'], accent: ['#f472b6', '#fda4af'], textColor: '#FFFFFF', subColor: '#fbcfe8' },
    gold:     { bg: ['#1a1200', '#221800', '#0d0900'], accent: ['#fbbf24', '#f59e0b'], textColor: '#FFFFFF', subColor: '#fde68a' },
    void:     { bg: ['#050005', '#0a000a', '#020002'], accent: ['#7c3aed', '#c026d3'], textColor: '#FFFFFF', subColor: '#ddd6fe' },
};

async function renderWelcomeCard(member, guild, theme, accentColor) {
    const t = WELCOME_THEMES[theme] || WELCOME_THEMES.cyber;
    const accent1 = accentColor || t.accent[0];
    const accent2 = accentColor || t.accent[1];

    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext('2d');

    // Clip card to rounded corners
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, 800, 250, 20);
    ctx.clip();

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 800, 250);
    bgGradient.addColorStop(0, t.bg[0]);
    bgGradient.addColorStop(0.5, t.bg[1]);
    bgGradient.addColorStop(1, t.bg[2]);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 800, 250);

    // Left accent border
    const borderGlow = ctx.createLinearGradient(0, 0, 0, 250);
    borderGlow.addColorStop(0, accent1);
    borderGlow.addColorStop(1, accent2);
    ctx.fillStyle = borderGlow;
    ctx.fillRect(0, 0, 8, 250);

    // Background glow orbs
    ctx.fillStyle = accent1 + '08';
    ctx.beginPath();
    ctx.arc(800, 125, 200, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accent2 + '06';
    ctx.beginPath();
    ctx.arc(150, -60, 160, 0, Math.PI * 2);
    ctx.fill();

    // Avatar
    const avatarCenterX = 130;
    const avatarCenterY = 125;
    const avatarRadius = 75;

    // Neon ring
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
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });
        const response = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 5000 });
        avatarImage = await loadImage(Buffer.from(response.data));
    } catch {
        // fallback to letter
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
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
        ctx.fillText(member.user.username.charAt(0).toUpperCase(), avatarCenterX, avatarCenterY);
    }
    ctx.restore();

    // Welcome label (top right area)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = accent1;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('WELCOME', 750, 48);

    // Member count badge
    ctx.fillStyle = accent2;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Member #${guild.memberCount}`, 750, 76);

    // Username
    ctx.textAlign = 'left';
    ctx.fillStyle = t.textColor;
    ctx.font = 'bold 38px sans-serif';

    let name = member.user.username;
    const maxNameWidth = 480;
    let nameWidth = ctx.measureText(name).width;
    if (nameWidth > maxNameWidth) {
        while (name.length > 0 && ctx.measureText(name + '...').width > maxNameWidth) {
            name = name.slice(0, -1);
        }
        name += '...';
    }
    ctx.fillText(name, 250, 46);

    // Subtext
    ctx.fillStyle = t.subColor;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Welcome to ${guild.name}!`, 250, 100);

    // Divider line
    const divGradient = ctx.createLinearGradient(250, 0, 750, 0);
    divGradient.addColorStop(0, accent1 + '80');
    divGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = divGradient;
    ctx.fillRect(250, 138, 500, 1);

    // Join info
    ctx.fillStyle = t.subColor;
    ctx.font = '16px sans-serif';
    ctx.fillText(`Joined ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 250, 155);

    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        const { guild } = member;

        try {
            const config = await db.getGuildConfig(guild.id);
            if (!config) return;

            // 1. AutoRole
            if (config.autoRoleId) {
                const autoRole = guild.roles.cache.get(config.autoRoleId);
                if (autoRole) {
                    await member.roles.add(autoRole, 'Onboarding: AutoRole assignment upon join')
                        .catch(err => console.error(`[ONBOARDING ERROR] Failed to assign AutoRole ${autoRole.name}:`, err));
                }
            }

            // 2. Welcome card image and custom text
            if (config.welcomeChannelId) {
                const welcomeChannel = guild.channels.cache.get(config.welcomeChannelId);
                if (!welcomeChannel) return;

                const welcomeCardConfig = await db.getWelcomeCardConfig(guild.id).catch(() => null);

                // Format the custom welcome message template
                let contentText = '';
                if (config.welcomeMessage) {
                    contentText = config.welcomeMessage
                        .replace(/{user}/g, `<@${member.id}>`)
                        .replace(/{username}/g, member.user.username)
                        .replace(/{server}/g, guild.name)
                        .replace(/{memberCount}/g, guild.memberCount.toString());
                }

                if (welcomeCardConfig?.enabled) {
                    // Render and send welcome card image along with custom text in a single message
                    try {
                        const buffer = await renderWelcomeCard(member, guild, welcomeCardConfig.theme, welcomeCardConfig.accentColor);
                        const attachment = new AttachmentBuilder(buffer, { name: `welcome-${member.id}.png` });

                        await welcomeChannel.send({ 
                            content: contentText || undefined, 
                            files: [attachment] 
                        }).catch(err => console.error('[ONBOARDING ERROR] Failed to send welcome card:', err));
                    } catch (err) {
                        console.error('[ONBOARDING ERROR] Welcome card render failed, falling back to text:', err);
                        if (contentText) {
                            await welcomeChannel.send({ content: contentText })
                                .catch(err => console.error('[ONBOARDING ERROR] Failed to send welcome text:', err));
                        }
                    }
                } else if (contentText) {
                    // Welcome card is disabled, send text only
                    await welcomeChannel.send({ content: contentText })
                        .catch(err => console.error('[ONBOARDING ERROR] Failed to send welcome text:', err));
                }
            }
        } catch (err) {
            console.error('[ONBOARDING ERROR] Process failed:', err);
        }
    }
};
