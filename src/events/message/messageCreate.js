const {
    Events,
    EmbedBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { renderRankCard } = require('../../utils/renderRankCard');

// Local in-memory caches
const spamCache = new Map(); // Tracks timestamps for spam detection: userId -> array of timestamps
const spamCooldownTime = 3000; // 3 seconds window
const spamMaxMessages = 5;

// Evict stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
    const cutoff = Date.now() - spamCooldownTime;
    for (const [userId, timestamps] of spamCache) {
        if (!timestamps.some(t => t > cutoff)) spamCache.delete(userId);
    }
}, 5 * 60 * 1000);

module.exports = {
    name: Events.MessageCreate,
    once: false,

    /**
     * Executes when a message is created.
     * @param {import('discord.js').Message} message 
     * @param {import('discord.js').Client} client 
     */
    async execute(message, client) {
        // Ignore bots and DM chats
        if (message.author.bot || !message.guild || !message.member) return;

        const { guild, member, author, channel } = message;

        // ------------------------------------------
        // Custom Commands Trigger Scan (e.g., !trigger)
        // ------------------------------------------
        const triggerPrefix = '!';
        if (message.content.startsWith(triggerPrefix)) {
            const possibleTrigger = message.content.slice(triggerPrefix.length).trim().split(/ +/)[0].toLowerCase();
            const customCmd = await db.getCustomCommand(guild.id, possibleTrigger);
            if (customCmd) {
                if (customCmd.isEmbed && customCmd.embedData) {
                    const container = new ContainerBuilder()
                        .setAccentColor(parseInt((customCmd.embedData.color || '#00FFCC').replace('#', ''), 16) || 0x00FFCC);
                    
                    let text = '';
                    if (customCmd.embedData.title) text += `## ${customCmd.embedData.title}\n`;
                    if (customCmd.embedData.description) text += customCmd.embedData.description;
                    
                    if (text) {
                        container.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(text)
                        );
                    }
                    if (customCmd.embedData.thumbnail) {
                        container.setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(customCmd.embedData.thumbnail)
                        );
                    }
                    if (customCmd.embedData.image) {
                        container.addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL(customCmd.embedData.image)
                            )
                        );
                    }
                    
                    await channel.send({ 
                        flags: MessageFlags.IsComponentsV2,
                        components: [container] 
                    }).catch(() => null);
                } else if (customCmd.content) {
                    await channel.send(customCmd.content).catch(() => null);
                }
                return; // Prevent XP awards or AutoMod checks for custom triggers
            }
        }

        // Bypass AutoMod for Server Owner and Administrators
        const hasAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || guild.ownerId === author.id;

        let wasDeleted = false;

        if (!hasAdmin) {
            // ------------------------------------------
            // 1. Fetch Config & Exemptions
            // ------------------------------------------
            const [config, exemptions, filterOptOuts] = await Promise.all([
                db.getGuildConfig(guild.id),
                db.getExemptions(guild.id),
                db.getFilterOptOuts(guild.id),
            ]);

            // Check if current channel or user's roles are exempted (full bypass)
            const isChannelExempt = exemptions.some(ex => ex.type === 'CHANNEL' && ex.targetId === channel.id);
            const isRoleExempt = exemptions.some(ex => ex.type === 'ROLE' && member.roles.cache.has(ex.targetId));

            // Helper: is this channel opted out of a specific filter?
            const isOptedOut = (filter) => filterOptOuts.some(o => o.filter === filter && o.channelId === channel.id);

            if (!isChannelExempt && !isRoleExempt) {
                let infractionReason = null;

                // ------------------------------------------
                // A. Scan Custom Blocked Words
                // ------------------------------------------
                const blockedWords = await db.getBlockedWords(guild.id);
                for (const word of blockedWords) {
                    // Check if message content contains blocked word (case-insensitive)
                    // If it is regex, test it; otherwise do literal include
                    try {
                        const isRegex = word.startsWith('/') && word.endsWith('/');
                        if (isRegex) {
                            const regexStr = word.slice(1, -1);
                            const regex = new RegExp(regexStr, 'i');
                            // Guard against ReDoS: run regex with a 50ms timeout
                            const matched = await Promise.race([
                                Promise.resolve(regex.test(message.content)),
                                new Promise(resolve => setTimeout(() => resolve(false), 50))
                            ]);
                            if (matched) {
                                infractionReason = `Blocked word/phrase detected (regex pattern: \`${word}\`)`;
                                break;
                            }
                        } else {
                            if (message.content.toLowerCase().includes(word.toLowerCase())) {
                                infractionReason = `Blocked word/phrase detected (\`${word}\`)`;
                                break;
                            }
                        }
                    } catch (e) {
                        // Safe regex fallback
                        if (message.content.toLowerCase().includes(word.toLowerCase())) {
                            infractionReason = `Blocked word/phrase detected (\`${word}\`)`;
                            break;
                        }
                    }
                }

                // ------------------------------------------
                // B. Scan unauthorized Links
                // ------------------------------------------
                if (!infractionReason && config.automodLinks && !isOptedOut('links')) {
                    const linkRegex = /https?:\/\/[^\s]+/i;
                    if (linkRegex.test(message.content)) {
                        infractionReason = 'Sharing links is restricted in this channel';
                    }
                }

                // ------------------------------------------
                // B2. Scan Discord Invite Links
                // ------------------------------------------
                if (!infractionReason && config.automodInvites && !isOptedOut('invites')) {
                    const inviteRegex = /discord(?:\.gg|(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
                    if (inviteRegex.test(message.content)) {
                        infractionReason = 'Posting Discord invite links is not allowed';
                    }
                }

                // ------------------------------------------
                // C. Scan Excessive Capital Letters (Caps)
                // ------------------------------------------
                if (!infractionReason && config.automodCaps && !isOptedOut('caps')) {
                    const cleanText = message.content.replace(/[^a-zA-Z]/g, '');
                    const uppercaseCount = message.content.replace(/[^A-Z]/g, '').length;

                    // Trigger if text contains at least 10 letters and is over 70% uppercase
                    if (cleanText.length >= 10 && (uppercaseCount / cleanText.length) > 0.7) {
                        infractionReason = 'Excessive capital letters (caps lock spam)';
                    }
                }

                // ------------------------------------------
                // D. Scan Chat Message Spamming
                // ------------------------------------------
                if (!infractionReason && config.automodSpam && !isOptedOut('spam')) {
                    const now = Date.now();
                    if (!spamCache.has(author.id)) {
                        spamCache.set(author.id, []);
                    }

                    const timestamps = spamCache.get(author.id);
                    // Filter timestamps older than our 3 second window
                    const validTimestamps = timestamps.filter(time => now - time < spamCooldownTime);
                    validTimestamps.push(now);
                    spamCache.set(author.id, validTimestamps);

                    if (validTimestamps.length > spamMaxMessages) {
                        infractionReason = 'Chat message spamming (sending too fast)';
                    }
                }

                // ------------------------------------------
                // 2. Execute Infraction Action & Punishment
                // ------------------------------------------
                if (infractionReason) {
                    wasDeleted = true;

                    // Delete the message immediately to secure chat
                    await message.delete().catch(() => null);

                    // Issue a formal warning in db
                    const warning = await db.addWarning(guild.id, author.id, client.user.id, `[AUTOMOD] ${infractionReason}`);
                    await db.logInfraction(guild.id, author.id, client.user.id, 'AUTOMOD_WARN', infractionReason);

                    // Fetch active warning count
                    const warnings = await db.getWarnings(guild.id, author.id);
                    const warnCount = warnings.length;

                    // Send alert message in channel, automatically delete after 5 seconds to keep chat clean
                    const alertMsg = await channel.send(
                        `⚠️ **AutoMod Triggered:** ${author}, your message was deleted due to: *${infractionReason}*. ` +
                        `You have been warned. (Warning ID: \`${warning.id}\` | Warns: **${warnCount}**)`
                    ).catch(() => null);

                    if (alertMsg) {
                        setTimeout(() => alertMsg.delete().catch(() => null), 6000);
                    }

                    // Retrieve punishment rule thresholds
                    const rule = await db.getPunishmentRule(guild.id);
                    if (rule && warnCount >= rule.warnThreshold) {
                        try {
                            if (rule.punishmentType === 'TIMEOUT') {
                                const canTimeout = guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers);
                                if (member.moderatable && canTimeout) {
                                    await member.timeout(rule.durationMs, `[AUTOMOD] Exceeded warn threshold of ${rule.warnThreshold} warnings.`);
                                    await db.logInfraction(guild.id, author.id, client.user.id, 'TIMEOUT', `AutoMod Timeout (Exceeded warns)`);

                                    const durationMins = rule.durationMs / 60000;
                                    const embed = new EmbedBuilder()
                                        .setTitle('🤐 AutoMod Punishment Applied')
                                        .setColor('#FF4500')
                                        .setDescription(`${author} has been timed out for **${durationMins} minutes** after exceeding the warning threshold of **${rule.warnThreshold}** warns.`)
                                        .setTimestamp();
                                    
                                    await channel.send({ embeds: [embed] }).catch(() => null);
                                }
                            } else if (rule.punishmentType === 'KICK') {
                                const canKick = guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers);
                                if (member.kickable && canKick) {
                                    await member.kick(`[AUTOMOD] Exceeded warn threshold of ${rule.warnThreshold} warnings.`);
                                    await db.logInfraction(guild.id, author.id, client.user.id, 'KICK', `AutoMod Kick (Exceeded warns)`);

                                    const embed = new EmbedBuilder()
                                        .setTitle('👢 AutoMod Punishment Applied')
                                        .setColor('#FF4500')
                                        .setDescription(`**${author.tag}** has been kicked from the server after exceeding the warning threshold of **${rule.warnThreshold}** warns.`)
                                        .setTimestamp();

                                    await channel.send({ embeds: [embed] }).catch(() => null);
                                }
                            } else if (rule.punishmentType === 'BAN') {
                                const canBan = guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers);
                                if (member.bannable && canBan) {
                                    await guild.members.ban(author.id, { 
                                        deleteMessageSeconds: 86400, // delete past 1 day of messages
                                        reason: `[AUTOMOD] Exceeded warn threshold of ${rule.warnThreshold} warnings.` 
                                    });
                                    await db.logInfraction(guild.id, author.id, client.user.id, 'BAN', `AutoMod Ban (Exceeded warns)`);

                                    const embed = new EmbedBuilder()
                                        .setTitle('🔨 AutoMod Punishment Applied')
                                        .setColor('#FF0000')
                                        .setDescription(`❌ **${author.tag}** has been banned from the server after exceeding the warning threshold of **${rule.warnThreshold}** warns.`)
                                        .setTimestamp();

                                    await channel.send({ embeds: [embed] }).catch(() => null);
                                }
                            }
                        } catch (err) {
                            console.error('[ERROR] AutoMod punishment execution failed:', err);
                        }
                    }
                }
            }
        }

        // ------------------------------------------
        // 3. Leveling & XP Allocations
        // ------------------------------------------
        // Only run leveling calculations if the message wasn't deleted by AutoMod
        if (!wasDeleted) {
            try {
                const [config, userMultiplier] = await Promise.all([
                    db.getGuildConfig(guild.id),
                    db.getUserXpMultiplier(guild.id, author.id),
                ]);
                const guildMultiplier = config.xpMultiplier || 1.0;
                const multiplier = guildMultiplier * userMultiplier;

                // Base XP per message: 15 to 25 XP
                const baseXP = Math.floor(Math.random() * 11) + 15;
                const xpGain = Math.round(baseXP * multiplier);

                const result = await db.addXp(guild.id, author.id, xpGain);

                if (result.leveledUp) {
                    // Render rank card and send with level-up message
                    try {
                        const [updatedProfile, allProfiles, rankConfig] = await Promise.all([
                            db.getProfile(guild.id, author.id),
                            db.getGuildProfiles(guild.id),
                            db.getRankCardConfig(guild.id).catch(() => null),
                        ]);

                        allProfiles.sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);
                        const rankPos = allProfiles.findIndex(p => p.userId === author.id) + 1 || '?';

                        const cardBuffer = await renderRankCard(
                            author,
                            updatedProfile,
                            rankPos,
                            rankConfig?.theme || 'cyber',
                            rankConfig?.accentColor || null,
                            db
                        );

                        const attachment = new AttachmentBuilder(cardBuffer, { name: `levelup-${author.id}.png` });
                        const levelAlert = await channel.send({
                            content: `🎉 **Level Up!** ${author} just reached **Level ${result.newLevel}**! Keep it up!`,
                            files: [attachment],
                        }).catch(() => null);

                    } catch (cardErr) {
                        console.error('[ERROR] Level-up card render failed:', cardErr);
                        // Fallback to plain embed if card render fails
                        const embed = new EmbedBuilder()
                            .setTitle('🎉 Level Up!')
                            .setColor('#00FFCC')
                            .setThumbnail(author.displayAvatarURL({ forceStatic: true }))
                            .setDescription(`GG ${author}! You advanced to **Level ${result.newLevel}**!`)
                            .addFields(
                                { name: 'Previous Level', value: `${result.oldLevel}`, inline: true },
                                { name: 'New Level',      value: `${result.newLevel}`, inline: true }
                            )
                            .setTimestamp();
                        await channel.send({ embeds: [embed] }).catch(() => null);
                    }

                    // ------------------------------------------
                    // 4. Automated Level Role Rewards Assignment
                    // ------------------------------------------
                    const rewards = await db.getLevelRewards(guild.id);
                    // Filter rewards for the exact level reached
                    const matchingReward = rewards.find(r => r.level === result.newLevel);

                    if (matchingReward) {
                        const role = guild.roles.cache.get(matchingReward.roleId);
                        if (role) {
                            await member.roles.add(role, `Level Reward reached level ${result.newLevel}`).catch(err => {
                                console.error(`[ERROR] Failed to grant level role reward ${role.name}:`, err);
                            });

                            // Optionally, notify the user inside the channel
                            const rewardMsg = await channel.send(`🏆 ${author} was awarded the role **${role.name}** for reaching Level **${result.newLevel}**!`).catch(() => null);
                            if (rewardMsg) {
                                setTimeout(() => rewardMsg.delete().catch(() => null), 8000);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('[ERROR] Leveling XP processing failed:', err);
            }
        }
    }
};
