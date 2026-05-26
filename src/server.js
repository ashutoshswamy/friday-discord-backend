const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { randomInt } = require('crypto');
const { ChannelType, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('./utils/db');

// Cryptographically secure Fisher-Yates shuffle
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

module.exports = function(client) {
    const app = express();

    const PORT = process.env.PORT || 5001;
    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Validate required environment variables at startup
    const REQUIRED_ENV = ['JWT_SECRET', 'CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DASHBOARD_REDIRECT_URI'];
    const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
    if (missingEnv.length > 0) {
        console.error(`[ERROR] Missing required environment variables: ${missingEnv.join(', ')}. Refusing to start API server.`);
        process.exit(1);
    }
    const JWT_SECRET = process.env.JWT_SECRET;

    // Enable CORS for frontend only
    app.use(cors({ origin: FRONTEND_URL, credentials: true }));
    app.use(express.json());

    // Global rate limiter — all API routes (200 req/min per IP)
    const globalLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please slow down.' }
    });
    app.use('/api', globalLimiter);

    // Rate limiter for destructive moderation actions (warn/kick/ban/timeout/purge)
    const modActionLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many moderation actions. Slow down.' }
    });

    // ----------------------------------------------------------------
    // Middleware
    // ----------------------------------------------------------------

    // Authenticate JWT Session
    function authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
            req.user = user;
            next();
        });
    }

    // Require Guild Admin permission
    function requireGuildAdmin(req, res, next) {
        const guildId = req.params.guildId || req.body.guildId;
        if (!guildId) return res.status(400).json({ error: 'Missing guildId parameter' });

        const allowedGuilds = req.user.guilds || [];
        const isAuthorized = allowedGuilds.some(g => g.id === guildId && g.canManage);

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to manage this guild' });
        }
        next();
    }

    // ----------------------------------------------------------------
    // Public Status Endpoint (no auth required)
    // ----------------------------------------------------------------

    app.get('/api/status', (req, res) => {
        try {
            const isReady = client.isReady();
            const guilds = isReady ? client.guilds.cache : null;
            const guildCount = guilds ? guilds.size : 0;
            const memberCount = guilds ? guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0) : 0;
            const commandCount = client.commands ? client.commands.size : 0;
            const uptimeMs = isReady ? (client.uptime || 0) : 0;
            const latencyMs = isReady ? client.ws.ping : -1;

            const botUser = isReady && client.user ? {
                id: client.user.id,
                username: client.user.username,
                discriminator: client.user.discriminator,
                avatar: client.user.displayAvatarURL({ size: 128 }),
            } : null;

            res.json({
                online: isReady,
                bot: botUser,
                stats: {
                    guildCount,
                    memberCount,
                    commandCount,
                    uptimeMs,
                    latencyMs,
                },
                checkedAt: Date.now(),
            });
        } catch (err) {
            console.error('[STATUS API]', err);
            res.status(500).json({ online: false, error: 'Failed to retrieve bot status' });
        }
    });

    // ----------------------------------------------------------------
    // Auth Routes
    // ----------------------------------------------------------------

    // OAuth2 Callback Handler
    app.post('/api/auth/callback', async (req, res) => {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing authorization code' });

        if (!CLIENT_SECRET) {
            return res.status(500).json({ error: 'OAuth failed: DISCORD_CLIENT_SECRET is not set in bot env' });
        }

        try {
            // Exchange code for token
            const tokenParams = new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            });

            const tokenResponse = await axios.post(
                'https://discord.com/api/oauth2/token',
                tokenParams.toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const { access_token } = tokenResponse.data;

            // Fetch User Details
            const userResponse = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${access_token}` },
            });
            const user = userResponse.data;

            // Fetch User Guilds
            const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bearer ${access_token}` },
            });
            const userGuilds = guildsResponse.data;

            // Map user guilds to check permission bits (MANAGE_GUILD: 0x20, ADMINISTRATOR: 0x8)
            const guilds = userGuilds.map(g => {
                const permissions = BigInt(g.permissions);
                const canManage = (permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n;
                return {
                    id: g.id,
                    name: g.name,
                    icon: g.icon,
                    canManage: canManage
                };
            });

            // Create JWT Session Token
            const sessionToken = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    discriminator: user.discriminator,
                    avatar: user.avatar,
                    guilds: guilds
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                token: sessionToken,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar
                }
            });
        } catch (err) {
            console.error('[SERVER] OAuth callback error:', err.response?.data || err.message);
            res.status(500).json({ error: 'Failed to authenticate via Discord OAuth' });
        }
    });

    // Check Login Session
    app.get('/api/auth/me', authenticateToken, (req, res) => {
        res.json({ user: req.user });
    });

    // ----------------------------------------------------------------
    // Guild Hub Routes
    // ----------------------------------------------------------------

    // List Manageable Guilds
    app.get('/api/guilds', authenticateToken, (req, res) => {
        const manageableGuilds = req.user.guilds.filter(g => g.canManage);

        const result = manageableGuilds.map(g => {
            const discordGuild = client.guilds.cache.get(g.id);
            const active = !!discordGuild;
            return {
                id: g.id,
                name: g.name,
                icon: g.icon,
                active: active,
                memberCount: discordGuild ? discordGuild.memberCount : null
            };
        });

        res.json(result);
    });

    // ----------------------------------------------------------------
    // Guild Dashboard Telemetry Route
    // ----------------------------------------------------------------

    app.get('/api/guilds/:guildId/dashboard', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) {
            return res.status(404).json({ error: 'Bot is not present in this guild' });
        }

        try {
            // Fetch DB configs in parallel
            const [
                config,
                blockedWords,
                exemptions,
                punishmentRules,
                filterOptOuts,
                shopItems,
                levelRewards,
                dbProfiles,
                dbLogs,
                dbWarnings
            ] = await Promise.all([
                db.getGuildConfig(guildId),
                db.getBlockedWords(guildId),
                db.getExemptions(guildId),
                db.getPunishmentRules(guildId),
                db.getFilterOptOuts(guildId),
                db.getShopItems(guildId),
                db.getLevelRewards(guildId),
                db.getGuildProfiles(guildId),
                db.getGuildLogs(guildId),
                db.getGuildWarnings(guildId)
            ]);

            // Fetch server text channels and roles
            const channels = discordGuild.channels.cache
                .filter(c => c.type === ChannelType.GuildText)
                .map(c => ({ id: c.id, name: c.name }));

            const roles = discordGuild.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

            // Map and calculate statistics
            const memberCount = discordGuild.memberCount;
            const totalCoins = dbProfiles.reduce((sum, p) => sum + (p.coins || 0), 0);
            const avgLevel = dbProfiles.length ? (dbProfiles.reduce((sum, p) => sum + (p.level || 1), 0) / dbProfiles.length).toFixed(1) : 1;
            const warningsCount = dbWarnings.length;

            const voiceChannelCount = discordGuild.channels.cache.filter(c => c.type === 2).size; // GuildVoice
            const categoryCount = discordGuild.channels.cache.filter(c => c.type === 4).size; // GuildCategory
            const totalChannelCount = discordGuild.channels.cache.size;

            res.json({
                guild: {
                    id: discordGuild.id,
                    name: discordGuild.name,
                    icon: discordGuild.icon,
                    memberCount,
                    channels,
                    roles,
                    textChannelCount: channels.length,
                    voiceChannelCount,
                    categoryCount,
                    totalChannelCount,
                    roleCount: roles.length,
                    boostCount: discordGuild.premiumSubscriptionCount || 0,
                    boostTier: discordGuild.premiumTier || 0,
                    createdAt: discordGuild.createdTimestamp,
                    ownerId: discordGuild.ownerId
                },
                stats: {
                    memberCount,
                    warningsCount,
                    totalCoins,
                    avgLevel
                },
                config,
                blockedWords,
                exemptions,
                punishmentRules,
                filterOptOuts,
                shopItems,
                levelRewards,
                logs: dbLogs.slice(0, 50), // Return recent 50 logs
                warnings: dbWarnings
            });
        } catch (err) {
            console.error('[SERVER] Telemetry fetch error:', err);
            res.status(500).json({ error: 'Failed to fetch guild dashboard telemetry data' });
        }
    });

    // ----------------------------------------------------------------
    // AutoMod Configs Updates
    // ----------------------------------------------------------------

    // Update AutoMod / Onboarding config
    app.post('/api/guilds/:guildId/config', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { automodSpam, automodLinks, automodCaps, automodInvites, xpMultiplier, welcomeChannelId, welcomeMessage, autoRoleId } = req.body;

        try {
            const updated = await db.updateGuildConfig(guildId, {
                automodSpam,
                automodLinks,
                automodCaps,
                automodInvites,
                xpMultiplier,
                welcomeChannelId,
                welcomeMessage,
                autoRoleId
            });
            res.json({ success: true, config: updated });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update guild configs' });
        }
    });

    // Add Blocked Word
    app.post('/api/guilds/:guildId/blocked-words', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { pattern } = req.body;

        if (!pattern || pattern.trim() === '') {
            return res.status(400).json({ error: 'Pattern is required' });
        }

        try {
            const success = await db.addBlockedWord(guildId, pattern.trim());
            if (success) {
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Failed to add word (it might already exist)' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Remove Blocked Word
    app.delete('/api/guilds/:guildId/blocked-words/:pattern', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, pattern } = req.params;

        try {
            const success = await db.removeBlockedWord(guildId, pattern);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Add Exemption
    app.post('/api/guilds/:guildId/exemptions', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { type, targetId } = req.body; // type: 'CHANNEL' or 'ROLE'

        if (!type || !targetId) {
            return res.status(400).json({ error: 'Type and targetId are required' });
        }

        try {
            const success = await db.addExemption(guildId, type, targetId);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Remove Exemption
    app.delete('/api/guilds/:guildId/exemptions/:type/:targetId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, type, targetId } = req.params;

        try {
            const success = await db.removeExemption(guildId, type, targetId);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Add filter opt-out
    app.post('/api/guilds/:guildId/filter-optouts', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { filter, channelId } = req.body;
        if (!filter || !channelId) return res.status(400).json({ error: 'filter and channelId are required' });
        try {
            const success = await db.addFilterOptOut(guildId, filter, channelId);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Remove filter opt-out
    app.delete('/api/guilds/:guildId/filter-optouts/:filter/:channelId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, filter, channelId } = req.params;
        try {
            const success = await db.removeFilterOptOut(guildId, filter, channelId);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get all punishment escalation rules
    app.get('/api/guilds/:guildId/rules', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const rules = await db.getPunishmentRules(guildId);
            res.json(rules);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch punishment rules' });
        }
    });

    // Add / update punishment escalation rule
    app.post('/api/guilds/:guildId/rules', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { warnThreshold, punishmentType, durationMs } = req.body;

        if (!warnThreshold || !punishmentType) {
            return res.status(400).json({ error: 'warnThreshold and punishmentType are required' });
        }

        try {
            const rule = await db.addPunishmentRule(guildId, warnThreshold, punishmentType, durationMs || 0);
            res.json({ success: true, rule });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update punishment escalation rule' });
        }
    });

    // Delete punishment escalation rule
    app.delete('/api/guilds/:guildId/rules/:threshold', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, threshold } = req.params;
        try {
            const success = await db.removePunishmentRule(guildId, Number(threshold));
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to remove punishment rule' });
        }
    });

    // ----------------------------------------------------------------
    // Shop & Level Milestones Configurations
    // ----------------------------------------------------------------

    // Add Shop Item
    app.post('/api/guilds/:guildId/shop', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { name, cost, description, roleRewardId } = req.body;

        if (!name || cost === undefined) {
            return res.status(400).json({ error: 'Name and cost are required' });
        }

        try {
            const success = await db.addShopItem(guildId, name.trim(), Number(cost), description || '', roleRewardId || null);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Remove Shop Item
    app.delete('/api/guilds/:guildId/shop/:name', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, name } = req.params;

        try {
            const result = await db.removeShopItem(guildId, name);
            res.json({ success: result.success, reason: result.reason });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Add Level Milestone Reward
    app.post('/api/guilds/:guildId/rewards', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { level, roleId } = req.body;

        if (level === undefined || !roleId) {
            return res.status(400).json({ error: 'Level and RoleId are required' });
        }

        try {
            const success = await db.addLevelReward(guildId, Number(level), roleId);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Remove Level Milestone Reward
    app.delete('/api/guilds/:guildId/rewards/:level', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, level } = req.params;

        try {
            const success = await db.removeLevelReward(guildId, Number(level));
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ----------------------------------------------------------------
    // Rank Card Config
    // ----------------------------------------------------------------

    app.get('/api/guilds/:guildId/rank-card', authenticateToken, requireGuildAdmin, async (req, res) => {
        try {
            const config = await db.getRankCardConfig(req.params.guildId);
            res.json(config);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/guilds/:guildId/rank-card', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { theme, accentColor } = req.body;
        try {
            await db.updateGuildConfig(req.params.guildId, {
                rankCardTheme: theme || 'cyber',
                rankCardAccent: accentColor || null,
            });
            res.json({ ok: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ----------------------------------------------------------------
    // Welcome Card Config
    // ----------------------------------------------------------------

    app.get('/api/guilds/:guildId/welcome-card', authenticateToken, requireGuildAdmin, async (req, res) => {
        try {
            const config = await db.getWelcomeCardConfig(req.params.guildId);
            res.json(config);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/guilds/:guildId/welcome-card', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { theme, accentColor, enabled } = req.body;
        try {
            await db.updateGuildConfig(req.params.guildId, {
                welcomeCardTheme: theme || 'cyber',
                welcomeCardAccent: accentColor || null,
                welcomeCardEnabled: enabled !== undefined ? enabled : false,
            });
            res.json({ ok: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ----------------------------------------------------------------
    // Leaderboard Card Config
    // ----------------------------------------------------------------

    app.get('/api/guilds/:guildId/leaderboard-card', authenticateToken, requireGuildAdmin, async (req, res) => {
        try {
            const config = await db.getLeaderboardCardConfig(req.params.guildId);
            res.json(config);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/guilds/:guildId/leaderboard-card', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { theme, accentColor } = req.body;
        try {
            await db.updateGuildConfig(req.params.guildId, {
                leaderboardTheme: theme || 'cyber',
                leaderboardAccent: accentColor || null,
            });
            res.json({ ok: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // ----------------------------------------------------------------
    // Giveaways
    // ----------------------------------------------------------------

    function parseDuration(str) {
        const match = str.trim().toLowerCase().match(/^(\d+)([smhd])$/);
        if (!match) return null;
        const n = parseInt(match[1]);
        const u = match[2];
        if (u === 's') return n * 1000;
        if (u === 'm') return n * 60 * 1000;
        if (u === 'h') return n * 3600 * 1000;
        if (u === 'd') return n * 86400 * 1000;
        return null;
    }

    app.get('/api/guilds/:guildId/giveaways', authenticateToken, requireGuildAdmin, (req, res) => {
        client.giveaways = client.giveaways || new Map();
        const active = [];
        for (const [id, g] of client.giveaways) {
            if (g.active) active.push({ id, prize: g.prize, winnersCount: g.winnersCount, channelId: g.channelId, endsAt: g.endsAt });
        }
        res.json(active);
    });

    app.post('/api/guilds/:guildId/giveaway', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { channelId, duration, winners, prize } = req.body;
        if (!channelId || !duration || !winners || !prize) return res.status(400).json({ error: 'Missing required fields' });

        const durationMs = parseDuration(duration);
        if (!durationMs || durationMs < 10000) return res.status(400).json({ error: 'Invalid duration. Use formats like 30s, 5m, 2h, 1d. Minimum 10s.' });

        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Guild not found' });
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });

            const endUnix = Math.floor((Date.now() + durationMs) / 1000);
            const embed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY LAUNCHED! 🎉')
                .setDescription(
                    `**Prize:** 🎁 **${prize}**\n` +
                    `**Winners Count:** 👥 ${winners}\n` +
                    `**Time Remaining:** Ends **<t:${endUnix}:R>** (at <t:${endUnix}:f>)\n\n` +
                    `Click the button below to join the draw!`
                )
                .setColor('#FF0099')
                .setFooter({ text: 'Giveaway Entry System · Launched from Dashboard' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('giveaway_join_TEMP').setLabel('🎉 Enter Draw').setStyle(ButtonStyle.Primary)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });

            const realRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`giveaway_join_${msg.id}`).setLabel('🎉 Enter Draw').setStyle(ButtonStyle.Primary)
            );
            await msg.edit({ components: [realRow] });

            client.giveaways = client.giveaways || new Map();
            client.giveaways.set(msg.id, {
                messageId: msg.id,
                channelId,
                prize,
                winnersCount: parseInt(winners),
                entrants: new Set(),
                active: true,
                endsAt: Date.now() + durationMs,
                timer: setTimeout(async () => {
                    try {
                        const g = client.giveaways.get(msg.id);
                        if (!g || !g.active) return;
                        g.active = false;
                        client.giveaways.delete(msg.id);
                        const ch = client.channels.cache.get(channelId);
                        if (!ch) return;
                        const m = await ch.messages.fetch(msg.id).catch(() => null);
                        if (!m) return;
                        const entrants = Array.from(g.entrants);
                        const disabledRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`giveaway_ended_${msg.id}`).setLabel('🔒 Closed').setStyle(ButtonStyle.Secondary).setDisabled(true)
                        );
                        if (!entrants.length) {
                            await m.edit({ embeds: [new EmbedBuilder().setTitle('🎉 GIVEAWAY ENDED 🎉').setColor('#71717a').setDescription(`**Prize:** 🎁 **${g.prize}**\n\n❌ No valid entrants.`).setTimestamp()], components: [disabledRow] });
                            return;
                        }
                        const winners_ = shuffleArray(entrants).slice(0, g.winnersCount);
                        const pings = winners_.map(w => `<@${w}>`).join(', ');
                        await m.edit({ embeds: [new EmbedBuilder().setTitle('🎉 GIVEAWAY RESULTS 🎉').setColor('#FF0099').setDescription(`**Prize Won:** 🎁 **${g.prize}**\n**Winners:** ${pings}!\n\nThank you for participating!`).setTimestamp()], components: [disabledRow] });
                        await ch.send({ content: `🎉 Congratulations ${pings}! You won **${g.prize}**!` });
                    } catch (err) {
                        console.error('[GIVEAWAY TIMER ERROR]', err);
                    }
                }, durationMs),
            });

            res.json({ ok: true, messageId: msg.id });
        } catch (err) {
            console.error('[GIVEAWAY API ERROR]', err);
            res.status(500).json({ error: 'Failed to launch giveaway' });
        }
    });

    app.post('/api/guilds/:guildId/giveaway/:messageId/end', authenticateToken, requireGuildAdmin, async (req, res) => {
        client.giveaways = client.giveaways || new Map();
        const { messageId } = req.params;
        const g = client.giveaways.get(messageId);
        if (!g || !g.active) return res.status(404).json({ error: 'Active giveaway not found' });

        g.active = false;
        clearTimeout(g.timer);
        client.giveaways.delete(messageId);

        try {
            const ch = client.channels.cache.get(g.channelId);
            if (ch) {
                const m = await ch.messages.fetch(messageId).catch(() => null);
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`giveaway_ended_${messageId}`).setLabel('🔒 Closed').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                const entrants = Array.from(g.entrants);
                if (!entrants.length) {
                    if (m) await m.edit({ embeds: [new EmbedBuilder().setTitle('🎉 GIVEAWAY ENDED 🎉').setColor('#71717a').setDescription(`**Prize:** 🎁 **${g.prize}**\n\n❌ No valid entrants.`).setTimestamp()], components: [disabledRow] });
                } else {
                    const winners = shuffleArray(entrants).slice(0, g.winnersCount);
                    const pings = winners.map(w => `<@${w}>`).join(', ');
                    if (m) await m.edit({ embeds: [new EmbedBuilder().setTitle('🎉 GIVEAWAY RESULTS 🎉').setColor('#FF0099').setDescription(`**Prize Won:** 🎁 **${g.prize}**\n**Winners:** ${pings}!\n\nThank you for participating!`).setTimestamp()], components: [disabledRow] });
                    await ch.send({ content: `🎉 Congratulations ${pings}! You won **${g.prize}**!` });
                }
            }
            res.json({ ok: true });
        } catch (err) {
            console.error('[GIVEAWAY END API ERROR]', err);
            res.status(500).json({ error: 'Failed to end giveaway' });
        }
    });

    app.post('/api/guilds/:guildId/giveaway/:messageId/reroll', authenticateToken, requireGuildAdmin, async (req, res) => {
        client.giveaways = client.giveaways || new Map();
        const { messageId } = req.params;
        const g = client.giveaways.get(messageId);
        if (!g) return res.status(404).json({ error: 'Giveaway not found in memory' });

        const entrants = Array.from(g.entrants);
        if (!entrants.length) return res.status(400).json({ error: 'No entrants to reroll from' });

        try {
            const ch = client.channels.cache.get(g.channelId);
            if (!ch) return res.status(404).json({ error: 'Channel not found' });
            const winners = shuffleArray(entrants).slice(0, g.winnersCount);
            const pings = winners.map(w => `<@${w}>`).join(', ');
            await ch.send({ content: `🎉 Reroll! Congratulations ${pings}! You won **${g.prize}**!`, embeds: [new EmbedBuilder().setTitle('🎉 GIVEAWAY RE-ROLLED! 🎉').setColor('#FF0099').setDescription(`**Prize:** 🎁 **${g.prize}**\n**New Winners:** ${pings}!`).setTimestamp()] });
            res.json({ ok: true });
        } catch (err) {
            console.error('[GIVEAWAY REROLL API ERROR]', err);
            res.status(500).json({ error: 'Failed to reroll giveaway' });
        }
    });

    // ----------------------------------------------------------------
    // Events
    // ----------------------------------------------------------------

    app.post('/api/guilds/:guildId/event', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { channelId, title, description, date, location } = req.body;
        if (!channelId || !title || !description || !date || !location) return res.status(400).json({ error: 'Missing required fields' });

        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Guild not found' });
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });

            const embed = new EmbedBuilder()
                .setTitle(`📅 Guild Event: ${title}`)
                .setColor('#FFCC00')
                .setThumbnail(guild.iconURL({ forceStatic: true }))
                .setDescription(description)
                .addFields(
                    { name: '⏰ Date / Time', value: `\`${date}\``, inline: true },
                    { name: '📍 Location', value: `\`${location}\``, inline: true },
                    { name: '👥 RSVPs (0)', value: '*No one yet*', inline: false }
                )
                .setFooter({ text: 'Click RSVP below to attend · Created from Dashboard' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('event_rsvp_TEMP').setLabel('⏰ RSVP / Attend').setStyle(ButtonStyle.Success)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });

            const realRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`event_rsvp_${msg.id}`).setLabel('⏰ RSVP / Attend').setStyle(ButtonStyle.Success)
            );
            await msg.edit({ components: [realRow] });

            client.events = client.events || new Map();
            client.events.set(msg.id, { messageId: msg.id, title, description, date, location, channelId, rsvps: new Set() });

            res.json({ ok: true, messageId: msg.id });
        } catch (err) {
            console.error('[EVENT API ERROR]', err);
            res.status(500).json({ error: 'Failed to create event' });
        }
    });

    // ----------------------------------------------------------------
    // Reaction Roles
    // ----------------------------------------------------------------

    app.post('/api/guilds/:guildId/reaction-roles', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { channelId, title, description, roleIds } = req.body;
        if (!channelId || !title || !description || !roleIds?.length) return res.status(400).json({ error: 'Missing required fields' });

        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Guild not found' });
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor('#00FFCC')
                .setTimestamp();

            const row = new ActionRowBuilder();
            for (const roleId of roleIds.slice(0, 5)) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    row.addComponents(
                        new ButtonBuilder().setCustomId(`role_${role.id}`).setLabel(role.name).setStyle(ButtonStyle.Primary)
                    );
                }
            }

            await channel.send({ embeds: [embed], components: [row] });
            res.json({ ok: true });
        } catch (err) {
            console.error('[REACTION ROLE API ERROR]', err);
            res.status(500).json({ error: 'Failed to deploy reaction role panel' });
        }
    });

    // ----------------------------------------------------------------
    // Member Operations
    // ----------------------------------------------------------------

    // Fetch Guild Members combined with Database Leveling & Economy Profiles
    app.get('/api/guilds/:guildId/members', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) {
            return res.status(404).json({ error: 'Bot is not in this guild' });
        }

        try {
            // Fetch database records
            const [dbProfiles, dbWarnings] = await Promise.all([
                db.getGuildProfiles(guildId),
                db.getGuildWarnings(guildId)
            ]);

            // Map warnings count per user
            const warningsMap = {};
            dbWarnings.forEach(w => {
                warningsMap[w.userId] = (warningsMap[w.userId] || 0) + 1;
            });

            // Map DB profiles to key-value maps
            const profilesMap = {};
            dbProfiles.forEach(p => {
                profilesMap[p.userId] = p;
            });

            // Fetch live discord members with robust catch & timeout to fallback to local cache on rate limits
            let fetchedMembers;
            try {
                fetchedMembers = await Promise.race([
                    discordGuild.members.fetch(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Discord Gateway Request Timeout')), 5000))
                ]);
            } catch (fetchErr) {
                console.warn('[SERVER] Live members fetch failed or rate limited. Falling back to local cache.', fetchErr.message || fetchErr);
                fetchedMembers = discordGuild.members.cache;
            }
            
            const members = fetchedMembers.map(m => {
                const dbProfile = profilesMap[m.id] || {};
                
                return {
                    id: m.id,
                    username: m.user.username,
                    tag: m.user.tag,
                    avatar: m.user.displayAvatarURL({ forceStatic: true, size: 64 }),
                    isBot: m.user.bot,
                    nickname: m.nickname || null,
                    joinedAt: m.joinedTimestamp,
                    roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
                    coins: dbProfile.coins !== undefined ? dbProfile.coins : 100,
                    bank: dbProfile.bank !== undefined ? dbProfile.bank : 0,
                    xp: dbProfile.xp !== undefined ? dbProfile.xp : 0,
                    level: dbProfile.level !== undefined ? dbProfile.level : 1,
                    warningCount: warningsMap[m.id] || 0
                };
            });

            res.json(members);
        } catch (err) {
            console.error('[SERVER] Members fetch error:', err);
            res.status(500).json({ error: 'Failed to fetch guild members' });
        }
    });

    // Award / Set Member Coins
    app.post('/api/guilds/:guildId/members/:userId/economy', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId } = req.params;
        const { amount, action } = req.body; // action: 'ADD', 'REMOVE', 'SET'

        if (amount === undefined || !action) {
            return res.status(400).json({ error: 'Amount and Action are required' });
        }

        try {
            const profile = await db.getProfile(guildId, userId);
            let change = Number(amount);
            if (action === 'REMOVE') change = -change;
            if (action === 'SET') change = change - profile.coins;

            const finalBalance = await db.updateCoins(guildId, userId, change);
            await db.logInfraction(guildId, userId, req.user.id, 'ECONOMY_UPDATE', `Admin Coins adjustment (${action} ${amount})`);
            
            res.json({ success: true, coins: finalBalance });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to adjust member coins' });
        }
    });

    // Update Member Leveling XP / Level
    app.post('/api/guilds/:guildId/members/:userId/xp', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId } = req.params;
        const { amount, action } = req.body; // action: 'ADD', 'REMOVE', 'SET'

        if (amount === undefined || !action) {
            return res.status(400).json({ error: 'Amount and Action are required' });
        }

        try {
            const result = await db.updateXpAdmin(guildId, userId, action, Number(amount));
            await db.logInfraction(guildId, userId, req.user.id, 'XP_UPDATE', `Admin XP adjustment (${action} ${amount})`);
            
            res.json({ success: true, level: result.level, xp: result.xp });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update member XP' });
        }
    });

    // ----------------------------------------------------------------
    // Live Discord Moderation Operations
    // ----------------------------------------------------------------

    // Returns an error string if the dashboard user cannot act on the target, null if allowed.
    // Mirrors the role-hierarchy checks that the slash commands enforce.
    async function checkModerationHierarchy(guild, moderatorDiscordId, targetMember) {
        // Never allow acting on the guild owner
        if (targetMember.id === guild.ownerId) {
            return 'You cannot perform moderation actions on the server owner.';
        }
        // Fetch the moderator's guild member to compare role positions
        const moderatorMember = await guild.members.fetch(moderatorDiscordId).catch(() => null);
        if (!moderatorMember) return 'Your account could not be found in this server.';
        // Guild owners bypass role hierarchy
        if (moderatorMember.id === guild.ownerId) return null;
        // Target must be lower in the role hierarchy than the moderator
        if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position) {
            return 'You cannot perform this action on a member with an equal or higher role than yours.';
        }
        return null;
    }

    // Issue Warning to Member (with automatic escalation checks)
    app.post('/api/guilds/:guildId/members/:userId/warn', authenticateToken, requireGuildAdmin, modActionLimiter, async (req, res) => {
        const { guildId, userId } = req.params;
        const { reason } = req.body;

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });

        try {
            const member = await discordGuild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in server' });

            const hierarchyError = await checkModerationHierarchy(discordGuild, req.user.id, member);
            if (hierarchyError) return res.status(403).json({ error: hierarchyError });

            const realReason = reason || 'No reason provided by Admin Dashboard';

            // Add warning & infraction to DB
            const warning = await db.addWarning(guildId, userId, req.user.id, realReason);
            await db.logInfraction(guildId, userId, req.user.id, 'WARN', realReason);

            // Fetch warning count
            const allWarns = await db.getWarnings(guildId, userId);
            const warnCount = allWarns.length;

            // DM warned user
            await member.send(`⚠️ **Warning Issued**\nYou have been warned in **${discordGuild.name}**.\n• **Reason:** ${realReason}`).catch(() => null);

            // Execute Escalations — check all rules for exact threshold match
            const rules = await db.getPunishmentRules(guildId);
            const matchingRule = rules.find(r => warnCount === r.warnThreshold);
            let escalationTriggered = null;

            if (matchingRule) {
                escalationTriggered = matchingRule.punishmentType;
                const escReason = `[AUTOMOD ESCALATION] Reached threshold of ${matchingRule.warnThreshold} warnings.`;

                try {
                    if (matchingRule.punishmentType === 'TIMEOUT') {
                        if (member.moderatable) {
                            await member.timeout(matchingRule.durationMs, escReason);
                            await db.logInfraction(guildId, userId, client.user.id, 'TIMEOUT', `AutoMod escalation timeout`);
                        }
                    } else if (matchingRule.punishmentType === 'KICK') {
                        if (member.kickable) {
                            await member.kick(escReason);
                            await db.logInfraction(guildId, userId, client.user.id, 'KICK', `AutoMod escalation kick`);
                        }
                    } else if (matchingRule.punishmentType === 'BAN') {
                        if (member.bannable) {
                            await member.ban({ reason: escReason });
                            await db.logInfraction(guildId, userId, client.user.id, 'BAN', `AutoMod escalation ban`);
                        }
                    }
                } catch (e) {
                    console.error('[SERVER] Escalation application failed:', e);
                }
            }

            res.json({
                success: true,
                warning,
                warnCount,
                escalationTriggered
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to issue warning' });
        }
    });

    // Delete Warning
    app.delete('/api/guilds/:guildId/members/:userId/warnings/:warningId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId, warningId } = req.params;

        try {
            const success = await db.deleteWarning(guildId, userId, warningId);
            if (success) {
                await db.logInfraction(guildId, userId, req.user.id, 'CLEAR_WARN', `Removed Warning ID ${warningId}`);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Warning not found or failed to delete' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Clear All Warnings
    app.post('/api/guilds/:guildId/members/:userId/clear-warnings', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId } = req.params;

        try {
            const count = await db.clearAllWarnings(guildId, userId);
            await db.logInfraction(guildId, userId, req.user.id, 'CLEAR_WARN', `Cleared all warnings (${count} cleared)`);
            res.json({ success: true, clearedCount: count });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to clear warnings' });
        }
    });

    // Live Member Timeout
    app.post('/api/guilds/:guildId/members/:userId/timeout', authenticateToken, requireGuildAdmin, modActionLimiter, async (req, res) => {
        const { guildId, userId } = req.params;
        const { durationMs, reason } = req.body;

        if (!durationMs) return res.status(400).json({ error: 'Duration is required' });

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });

        try {
            const member = await discordGuild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in server' });

            const hierarchyError = await checkModerationHierarchy(discordGuild, req.user.id, member);
            if (hierarchyError) return res.status(403).json({ error: hierarchyError });

            if (!member.moderatable) {
                return res.status(403).json({ error: 'This user is higher-ranking or cannot be timed out by the bot' });
            }

            const realReason = reason || 'Admin Dashboard Timeout';
            await member.timeout(Number(durationMs), realReason);
            await db.logInfraction(guildId, userId, req.user.id, 'TIMEOUT', realReason);

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to execute Discord timeout' });
        }
    });

    // Live Member Kick
    app.post('/api/guilds/:guildId/members/:userId/kick', authenticateToken, requireGuildAdmin, modActionLimiter, async (req, res) => {
        const { guildId, userId } = req.params;
        const { reason } = req.body;

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });

        try {
            const member = await discordGuild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in server' });

            const hierarchyError = await checkModerationHierarchy(discordGuild, req.user.id, member);
            if (hierarchyError) return res.status(403).json({ error: hierarchyError });

            if (!member.kickable) {
                return res.status(403).json({ error: 'This user is higher-ranking or cannot be kicked by the bot' });
            }

            const realReason = reason || 'Admin Dashboard Kick';
            await member.kick(realReason);
            await db.logInfraction(guildId, userId, req.user.id, 'KICK', realReason);

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to execute Discord kick' });
        }
    });

    // Live Member Ban
    app.post('/api/guilds/:guildId/members/:userId/ban', authenticateToken, requireGuildAdmin, modActionLimiter, async (req, res) => {
        const { guildId, userId } = req.params;
        const { reason, deleteMessageSeconds } = req.body;

        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });

        try {
            const member = await discordGuild.members.fetch(userId).catch(() => null);

            // If the target is in the server, enforce hierarchy and bot-rank checks
            if (member) {
                const hierarchyError = await checkModerationHierarchy(discordGuild, req.user.id, member);
                if (hierarchyError) return res.status(403).json({ error: hierarchyError });

                if (!member.bannable) {
                    return res.status(403).json({ error: 'This user is higher-ranking or cannot be banned by the bot' });
                }
            }

            const realReason = reason || 'Admin Dashboard Ban';
            await discordGuild.members.ban(userId, {
                reason: realReason,
                deleteMessageSeconds: deleteMessageSeconds || 0
            });
            await db.logInfraction(guildId, userId, req.user.id, 'BAN', realReason);

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to execute Discord ban' });
        }
    });

    // Remove Timeout (Untimeout)
    app.post('/api/guilds/:guildId/members/:userId/untimeout', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId } = req.params;
        const { reason } = req.body;
        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });
        try {
            const member = await discordGuild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in server' });
            await member.timeout(null, reason || 'Admin Dashboard: Timeout removed');
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to remove timeout' });
        }
    });

    // Unban
    app.post('/api/guilds/:guildId/unban', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { userId, reason } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });
        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });
        try {
            await discordGuild.members.unban(userId, reason || 'Admin Dashboard: Unban');
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to unban user. Verify the ID is correct and the user is banned.' });
        }
    });

    // Channel Lockdown
    app.post('/api/guilds/:guildId/channels/:channelId/lockdown', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, channelId } = req.params;
        const { lock } = req.body; // true = lock, false = unlock
        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });
        try {
            const channel = discordGuild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            await channel.permissionOverwrites.edit(discordGuild.roles.everyone, {
                SendMessages: lock ? false : null
            });
            res.json({ success: true, locked: lock });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update channel permissions' });
        }
    });

    // Slowmode
    app.post('/api/guilds/:guildId/channels/:channelId/slowmode', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, channelId } = req.params;
        const { seconds } = req.body;
        if (seconds === undefined) return res.status(400).json({ error: 'seconds is required' });
        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });
        try {
            const channel = discordGuild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            await channel.setRateLimitPerUser(Number(seconds), 'Admin Dashboard slowmode');
            res.json({ success: true, seconds: Number(seconds) });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to set slowmode' });
        }
    });

    // Purge messages
    app.post('/api/guilds/:guildId/channels/:channelId/purge', authenticateToken, requireGuildAdmin, modActionLimiter, async (req, res) => {
        const { guildId, channelId } = req.params;
        const { amount, filter } = req.body; // amount 1-100, filter: 'bots'|'links'|'attachments'|'embeds'|null
        if (!amount || amount < 1 || amount > 100) return res.status(400).json({ error: 'amount must be 1-100' });
        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });
        try {
            const channel = discordGuild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            const messages = await channel.messages.fetch({ limit: Number(amount) });
            let toDelete = [...messages.values()];
            if (filter === 'bots')        toDelete = toDelete.filter(m => m.author.bot);
            if (filter === 'links')       toDelete = toDelete.filter(m => /https?:\/\//i.test(m.content));
            if (filter === 'attachments') toDelete = toDelete.filter(m => m.attachments.size > 0);
            if (filter === 'embeds')      toDelete = toDelete.filter(m => m.embeds.length > 0);
            // bulkDelete only works for messages under 14 days old
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
            toDelete = toDelete.filter(m => m.createdTimestamp > cutoff);
            if (toDelete.length === 0) return res.json({ deleted: 0 });
            await channel.bulkDelete(toDelete, true);
            res.json({ deleted: toDelete.length });
        } catch (err) {
            console.error('[PURGE API]', err);
            res.status(500).json({ error: 'Failed to purge messages' });
        }
    });

    // Send embed to channel
    app.post('/api/guilds/:guildId/channels/:channelId/send-embed', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, channelId } = req.params;
        const { title, description, color, image, thumbnail } = req.body;
        if (!description) return res.status(400).json({ error: 'description is required' });
        const discordGuild = client.guilds.cache.get(guildId);
        if (!discordGuild) return res.status(404).json({ error: 'Guild not found' });
        try {
            const channel = discordGuild.channels.cache.get(channelId);
            if (!channel) return res.status(404).json({ error: 'Channel not found' });
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor(color || '#00FFCC')
                .setTimestamp();
            if (title) embed.setTitle(title);
            if (image && image.startsWith('http')) embed.setImage(image);
            if (thumbnail && thumbnail.startsWith('http')) embed.setThumbnail(thumbnail);
            await channel.send({ embeds: [embed] });
            res.json({ success: true });
        } catch (err) {
            console.error('[SEND-EMBED API]', err);
            res.status(500).json({ error: 'Failed to send embed' });
        }
    });

    // Moderator stats
    app.get('/api/guilds/:guildId/modstats', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const logs = await db.getGuildLogs(guildId);
            const statsMap = {};
            for (const l of logs) {
                const mid = l.moderatorId;
                if (!mid) continue;
                if (!statsMap[mid]) statsMap[mid] = { moderatorId: mid, WARN: 0, TIMEOUT: 0, KICK: 0, BAN: 0, total: 0 };
                if (l.type.includes('WARN')) statsMap[mid].WARN++;
                else if (l.type === 'TIMEOUT') statsMap[mid].TIMEOUT++;
                else if (l.type === 'KICK') statsMap[mid].KICK++;
                else if (l.type.includes('BAN')) statsMap[mid].BAN++;
                statsMap[mid].total++;
            }
            res.json(Object.values(statsMap).sort((a, b) => b.total - a.total));
        } catch (err) {
            console.error('[MODSTATS API]', err);
            res.status(500).json({ error: 'Failed to fetch modstats' });
        }
    });

    // ----------------------------------------------------------------
    // Custom Commands
    // ----------------------------------------------------------------

    app.get('/api/guilds/:guildId/customcmds', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const cmds = await db.getCustomCommands(guildId);
            res.json(cmds);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch custom commands' });
        }
    });

    app.post('/api/guilds/:guildId/customcmds', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { name, text } = req.body;
        if (!name || !text) return res.status(400).json({ error: 'name and text are required' });
        try {
            const success = await db.addCustomCommand(guildId, name.toLowerCase().trim(), text);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to add custom command' });
        }
    });

    app.delete('/api/guilds/:guildId/customcmds/:name', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, name } = req.params;
        try {
            const success = await db.removeCustomCommand(guildId, name);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to delete custom command' });
        }
    });

    // ----------------------------------------------------------------
    // Social Media Alerts
    // ----------------------------------------------------------------

    // Get all alerts (YouTube + Twitch combined)
    app.get('/api/guilds/:guildId/alerts', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const [ytAlerts, twAlerts] = await Promise.all([
                db.getYoutubeAlerts(guildId),
                db.getTwitchAlerts(guildId)
            ]);
            const combined = [
                ...ytAlerts.map(a => ({ platform: 'youtube', url: a.youtubeUrl, channelId: a.channelId })),
                ...twAlerts.map(a => ({ platform: 'twitch', username: a.twitchUsername, channelId: a.channelId }))
            ];
            res.json(combined);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch alerts' });
        }
    });

    // Add YouTube alert
    app.post('/api/guilds/:guildId/alerts/youtube', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { url, channelId } = req.body;
        if (!url || !channelId) return res.status(400).json({ error: 'url and channelId are required' });
        try {
            const success = await db.addYoutubeAlert(guildId, channelId, url);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to add YouTube alert' });
        }
    });

    // Remove YouTube alert
    app.delete('/api/guilds/:guildId/alerts/youtube/:url', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, url } = req.params;
        try {
            const success = await db.removeYoutubeAlert(guildId, decodeURIComponent(url));
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to remove YouTube alert' });
        }
    });

    // Add Twitch alert
    app.post('/api/guilds/:guildId/alerts/twitch', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { username, channelId } = req.body;
        if (!username || !channelId) return res.status(400).json({ error: 'username and channelId are required' });
        try {
            const success = await db.addTwitchAlert(guildId, channelId, username);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to add Twitch alert' });
        }
    });

    // Remove Twitch alert
    app.delete('/api/guilds/:guildId/alerts/twitch/:username', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, username } = req.params;
        try {
            const success = await db.removeTwitchAlert(guildId, username);
            res.json({ success });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to remove Twitch alert' });
        }
    });

    // ----------------------------------------------------------------
    // Economy Dashboard — Inventory, Pets, Market
    // ----------------------------------------------------------------

    // Lazy-load the shared supabase client from db.js
    function getSupabase() {
        const { createClient } = require('@supabase/supabase-js');
        return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    }

    // Derive item category from name
    const deriveItemType = (name) => {
        const n = name.toLowerCase();
        if (['rifle', 'pole', 'shovel'].some(k => n.includes(k))) return 'tool';
        if (['bass', 'salmon', 'goldfish', 'coral fish', 'whale', 'seaweed', 'boot', 'fish'].some(k => n.includes(k))) return 'fish';
        if (['bear', 'deer', 'wolf', 'moose', 'boar', 'fox', 'elk'].some(k => n.includes(k))) return 'hunt';
        if (['worm', 'fossil', 'vase', 'gold chest', 'gem'].some(k => n.includes(k))) return 'dig';
        if (['pizza', 'bread', 'apple', 'food'].some(k => n.includes(k))) return 'food';
        if (['lootbox', 'mystery', 'crate'].some(k => n.includes(k))) return 'loot';
        return 'other';
    };

    // Get all inventory items for a guild — grouped by (user_id, item_name) with count
    app.get('/api/guilds/:guildId/economy/inventory', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const supa = getSupabase();
            const { data, error } = await supa
                .from('user_inventory')
                .select('id, guild_id, user_id, item_name, purchased_at')
                .eq('guild_id', guildId)
                .order('purchased_at', { ascending: false });
            if (error) throw error;

            // Group by (user_id, item_name); keep latest acquired_at and id per group
            const grouped = {};
            for (const row of (data || [])) {
                const key = `${row.user_id}::${row.item_name}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        id: row.id,
                        guild_id: row.guild_id,
                        user_id: row.user_id,
                        item_name: row.item_name,
                        item_type: deriveItemType(row.item_name),
                        acquired_at: row.purchased_at,
                        count: 0,
                    };
                }
                grouped[key].count++;
            }
            res.json(Object.values(grouped));
        } catch (err) {
            console.error('[INVENTORY API]', err);
            res.status(500).json({ error: 'Failed to fetch inventory data' });
        }
    });

    // Grant item(s) to a user (admin)
    app.post('/api/guilds/:guildId/economy/inventory', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { userId, itemName, count } = req.body;
        if (!userId || !itemName) return res.status(400).json({ error: 'userId and itemName are required' });
        const qty = Math.max(1, Math.min(100, parseInt(count) || 1));
        try {
            const supa = getSupabase();
            const rows = Array.from({ length: qty }, () => ({ guild_id: guildId, user_id: userId, item_name: itemName }));
            const { error } = await supa.from('user_inventory').insert(rows);
            if (error) throw error;
            res.json({ success: true, granted: qty });
        } catch (err) {
            console.error('[INVENTORY GRANT API]', err);
            res.status(500).json({ error: 'Failed to grant inventory items' });
        }
    });

    // Remove all instances of an item for a specific user (admin bulk delete)
    app.delete('/api/guilds/:guildId/economy/inventory', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        const { userId, itemName } = req.body;
        if (!userId || !itemName) return res.status(400).json({ error: 'userId and itemName are required' });
        try {
            const supa = getSupabase();
            const { error } = await supa
                .from('user_inventory')
                .delete()
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('item_name', itemName);
            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            console.error('[INVENTORY BULK DELETE API]', err);
            res.status(500).json({ error: 'Failed to remove inventory items' });
        }
    });

    // Remove a single inventory item by id (kept for compatibility)
    app.delete('/api/guilds/:guildId/economy/inventory/:itemId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, itemId } = req.params;
        try {
            const supa = getSupabase();
            const { error } = await supa
                .from('user_inventory')
                .delete()
                .eq('id', Number(itemId))
                .eq('guild_id', guildId);
            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            console.error('[INVENTORY DELETE API]', err);
            res.status(500).json({ error: 'Failed to remove inventory item' });
        }
    });

    // Get all pets for a guild
    // NOTE: user_pets uses a composite PK (guild_id, user_id) — no surrogate id column
    app.get('/api/guilds/:guildId/economy/pets', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const supa = getSupabase();
            const { data, error } = await supa
                .from('user_pets')
                .select('*')
                .eq('guild_id', guildId)
                .order('level', { ascending: false });
            if (error) throw error;
            res.json((data || []).map(p => ({
                id: `${p.guild_id}_${p.user_id}`,
                userId: p.user_id,
                petName: p.pet_name,
                petType: p.pet_type,
                level: Number(p.level || 1),
                xp: Number(p.xp || 0),
                hunger: Number(p.hunger ?? 50),
                affection: Number(p.affection ?? 50),
                energy: Number(p.energy ?? 100),
                attack: Number(p.attack || 5),
                defense: Number(p.defense || 5),
                lastFed: p.last_fed,
                lastTrained: p.last_trained
            })));
        } catch (err) {
            console.error('[PETS API]', err);
            res.status(500).json({ error: 'Failed to fetch pets data' });
        }
    });

    // Admin: update pet stats / level  (petId = `${guildId}_${userId}`)
    app.patch('/api/guilds/:guildId/economy/pets/:petId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, petId } = req.params;
        const userId = petId.slice(guildId.length + 1);
        if (!userId) return res.status(400).json({ error: 'Invalid petId' });
        const { hunger, energy, affection, level } = req.body;
        const updates = {};
        if (hunger  !== undefined) updates.hunger    = Math.min(100, Math.max(0, Number(hunger)));
        if (energy  !== undefined) updates.energy    = Math.min(100, Math.max(0, Number(energy)));
        if (affection !== undefined) updates.affection = Math.min(100, Math.max(0, Number(affection)));
        if (level   !== undefined) updates.level     = Math.min(100, Math.max(1, Number(level)));
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
        try {
            const supa = getSupabase();
            const { data, error } = await supa
                .from('user_pets')
                .update(updates)
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .select('*')
                .single();
            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Pet not found' });
            res.json({
                id: `${data.guild_id}_${data.user_id}`,
                userId: data.user_id,
                petName: data.pet_name,
                petType: data.pet_type,
                level: Number(data.level || 1),
                hunger: Number(data.hunger ?? 50),
                affection: Number(data.affection ?? 50),
                energy: Number(data.energy ?? 100),
                attack: Number(data.attack || 5),
                defense: Number(data.defense || 5),
            });
        } catch (err) {
            console.error('[PET PATCH API]', err);
            res.status(500).json({ error: 'Failed to update pet' });
        }
    });

    // Admin: delete a pet  (petId = `${guildId}_${userId}`)
    app.delete('/api/guilds/:guildId/economy/pets/:petId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, petId } = req.params;
        const userId = petId.slice(guildId.length + 1);
        if (!userId) return res.status(400).json({ error: 'Invalid petId' });
        try {
            const supa = getSupabase();
            const { error } = await supa
                .from('user_pets')
                .delete()
                .eq('guild_id', guildId)
                .eq('user_id', userId);
            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            console.error('[PET DELETE API]', err);
            res.status(500).json({ error: 'Failed to delete pet' });
        }
    });

    // Get all market listings for a guild
    // NOTE: market_listings uses 'created_at' correctly
    app.get('/api/guilds/:guildId/economy/market', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const supa = getSupabase();
            const { data, error } = await supa
                .from('market_listings')
                .select('*')
                .eq('guild_id', guildId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            res.json((data || []).map(l => ({
                id: l.id,
                sellerId: l.seller_id,
                itemName: l.item_name,
                price: Number(l.price),
                createdAt: l.created_at
            })));
        } catch (err) {
            console.error('[MARKET API]', err);
            res.status(500).json({ error: 'Failed to fetch market listings' });
        }
    });

    // Admin: remove a market listing and return the item to the seller
    app.delete('/api/guilds/:guildId/economy/market/:listingId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, listingId } = req.params;
        try {
            const supa = getSupabase();
            const { data: listing } = await supa
                .from('market_listings')
                .select('*')
                .eq('id', Number(listingId))
                .maybeSingle();
            if (!listing) return res.status(404).json({ error: 'Listing not found' });
            // Remove listing
            await supa.from('market_listings').delete().eq('id', Number(listingId));
            // Return item to seller — use purchased_at column name correctly
            await supa.from('user_inventory').insert([{
                guild_id: guildId,
                user_id: listing.seller_id,
                item_name: listing.item_name
            }]);
            res.json({ success: true });
        } catch (err) {
            console.error('[MARKET DELETE API]', err);
            res.status(500).json({ error: 'Failed to remove market listing' });
        }
    });

    // ── Jobs ──
    app.get('/api/guilds/:guildId/economy/jobs', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const jobs = await db.getGuildJobs(guildId);
            res.json(jobs);
        } catch (err) {
            console.error('[JOBS GET API]', err);
            res.status(500).json({ error: 'Failed to fetch jobs' });
        }
    });

    app.post('/api/guilds/:guildId/economy/jobs/:userId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId } = req.params;
        const { jobKey } = req.body;
        if (!jobKey) return res.status(400).json({ error: 'jobKey required' });
        try {
            await db.adminSetJob(guildId, userId, jobKey);
            res.json({ success: true });
        } catch (err) {
            console.error('[JOBS POST API]', err);
            res.status(500).json({ error: 'Failed to set job' });
        }
    });

    app.delete('/api/guilds/:guildId/economy/jobs/:userId', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId, userId } = req.params;
        try {
            await db.adminSetJob(guildId, userId, null);
            res.json({ success: true });
        } catch (err) {
            console.error('[JOBS DELETE API]', err);
            res.status(500).json({ error: 'Failed to clear job' });
        }
    });

    // ── Tickets ──
    app.get('/api/guilds/:guildId/tickets', authenticateToken, requireGuildAdmin, async (req, res) => {
        const { guildId } = req.params;
        try {
            const tickets = await db.getTickets(guildId);
            res.json(tickets);
        } catch (err) {
            console.error('[TICKETS API]', err);
            res.status(500).json({ error: 'Failed to fetch tickets' });
        }
    });

    // ----------------------------------------------------------------
    // Stocks — Catalog, Charts, Portfolio Admin
    // ----------------------------------------------------------------

    // Full stock catalog with live prices (auth required, no guild scope needed)
    app.get('/api/stocks/catalog', authenticateToken, (req, res) => {
        const catalog = Object.keys(db.STOCK_CATALOG).map(sym => {
            const q = db.getStockPrice(sym);
            return q ? {
                symbol: q.symbol,
                name: q.name,
                market: q.market,
                currency: q.currency,
                price: q.price,
                changePercent: q.changePercent
            } : null;
        }).filter(Boolean);
        res.json(catalog);
    });

    // 48-point 24-hour price history for a symbol
    app.get('/api/stocks/chart/:symbol', authenticateToken, (req, res) => {
        const data = db.getStockChartData(req.params.symbol.toUpperCase());
        if (!data) return res.status(404).json({ error: 'Symbol not found' });
        res.json(data);
    });

    // Admin: grant or revoke stock shares for a member (no coin cost / credit)
    app.post('/api/guilds/:guildId/members/:userId/portfolio', authenticateToken, requireGuildAdmin, modActionLimiter, async (req, res) => {
        const { guildId, userId } = req.params;
        const { symbol, shares, action } = req.body; // action: 'GRANT' | 'REVOKE'

        if (!symbol || shares === undefined || !action) {
            return res.status(400).json({ error: 'symbol, shares, and action are required' });
        }
        if (!['GRANT', 'REVOKE'].includes(action)) {
            return res.status(400).json({ error: 'action must be GRANT or REVOKE' });
        }
        if (Number(shares) <= 0) {
            return res.status(400).json({ error: 'shares must be a positive number' });
        }

        try {
            let result;
            if (action === 'GRANT') {
                result = await db.adminGrantStock(guildId, userId, symbol.toUpperCase(), Number(shares));
                await db.logInfraction(guildId, userId, req.user.id, 'ECONOMY_UPDATE', `Admin stock grant: +${shares} ${symbol.toUpperCase()}`);
            } else {
                result = await db.adminRevokeStock(guildId, userId, symbol.toUpperCase(), Number(shares));
                await db.logInfraction(guildId, userId, req.user.id, 'ECONOMY_UPDATE', `Admin stock revoke: -${shares} ${symbol.toUpperCase()}`);
            }
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('[PORTFOLIO ADMIN API]', err);
            res.status(400).json({ error: err.message });
        }
    });

    // Health check
    app.get('/', (req, res) => {
        res.json({ status: 'ok', bot: client.user?.tag || 'starting', uptime: Math.floor(process.uptime()) });
    });

    // Minimal ping endpoint for cron keep-alive (plain text, ~2 bytes)
    app.get('/ping', (req, res) => res.send('ok'));

    // Global error handler — prevents stack traces leaking in API responses
    app.use((err, req, res, _next) => {
        console.error('[SERVER UNHANDLED ERROR]', err);
        res.status(500).json({ error: 'Internal server error' });
    });

    // Cleanup stale event entries every hour (events are in-memory only, no persistence needed)
    setInterval(() => {
        if (!client.events) return;
        // Events older than 7 days are safe to drop from memory
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        for (const [id, ev] of client.events) {
            const ts = parseInt(id); // Discord snowflakes encode timestamp
            if (!isNaN(ts) && (ts / 4194304 + 1420070400000) < cutoff) {
                client.events.delete(id);
            }
        }
    }, 60 * 60 * 1000);

    // Start Express API Server listening
    app.listen(PORT, () => {
        console.log(`[SUCCESS] Dashboard API Server: Running on http://localhost:${PORT}`);
    });
};
