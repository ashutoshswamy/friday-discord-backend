const axios = require('axios');
const db = require('./db');

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// Extract YouTube channel ID from various URL formats
async function resolveYoutubeChannelId(url) {
    // Direct channel ID: youtube.com/channel/UC...
    const directMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
    if (directMatch) return directMatch[1];

    // Normalise: ensure scheme + www
    let fetchUrl = url.trim();
    if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;
    fetchUrl = fetchUrl.replace('://youtube.com', '://www.youtube.com');

    try {
        const { data: html } = await axios.get(fetchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 10000
        });

        // Try multiple patterns — YouTube embeds channel ID in several places
        const patterns = [
            /"channelId":"(UC[\w-]+)"/,
            /"externalId":"(UC[\w-]+)"/,
            /"browseId":"(UC[\w-]+)"/,
            /\/channel\/(UC[\w-]+)/,
            /\\"channelId\\":\\"(UC[\w-]+)\\"/,
            /<link rel="canonical" href="[^"]*\/channel\/(UC[\w-]+)/,
            /itemprop="channelId"\s+content="(UC[\w-]+)"/,
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) return match[1];
        }

        console.warn(`[ALERTS] No channel ID pattern matched for ${url}`);
    } catch (err) {
        console.error(`[ALERTS] Failed to fetch page for ${url}:`, err.message);
    }
    return null;
}

// Parse latest video entry from YouTube RSS XML
function parseLatestYoutubeVideo(xml) {
    const videoIdMatch = xml.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/);
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const authorMatch = xml.match(/<name>([^<]+)<\/name>/);
    const thumbMatch = xml.match(/<media:thumbnail url="([^"]+)"/);

    if (!videoIdMatch) return null;
    return {
        videoId: videoIdMatch[1],
        title: titleMatch ? titleMatch[1] : 'New Video',
        author: authorMatch ? authorMatch[1] : 'YouTube Channel',
        thumbnail: thumbMatch ? thumbMatch[1] : null,
        url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`
    };
}

// ──────────────────────────────────────────────
// Twitch OAuth token (cached, auto-refreshed)
// ──────────────────────────────────────────────

let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchToken() {
    if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
        const { data } = await axios.post(
            `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
        );
        twitchToken = data.access_token;
        // Expire 10 minutes early to be safe
        twitchTokenExpiry = Date.now() + (data.expires_in - 600) * 1000;
        return twitchToken;
    } catch (err) {
        console.error('[ALERTS] Failed to get Twitch token:', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────
// YouTube Poller (every 5 min)
// ──────────────────────────────────────────────

// Cache resolved channel IDs to avoid repeated page fetches
const youtubeChannelIdCache = new Map();

async function pollYoutube(client) {
    const alerts = await db.getAllYoutubeAlerts();
    if (!alerts.length) return;

    for (const alert of alerts) {
        try {
            let channelId = youtubeChannelIdCache.get(alert.youtubeUrl);
            if (!channelId) {
                channelId = await resolveYoutubeChannelId(alert.youtubeUrl);
                if (!channelId) {
                    console.warn(`[ALERTS] Could not resolve channel ID for ${alert.youtubeUrl}`);
                    continue;
                }
                youtubeChannelIdCache.set(alert.youtubeUrl, channelId);
            }

            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const { data: xml } = await axios.get(rssUrl, { timeout: 8000 });
            const video = parseLatestYoutubeVideo(xml);
            if (!video) continue;

            // First run — just seed the last video ID, don't ping
            if (!alert.lastVideoId) {
                await db.updateYoutubeLastVideo(alert.guildId, alert.youtubeUrl, video.videoId);
                continue;
            }

            if (video.videoId === alert.lastVideoId) continue;

            // New video detected
            await db.updateYoutubeLastVideo(alert.guildId, alert.youtubeUrl, video.videoId);

            const discordChannel = await client.channels.fetch(alert.channelId).catch(() => null);
            if (!discordChannel) continue;

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setAuthor({ name: video.author, iconURL: 'https://www.youtube.com/favicon.ico' })
                .setTitle(`📹 ${video.title}`)
                .setURL(video.url)
                .setDescription(`**${video.author}** just uploaded a new video!`)
                .setTimestamp();

            if (video.thumbnail) embed.setImage(video.thumbnail);

            await discordChannel.send({ content: `🔴 **New YouTube Upload!**`, embeds: [embed] });
        } catch (err) {
            console.error(`[ALERTS] YouTube poll error for ${alert.youtubeUrl}:`, err.message);
        }
    }
}

// ──────────────────────────────────────────────
// Twitch Poller (every 2 min)
// ──────────────────────────────────────────────

async function pollTwitch(client) {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return;

    const token = await getTwitchToken();
    if (!token) return;

    const alerts = await db.getAllTwitchAlerts();
    if (!alerts.length) return;

    // Batch all usernames into one API call (max 100)
    const usernames = [...new Set(alerts.map(a => a.twitchUsername))];

    let liveStreams = [];
    try {
        const query = usernames.map(u => `user_login=${encodeURIComponent(u)}`).join('&');
        const { data } = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            },
            timeout: 8000
        });
        liveStreams = data.data; // array of live stream objects
    } catch (err) {
        console.error('[ALERTS] Twitch streams fetch error:', err.message);
        return;
    }

    const liveMap = new Map(liveStreams.map(s => [s.user_login.toLowerCase(), s]));

    for (const alert of alerts) {
        const stream = liveMap.get(alert.twitchUsername.toLowerCase());
        const nowLive = !!stream;

        if (nowLive === alert.isLive) continue; // state unchanged

        await db.updateTwitchIsLive(alert.guildId, alert.twitchUsername, nowLive);

        const discordChannel = await client.channels.fetch(alert.channelId).catch(() => null);
        if (!discordChannel) continue;

        const { EmbedBuilder } = require('discord.js');

        if (nowLive) {
            const thumbUrl = stream.thumbnail_url
                ?.replace('{width}', '1280')
                ?.replace('{height}', '720');

            const embed = new EmbedBuilder()
                .setColor('#9146FF')
                .setAuthor({ name: stream.user_name, iconURL: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c1.png' })
                .setTitle(`🎮 ${stream.title || `${stream.user_name} is live!`}`)
                .setURL(`https://www.twitch.tv/${stream.user_login}`)
                .addFields(
                    { name: 'Game', value: stream.game_name || 'Unknown', inline: true },
                    { name: 'Viewers', value: stream.viewer_count?.toLocaleString() || '0', inline: true }
                )
                .setTimestamp();

            if (thumbUrl) embed.setImage(thumbUrl);

            await discordChannel.send({
                content: `🟣 **${stream.user_name} is now live on Twitch!**\nhttps://www.twitch.tv/${stream.user_login}`,
                embeds: [embed]
            });
        }
        // No "went offline" message — most bots skip it to avoid spam
    }
}

// ──────────────────────────────────────────────
// Start both pollers
// ──────────────────────────────────────────────

const YOUTUBE_INTERVAL = 5 * 60 * 1000;  // 5 minutes
const TWITCH_INTERVAL  = 2 * 60 * 1000;  // 2 minutes

function startAlertPoller(client) {
    const hasTwitch = !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);

    console.log('[ALERTS] Starting YouTube poller (5 min interval)');
    pollYoutube(client);
    setInterval(() => pollYoutube(client), YOUTUBE_INTERVAL);

    if (hasTwitch) {
        console.log('[ALERTS] Starting Twitch poller (2 min interval)');
        pollTwitch(client);
        setInterval(() => pollTwitch(client), TWITCH_INTERVAL);
    } else {
        console.warn('[ALERTS] TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set — Twitch alerts disabled');
    }
}

module.exports = { startAlertPoller };
