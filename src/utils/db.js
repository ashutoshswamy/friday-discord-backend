const { createClient } = require('@supabase/supabase-js');
const { EMOJIS } = require('./emojis');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
const memoryCrops = new Map(); // guildId_userId -> Array of crop objects
const memoryClans = new Map(); // guildId_clanId -> clan object
const memoryClanMembers = new Map(); // guildId_userId -> clanId
const memoryCrimeStats = new Map(); // guildId_userId -> { xp, level }
const memoryQuests = new Map(); // guildId_userId -> Array of quest objects
const memoryCommodities = new Map(); // guildId_itemName -> { price, eventText, lastUpdated }
const memoryMarketTicks = new Map(); // guildId -> Date
const memoryLotteryConfig = new Map(); // guildId -> { ticketCost, jackpot, lastDraw }
const memoryLotteryTickets = new Map(); // guildId_userId -> count
const memoryLotteryHistory = new Map(); // guildId -> Array of winner logs
const memoryFarmingStats = new Map(); // guildId_userId -> { xp, level, max_plots }

if (
    supabaseUrl && 
    supabaseKey && 
    supabaseUrl !== 'your_supabase_url_here' && 
    supabaseKey !== 'your_supabase_service_role_key_here' && 
    supabaseUrl.trim() !== '' && 
    supabaseKey.trim() !== ''
) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[SUCCESS] Database: Connected to Supabase.');
} else {
    console.warn(
        '\n[WARNING] Supabase is NOT configured yet!\n' +
        'Please supply your SUPABASE_URL and SUPABASE_KEY in the .env file to enable cloud logging, leveling, and economy.\n'
    );
}

const DEFAULT_SHOP_ITEMS = [
    {
        name: 'Hunting Rifle',
        cost: 1000,
        description: 'Essential firearms tool required to go hunting using /hunt.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Fishing Pole',
        cost: 500,
        description: 'Robust casting rod required to go fishing using /fish.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Shovel',
        cost: 350,
        description: 'Sturdy excavation shovel required to dig up treasures using /dig.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Pizza',
        cost: 250,
        description: 'Consumable food item. Eating a Pizza grants 150 XP instantly!',
        roleRewardId: null,
        actionType: 'XP',
        actionValue: 150
    },
    {
        name: 'Lootbox',
        cost: 800,
        description: 'Interactive spinner chest. Grants high multiplier jackpots or rare items!',
        roleRewardId: null,
        actionType: 'LOOTBOX',
        actionValue: null
    },
    {
        name: 'Energy Drink',
        cost: 180,
        description: `Recharging gamer energy drink. Restores stamina and awards ${EMOJIS.coin}300 coins!`,
        roleRewardId: null,
        actionType: 'COINS',
        actionValue: 300
    },
    {
        name: 'XP Potion',
        cost: 1500,
        description: 'Concentrated leveling brew. Drinking it grants 300 XP instantly!',
        roleRewardId: null,
        actionType: 'XP',
        actionValue: 300
    },
    {
        name: 'Work Gloves',
        cost: 800,
        description: `Sturdy labor gloves. Putting them on awards ${EMOJIS.coin}500 coins!`,
        roleRewardId: null,
        actionType: 'COINS',
        actionValue: 500
    },
    {
        name: 'Pickaxe',
        cost: 600,
        description: 'Heavy steel pickaxe required to excavate ores and minerals using /mine.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Axe',
        cost: 400,
        description: 'Lumberjack axe required to chop wood using /chop.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Hacker Laptop',
        cost: 1500,
        description: 'A black-market hacker deck required to execute server intrusions using /hack.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Wheat Seed',
        cost: 20,
        description: 'Seed to plant Wheat. Grows in 2 minutes.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Tomato Seed',
        cost: 40,
        description: 'Seed to plant Tomatoes. Grows in 5 minutes.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Carrot Seed',
        cost: 70,
        description: 'Seed to plant Carrots. Grows in 10 minutes.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    },
    {
        name: 'Golden Apple Seed',
        cost: 400,
        description: 'Seed to plant a mythical Golden Apple tree. Grows in 30 minutes.',
        roleRewardId: null,
        actionType: null,
        actionValue: null
    }
];

// XP Progression Curve Formula
function xpNeededForNextLevel(level) {
    return level * 150 + 100;
}

module.exports = {
    // ==========================================
    // 1. Advanced Moderation & Infractions
    // ==========================================

    async addWarning(guildId, userId, moderatorId, reason) {
        if (!supabase) return { id: 'MOCK_WARN', guildId, userId, moderatorId, reason, timestamp: Date.now() };

        const warning = {
            id: `warn_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            reason,
            timestamp: Date.now()
        };

        const { data, error } = await supabase
            .from('warnings')
            .insert([warning])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            guildId: data.guild_id,
            userId: data.user_id,
            moderatorId: data.moderator_id,
            reason: data.reason,
            timestamp: Number(data.timestamp)
        };
    },

    async getWarnings(guildId, userId) {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('warnings')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) return [];

        return data.map(w => ({
            id: w.id,
            guildId: w.guild_id,
            userId: w.user_id,
            moderatorId: w.moderator_id,
            reason: w.reason,
            timestamp: Number(w.timestamp)
        }));
    },

    async deleteWarning(guildId, userId, warningId) {
        if (!supabase) return false;

        const { error, count } = await supabase
            .from('warnings')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('id', warningId);

        if (error) return false;
        return count > 0;
    },

    async clearAllWarnings(guildId, userId) {
        if (!supabase) return 0;

        const { error, count } = await supabase
            .from('warnings')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) return 0;
        return count || 0;
    },

    async logInfraction(guildId, userId, moderatorId, type, reason) {
        if (!supabase) return null;

        const log = {
            id: `log_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            type,
            reason: reason || 'No reason provided',
            timestamp: Date.now()
        };

        const { data, error } = await supabase
            .from('logs')
            .insert([log])
            .select()
            .single();

        if (error) return null;

        return {
            id: data.id,
            guildId: data.guild_id,
            userId: data.user_id,
            moderatorId: data.moderator_id,
            type: data.type,
            reason: data.reason,
            timestamp: Number(data.timestamp)
        };
    },

    // ==========================================
    // 2. AutoModeration & Onboarding Configuration
    // ==========================================

    async getGuildConfig(guildId) {
        if (!supabase) return {
            guildId, automodSpam: false, automodLinks: false, automodCaps: false, automodInvites: false,
            xpMultiplier: 1.0, welcomeChannelId: null, welcomeMessage: null, autoRoleId: null
        };

        const { data, error } = await supabase
            .from('guild_configs')
            .select('*')
            .eq('guild_id', guildId)
            .maybeSingle();

        if (error) return null;

        if (!data) {
            const defaultConfig = {
                guild_id: guildId,
                automod_spam: false,
                automod_links: false,
                automod_caps: false,
                automod_invites: false,
                xp_multiplier: 1.0
            };
            
            // Try with welcome columns first
            const { data: inserted, error: insertErr } = await supabase
                .from('guild_configs')
                .insert([{
                    ...defaultConfig,
                    welcome_channel_id: null,
                    welcome_message: null,
                    auto_role_id: null
                }])
                .select()
                .single();
            
            if (insertErr) {
                console.warn('[DB WARNING] Insertion with welcome columns failed. Retrying with basic columns...', insertErr.message);
                const { data: retryInserted, error: retryErr } = await supabase
                    .from('guild_configs')
                    .insert([defaultConfig])
                    .select()
                    .single();
                
                if (retryErr) {
                    console.error('[DB ERROR] Basic config insertion failed:', retryErr.message);
                    return {
                        guildId,
                        automodSpam: false,
                        automodLinks: false,
                        automodCaps: false,
                        automodInvites: false,
                        xpMultiplier: 1.0,
                        welcomeChannelId: null,
                        welcomeMessage: null,
                        autoRoleId: null
                    };
                }

                return {
                    guildId: retryInserted.guild_id,
                    automodSpam: retryInserted.automod_spam,
                    automodLinks: retryInserted.automod_links,
                    automodCaps: retryInserted.automod_caps,
                    automodInvites: retryInserted.automod_invites ?? false,
                    xpMultiplier: retryInserted.xp_multiplier,
                    welcomeChannelId: null,
                    welcomeMessage: null,
                    autoRoleId: null
                };
            }

            return {
                guildId: inserted.guild_id,
                automodSpam: inserted.automod_spam,
                automodLinks: inserted.automod_links,
                automodCaps: inserted.automod_caps,
                automodInvites: inserted.automod_invites ?? false,
                xpMultiplier: inserted.xp_multiplier,
                welcomeChannelId: inserted.welcome_channel_id,
                welcomeMessage: inserted.welcome_message,
                autoRoleId: inserted.auto_role_id
            };
        }

        return {
            guildId: data.guild_id,
            automodSpam: data.automod_spam,
            automodLinks: data.automod_links,
            automodCaps: data.automod_caps,
            automodInvites: data.automod_invites ?? false,
            xpMultiplier: data.xp_multiplier,
            welcomeChannelId: data.welcome_channel_id || null,
            welcomeMessage: data.welcome_message || null,
            autoRoleId: data.auto_role_id || null,
            rankCardTheme: data.rank_card_theme || 'cyber',
            rankCardAccent: data.rank_card_accent || null,
            welcomeCardTheme: data.welcome_card_theme || 'cyber',
            welcomeCardAccent: data.welcome_card_accent || null,
            welcomeCardEnabled: data.welcome_card_enabled || false,
            leaderboardTheme: data.leaderboard_theme || 'cyber',
            leaderboardAccent: data.leaderboard_accent || null,
        };
    },

    async getRankCardConfig(guildId) {
        try {
            const config = await this.getGuildConfig(guildId);
            return { theme: config?.rankCardTheme || 'cyber', accentColor: config?.rankCardAccent || null };
        } catch {
            return { theme: 'cyber', accentColor: null };
        }
    },

    async getLeaderboardCardConfig(guildId) {
        try {
            const config = await this.getGuildConfig(guildId);
            return { theme: config?.leaderboardTheme || 'cyber', accentColor: config?.leaderboardAccent || null };
        } catch {
            return { theme: 'cyber', accentColor: null };
        }
    },

    async getWelcomeCardConfig(guildId) {
        try {
            const config = await this.getGuildConfig(guildId);
            return {
                theme: config?.welcomeCardTheme || 'cyber',
                accentColor: config?.welcomeCardAccent || null,
                enabled: config?.welcomeCardEnabled || false,
            };
        } catch {
            return { theme: 'cyber', accentColor: null, enabled: false };
        }
    },

    async updateGuildConfig(guildId, updates) {
        if (!supabase) return null;

        const mappedUpdates = {};
        if (updates.automodSpam !== undefined) mappedUpdates.automod_spam = updates.automodSpam;
        if (updates.automodLinks !== undefined) mappedUpdates.automod_links = updates.automodLinks;
        if (updates.automodCaps !== undefined) mappedUpdates.automod_caps = updates.automodCaps;
        if (updates.automodInvites !== undefined) mappedUpdates.automod_invites = updates.automodInvites;
        if (updates.xpMultiplier !== undefined) mappedUpdates.xp_multiplier = updates.xpMultiplier;

        const welcomeUpdates = {};
        if (updates.welcomeChannelId !== undefined) welcomeUpdates.welcome_channel_id = updates.welcomeChannelId;
        if (updates.welcomeMessage !== undefined) welcomeUpdates.welcome_message = updates.welcomeMessage;
        if (updates.autoRoleId !== undefined) welcomeUpdates.auto_role_id = updates.autoRoleId;
        if (updates.rankCardTheme !== undefined) welcomeUpdates.rank_card_theme = updates.rankCardTheme;
        if (updates.rankCardAccent !== undefined) welcomeUpdates.rank_card_accent = updates.rankCardAccent;
        if (updates.welcomeCardTheme !== undefined) welcomeUpdates.welcome_card_theme = updates.welcomeCardTheme;
        if (updates.welcomeCardAccent !== undefined) welcomeUpdates.welcome_card_accent = updates.welcomeCardAccent;
        if (updates.welcomeCardEnabled !== undefined) welcomeUpdates.welcome_card_enabled = updates.welcomeCardEnabled;
        if (updates.leaderboardTheme !== undefined) welcomeUpdates.leaderboard_theme = updates.leaderboardTheme;
        if (updates.leaderboardAccent !== undefined) welcomeUpdates.leaderboard_accent = updates.leaderboardAccent;

        try {
            const { data, error } = await supabase
                .from('guild_configs')
                .update({ ...mappedUpdates, ...welcomeUpdates })
                .eq('guild_id', guildId)
                .select()
                .single();

            if (error) {
                console.warn('[DB WARNING] Update with welcome columns failed. Retrying with basic columns...', error.message);
                const { data: retryData, error: retryErr } = await supabase
                    .from('guild_configs')
                    .update(mappedUpdates)
                    .eq('guild_id', guildId)
                    .select()
                    .single();
                
                if (retryErr) throw retryErr;

                return {
                    guildId: retryData.guild_id,
                    automodSpam: retryData.automod_spam,
                    automodLinks: retryData.automod_links,
                    automodCaps: retryData.automod_caps,
                    automodInvites: retryData.automod_invites ?? false,
                    xpMultiplier: retryData.xp_multiplier,
                    welcomeChannelId: null,
                    welcomeMessage: null,
                    autoRoleId: null
                };
            }

            return {
                guildId: data.guild_id,
                automodSpam: data.automod_spam,
                automodLinks: data.automod_links,
                automodCaps: data.automod_caps,
                automodInvites: data.automod_invites ?? false,
                xpMultiplier: data.xp_multiplier,
                welcomeChannelId: data.welcome_channel_id || null,
                welcomeMessage: data.welcome_message || null,
                autoRoleId: data.auto_role_id || null
            };
        } catch (err) {
            console.error('[DB ERROR] updateGuildConfig failed:', err.message);
            throw err;
        }
    },

    async getBlockedWords(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('blocked_words')
            .select('pattern')
            .eq('guild_id', guildId);
        
        if (error) return [];
        return data.map(item => item.pattern);
    },

    async addBlockedWord(guildId, pattern) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('blocked_words')
            .insert([{ guild_id: guildId, pattern }]);
        return !error;
    },

    async removeBlockedWord(guildId, pattern) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('blocked_words')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('pattern', pattern);
        return !error && count > 0;
    },

    async getExemptions(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('automod_exemptions')
            .select('type, target_id')
            .eq('guild_id', guildId);
        
        if (error) return [];
        return data.map(item => ({ type: item.type, targetId: item.target_id }));
    },

    async addExemption(guildId, type, targetId) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('automod_exemptions')
            .insert([{ guild_id: guildId, type, target_id: targetId }]);
        return !error;
    },

    async removeExemption(guildId, type, targetId) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('automod_exemptions')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('type', type)
            .eq('target_id', targetId);
        return !error && count > 0;
    },

    // NOTE: automod_rules table must have composite PK (guild_id, warn_threshold).
    // Run in Supabase SQL editor:
    //   ALTER TABLE automod_rules DROP CONSTRAINT automod_rules_pkey;
    //   ALTER TABLE automod_rules ADD PRIMARY KEY (guild_id, warn_threshold);

    async getPunishmentRules(guildId) {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('automod_rules')
            .select('*')
            .eq('guild_id', guildId)
            .order('warn_threshold', { ascending: true });

        if (error || !data) return [];

        return data.map(r => ({
            guildId: r.guild_id,
            warnThreshold: r.warn_threshold,
            punishmentType: r.punishment_type,
            durationMs: Number(r.duration_ms)
        }));
    },

    async addPunishmentRule(guildId, threshold, punishmentType, durationMs) {
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('automod_rules')
            .upsert({
                guild_id: guildId,
                warn_threshold: threshold,
                punishment_type: punishmentType,
                duration_ms: durationMs
            }, { onConflict: 'guild_id,warn_threshold' })
            .select()
            .single();

        if (error) throw error;

        return {
            guildId: data.guild_id,
            warnThreshold: data.warn_threshold,
            punishmentType: data.punishment_type,
            durationMs: Number(data.duration_ms)
        };
    },

    async removePunishmentRule(guildId, threshold) {
        if (!supabase) return false;

        const { error, count } = await supabase
            .from('automod_rules')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('warn_threshold', threshold);

        return !error && count > 0;
    },

    // Legacy alias — kept for backwards compatibility
    async getPunishmentRule(guildId) {
        const rules = await this.getPunishmentRules(guildId);
        return rules[0] || { guildId, warnThreshold: 3, punishmentType: 'TIMEOUT', durationMs: 3600000 };
    },

    async updatePunishmentRule(guildId, warnThreshold, punishmentType, durationMs) {
        return this.addPunishmentRule(guildId, warnThreshold, punishmentType, durationMs);
    },

    // NOTE: automod_filter_optouts table must exist in Supabase:
    //   CREATE TABLE automod_filter_optouts (
    //     guild_id TEXT NOT NULL,
    //     filter TEXT NOT NULL,
    //     channel_id TEXT NOT NULL,
    //     PRIMARY KEY (guild_id, filter, channel_id)
    //   );

    async getFilterOptOuts(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('automod_filter_optouts')
            .select('filter, channel_id')
            .eq('guild_id', guildId);
        if (error) return [];
        return data.map(r => ({ filter: r.filter, channelId: r.channel_id }));
    },

    async addFilterOptOut(guildId, filter, channelId) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('automod_filter_optouts')
            .upsert([{ guild_id: guildId, filter, channel_id: channelId }], { onConflict: 'guild_id,filter,channel_id' });
        return !error;
    },

    async removeFilterOptOut(guildId, filter, channelId) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('automod_filter_optouts')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('filter', filter)
            .eq('channel_id', channelId);
        return !error && count > 0;
    },

    // ==========================================
    // 3. Economy & Virtual Shop
    // ==========================================

    async getProfile(guildId, userId) {
        if (!supabase) return { guildId, userId, coins: 100, xp: 0, level: 1, dailyCooldown: 0, workCooldown: 0, weeklyCooldown: 0, monthlyCooldown: 0, lastXpGain: 0, currentJob: null, jobAppliedAt: 0 };

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) return null;

        if (!data) {
            const defaultProfile = {
                guild_id: guildId,
                user_id: userId,
                coins: 100,
                xp: 0,
                level: 1,
                daily_cooldown: 0,
                work_cooldown: 0,
                weekly_cooldown: 0,
                monthly_cooldown: 0,
                last_xp_gain: 0
            };
            const { data: inserted, error: insertErr } = await supabase
                .from('user_profiles')
                .insert([defaultProfile])
                .select()
                .single();
            
            if (insertErr) throw insertErr;

            return {
                guildId: inserted.guild_id,
                userId: inserted.user_id,
                coins: Number(inserted.coins),
                bank: Number(inserted.bank || 0),
                xp: Number(inserted.xp),
                level: inserted.level,
                dailyCooldown: Number(inserted.daily_cooldown),
                workCooldown: Number(inserted.work_cooldown),
                weeklyCooldown: Number(inserted.weekly_cooldown || 0),
                monthlyCooldown: Number(inserted.monthly_cooldown || 0),
                lastXpGain: Number(inserted.last_xp_gain),
                currentJob: inserted.current_job || null,
                jobAppliedAt: Number(inserted.job_applied_at || 0),
            };
        }

        return {
            guildId: data.guild_id,
            userId: data.user_id,
            coins: Number(data.coins),
            bank: Number(data.bank || 0),
            xp: Number(data.xp),
            level: data.level,
            dailyCooldown: Number(data.daily_cooldown),
            workCooldown: Number(data.work_cooldown),
            weeklyCooldown: Number(data.weekly_cooldown || 0),
            monthlyCooldown: Number(data.monthly_cooldown || 0),
            lastXpGain: Number(data.last_xp_gain),
            currentJob: data.current_job || null,
            jobAppliedAt: Number(data.job_applied_at || 0),
            xpMultiplier: data.xp_multiplier !== undefined && data.xp_multiplier !== null ? Number(data.xp_multiplier) : 1.0,
        };
    },

    async updateCoins(guildId, userId, amountChange) {
        if (!supabase) return 100;
        const profile = await this.getProfile(guildId, userId);
        const newBalance = Math.max(0, profile.coins + amountChange);

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ coins: newBalance })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return Number(data.coins);
    },

    async depositCoins(guildId, userId, amount) {
        if (!supabase) return { coins: 100, bank: amount };
        const profile = await this.getProfile(guildId, userId);
        if (profile.coins < amount) throw new Error('Insufficient wallet coins.');

        const newCoins = profile.coins - amount;
        const newBank = (profile.bank || 0) + amount;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ coins: newCoins, bank: newBank })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return {
            coins: Number(data.coins),
            bank: Number(data.bank)
        };
    },

    async withdrawCoins(guildId, userId, amount) {
        if (!supabase) return { coins: 100, bank: 0 };
        const profile = await this.getProfile(guildId, userId);
        if ((profile.bank || 0) < amount) throw new Error('Insufficient bank balance.');

        const newCoins = profile.coins + amount;
        const newBank = (profile.bank || 0) - amount;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ coins: newCoins, bank: newBank })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return {
            coins: Number(data.coins),
            bank: Number(data.bank)
        };
    },

    async updateBank(guildId, userId, amountChange) {
        if (!supabase) return 0;
        const profile = await this.getProfile(guildId, userId);
        const newBank = Math.max(0, (profile.bank || 0) + amountChange);

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ bank: newBank })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return Number(data.bank);
    },

    async claimDaily(guildId, userId) {
        const profile = await this.getProfile(guildId, userId);
        const now = Date.now();
        const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

        if (profile.dailyCooldown && (now - profile.dailyCooldown < cooldownMs)) {
            return {
                success: false,
                cooldownLeft: cooldownMs - (now - profile.dailyCooldown)
            };
        }

        const reward = 200;
        const newBalance = profile.coins + reward;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ 
                coins: newBalance,
                daily_cooldown: now
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            reward,
            newBalance: Number(data.coins)
        };
    },

    async claimWeekly(guildId, userId) {
        const profile = await this.getProfile(guildId, userId);
        const now = Date.now();
        const cooldownMs = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (profile.weeklyCooldown && (now - profile.weeklyCooldown < cooldownMs)) {
            return {
                success: false,
                cooldownLeft: cooldownMs - (now - profile.weeklyCooldown)
            };
        }

        const reward = Math.floor(Math.random() * 2501) + 1000;
        const newBalance = profile.coins + reward;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                coins: newBalance,
                weekly_cooldown: now
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            reward,
            newBalance: Number(data.coins)
        };
    },

    async claimMonthly(guildId, userId) {
        const profile = await this.getProfile(guildId, userId);
        const now = Date.now();
        const cooldownMs = 30 * 24 * 60 * 60 * 1000; // 30 days

        if (profile.monthlyCooldown && (now - profile.monthlyCooldown < cooldownMs)) {
            return {
                success: false,
                cooldownLeft: cooldownMs - (now - profile.monthlyCooldown)
            };
        }

        const reward = Math.floor(Math.random() * 10001) + 5000;
        const newBalance = profile.coins + reward;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                coins: newBalance,
                monthly_cooldown: now
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            reward,
            newBalance: Number(data.coins)
        };
    },

    async claimWork(guildId, userId) {
        const profile = await this.getProfile(guildId, userId);
        const now = Date.now();
        const cooldownMs = 60 * 60 * 1000; // 1 hour

        if (profile.workCooldown && (now - profile.workCooldown < cooldownMs)) {
            return {
                success: false,
                cooldownLeft: cooldownMs - (now - profile.workCooldown)
            };
        }

        const reward = Math.floor(Math.random() * 101) + 50;
        const newBalance = profile.coins + reward;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ 
                coins: newBalance,
                work_cooldown: now
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            reward,
            newBalance: Number(data.coins)
        };
    },

    async getUserJob(guildId, userId) {
        const profile = await this.getProfile(guildId, userId);
        return { jobKey: profile.currentJob || null, jobAppliedAt: profile.jobAppliedAt || 0 };
    },

    async applyJob(guildId, userId, jobKey) {
        if (!supabase) return { success: true };
        const now = Date.now();
        const switchCooldownMs = 60 * 60 * 1000; // 1 hour between job switches

        const profile = await this.getProfile(guildId, userId);
        if (profile.currentJob && profile.jobAppliedAt && (now - profile.jobAppliedAt < switchCooldownMs)) {
            return { success: false, cooldownLeft: switchCooldownMs - (now - profile.jobAppliedAt) };
        }

        const { error } = await supabase
            .from('user_profiles')
            .update({ current_job: jobKey, job_applied_at: now })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true };
    },

    async quitJob(guildId, userId) {
        if (!supabase) return;
        const { error } = await supabase
            .from('user_profiles')
            .update({ current_job: null, job_applied_at: 0 })
            .eq('guild_id', guildId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    async getGuildJobs(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id, current_job, job_applied_at, coins, level')
            .eq('guild_id', guildId)
            .not('current_job', 'is', null);
        if (error) throw error;
        return (data || []).map(r => ({
            userId: r.user_id,
            jobKey: r.current_job,
            jobAppliedAt: r.job_applied_at,
            coins: Number(r.coins),
            level: r.level,
        }));
    },

    async adminSetJob(guildId, userId, jobKey) {
        if (!supabase) return;
        const now = Date.now();
        const { error } = await supabase
            .from('user_profiles')
            .update({ current_job: jobKey || null, job_applied_at: jobKey ? now : 0 })
            .eq('guild_id', guildId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    async transferCoins(guildId, payorId, payeeId, amount) {
        if (!supabase) return { success: true };

        const payorProfile = await this.getProfile(guildId, payorId);
        if (payorProfile.coins < amount) {
            return { success: false, reason: 'Insufficient balance' };
        }

        const payeeProfile = await this.getProfile(guildId, payeeId);

        const { error: deductErr } = await supabase
            .from('user_profiles')
            .update({ coins: payorProfile.coins - amount })
            .eq('guild_id', guildId)
            .eq('user_id', payorId);

        if (deductErr) throw deductErr;

        const { error: creditErr } = await supabase
            .from('user_profiles')
            .update({ coins: payeeProfile.coins + amount })
            .eq('guild_id', guildId)
            .eq('user_id', payeeId);

        if (creditErr) {
            // Rollback payor deduction
            await supabase
                .from('user_profiles')
                .update({ coins: payorProfile.coins })
                .eq('guild_id', guildId)
                .eq('user_id', payorId)
                .catch(e => console.error('[DB] transferCoins rollback failed:', e));
            throw creditErr;
        }

        return { success: true };
    },

    async getShopItems(guildId) {
        if (!supabase) return DEFAULT_SHOP_ITEMS;
        const { data, error } = await supabase
            .from('shop_items')
            .select('*')
            .eq('guild_id', guildId);
        
        const dbItems = error ? [] : data.map(item => ({
            name: item.name,
            description: item.description || 'No description provided',
            cost: Number(item.cost),
            roleRewardId: item.role_reward_id,
            actionType: item.action_type || null,
            actionValue: item.action_value !== undefined && item.action_value !== null ? Number(item.action_value) : null
        }));

        // Merge default items with any custom overrides from the database
        const mergedDefaults = DEFAULT_SHOP_ITEMS.map(defItem => {
            const override = dbItems.find(item => item.name.toLowerCase() === defItem.name.toLowerCase());
            if (override) {
                return {
                    ...defItem,
                    cost: override.cost,
                    description: override.description,
                    roleRewardId: override.roleRewardId,
                    actionType: override.actionType || defItem.actionType,
                    actionValue: override.actionValue !== null ? override.actionValue : defItem.actionValue
                };
            }
            return defItem;
        });

        // Filter out dbItems that correspond to default items (since they are already merged)
        const defaultNames = new Set(DEFAULT_SHOP_ITEMS.map(item => item.name.toLowerCase()));
        const customItems = dbItems.filter(item => !defaultNames.has(item.name.toLowerCase()));

        return [...mergedDefaults, ...customItems];
    },

    async addShopItem(guildId, name, cost, description, roleRewardId, actionType = null, actionValue = null) {
        if (!supabase) return { success: false, reason: 'Database offline' };
        
        const payload = {
            guild_id: guildId,
            name,
            cost,
            description,
            role_reward_id: roleRewardId || null
        };
        
        if (actionType !== null) payload.action_type = actionType;
        if (actionValue !== null) payload.action_value = actionValue;

        const { error } = await supabase
            .from('shop_items')
            .upsert(payload, { onConflict: 'guild_id,name' });

        if (error) {
            console.error('[DB ERROR] addShopItem failed:', error);
            // Check for undefined_column error code in Postgres
            if (error.code === '42703') {
                return { success: false, reason: 'migration_needed' };
            }
            return { success: false, reason: 'database_error' };
        }
        return { success: true };
    },

    async removeShopItem(guildId, name) {
        const lowerName = name.toLowerCase();
        const isDefault = DEFAULT_SHOP_ITEMS.some(item => item.name.toLowerCase() === lowerName);
        if (isDefault) {
            return { success: false, reason: 'Default items required by Friday grinding commands cannot be removed from the shop.' };
        }
        if (!supabase) return { success: false, reason: 'Database offline' };
        const { error, count } = await supabase
            .from('shop_items')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('name', name);
        if (error) return { success: false, reason: 'Database error' };
        if (count === 0) return { success: false, reason: 'Item not found in shop' };
        return { success: true };
    },

    async purchaseItem(guildId, userId, itemName) {
        if (!supabase) return { success: true };

        const lowerName = itemName.toLowerCase();
        
        // Retrieve merged catalog with overrides
        const shopItems = await this.getShopItems(guildId);
        const item = shopItems.find(i => i.name.toLowerCase() === lowerName);

        if (!item) return { success: false, reason: 'Item not found in shop' };

        const profile = await this.getProfile(guildId, userId);
        const itemCost = Number(item.cost);

        if (profile.coins < itemCost) {
            return { success: false, reason: 'You do not have enough coins to purchase this item' };
        }

        await supabase
            .from('user_profiles')
            .update({ coins: profile.coins - itemCost })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        await supabase
            .from('user_inventory')
            .insert([{
                guild_id: guildId,
                user_id: userId,
                item_name: item.name
            }]);

        return { 
            success: true, 
            cost: itemCost,
            roleRewardId: item.roleRewardId 
        };
    },

    async getInventory(guildId, userId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_inventory')
            .select('item_name')
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) return [];
        return data.map(item => item.item_name);
    },

    async addItemToInventory(guildId, userId, itemName) {
        if (!supabase) return true;
        const { error } = await supabase
            .from('user_inventory')
            .insert([{
                guild_id: guildId,
                user_id: userId,
                item_name: itemName
            }]);
        return !error;
    },

    async removeItemFromInventory(guildId, userId, itemName) {
        if (!supabase) return true;
        
        // Find one matching row ID
        const { data, error } = await supabase
            .from('user_inventory')
            .select('id')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('item_name', itemName)
            .limit(1)
            .maybeSingle();

        if (error || !data) return false;

        const { error: delError } = await supabase
            .from('user_inventory')
            .delete()
            .eq('id', data.id);

        return !delError;
    },

    async giftItem(guildId, senderId, receiverId, itemName) {
        if (!supabase) return true;

        // Find one matching row ID in sender's inventory
        const { data, error } = await supabase
            .from('user_inventory')
            .select('id')
            .eq('guild_id', guildId)
            .eq('user_id', senderId)
            .eq('item_name', itemName)
            .limit(1)
            .maybeSingle();

        if (error || !data) return false;

        // Transfer ownership
        const { error: updateError } = await supabase
            .from('user_inventory')
            .update({ user_id: receiverId })
            .eq('id', data.id);

        return !updateError;
    },

    async getMarketListings(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('market_listings')
            .select('*')
            .eq('guild_id', guildId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return data.map(item => ({
            id: item.id,
            guildId: item.guild_id,
            sellerId: item.seller_id,
            itemName: item.item_name,
            price: Number(item.price),
            createdAt: item.created_at
        }));
    },

    async listMarketItem(guildId, sellerId, itemName, price) {
        if (!supabase) return true;

        // First remove the item from their inventory
        const removed = await this.removeItemFromInventory(guildId, sellerId, itemName);
        if (!removed) return false;

        // Insert into market_listings
        const { error } = await supabase
            .from('market_listings')
            .insert([{
                guild_id: guildId,
                seller_id: sellerId,
                item_name: itemName,
                price: price
            }]);

        if (error) {
            // Rollback if market insertion failed
            await this.addItemToInventory(guildId, sellerId, itemName);
            return false;
        }

        return true;
    },

    async cancelMarketListing(guildId, sellerId, listingId) {
        if (!supabase) return true;

        // Fetch listing details to verify seller and retrieve item name
        const { data: listing, error: getErr } = await supabase
            .from('market_listings')
            .select('*')
            .eq('id', listingId)
            .eq('seller_id', sellerId)
            .maybeSingle();

        if (getErr || !listing) return false;

        // Remove from market_listings
        const { error: delErr } = await supabase
            .from('market_listings')
            .delete()
            .eq('id', listingId);

        if (delErr) return false;

        // Give the item back to the seller
        await this.addItemToInventory(guildId, sellerId, listing.item_name);
        return true;
    },

    async buyMarketItem(guildId, buyerId, listingId) {
        if (!supabase) return { success: true };

        // Fetch listing
        const { data: listing, error: getErr } = await supabase
            .from('market_listings')
            .select('*')
            .eq('id', listingId)
            .maybeSingle();

        if (getErr || !listing) return { success: false, reason: 'Listing not found.' };
        if (listing.seller_id === buyerId) return { success: false, reason: 'You cannot purchase your own item from the market!' };

        // Check buyer balance before attempting
        const buyerProfile = await this.getProfile(guildId, buyerId);
        if (buyerProfile.coins < listing.price) {
            return { success: false, reason: `Insufficient funds! Requires ${EMOJIS.coin} ${listing.price.toLocaleString()} coins.` };
        }

        // Delete listing FIRST — this is the atomic guard against double-purchase.
        // Only one concurrent request will get count > 0; the other gets 0 and returns early.
        const { error: delErr, count } = await supabase
            .from('market_listings')
            .delete({ count: 'exact' })
            .eq('id', listingId)
            .eq('guild_id', guildId);

        if (delErr || count === 0) {
            return { success: false, reason: 'This item was just purchased by someone else.' };
        }

        // Transfer coins; on failure restore the listing so the seller isn't shortchanged
        try {
            await this.updateCoins(guildId, buyerId, -listing.price);
            await this.updateCoins(guildId, listing.seller_id, listing.price);
        } catch (err) {
            // Restore listing and refund buyer
            await supabase.from('market_listings').insert([{
                id: listingId,
                guild_id: guildId,
                seller_id: listing.seller_id,
                item_name: listing.item_name,
                price: listing.price
            }]).catch(() => null);
            throw err;
        }

        // Add item to buyer's inventory
        await this.addItemToInventory(guildId, buyerId, listing.item_name);

        return { success: true, itemName: listing.item_name, price: Number(listing.price), sellerId: listing.seller_id };
    },

    // ==========================================
    // 4. Leveling & Rewards
    // ==========================================

    async addXp(guildId, userId, xpAmount) {
        if (!supabase) return { leveledUp: false, newLevel: 1 };

        const profile = await this.getProfile(guildId, userId);
        const now = Date.now();
        const xpCooldown = 60 * 1000;

        if (profile.lastXpGain && (now - profile.lastXpGain < xpCooldown)) {
            return { leveledUp: false, newLevel: profile.level };
        }

        const newXp = profile.xp + xpAmount;
        let currentLevel = profile.level;
        let leveledUp = false;

        while (newXp >= xpNeededForNextLevel(currentLevel)) {
            currentLevel++;
            leveledUp = true;
        }

        const { error } = await supabase
            .from('user_profiles')
            .update({
                xp: newXp,
                level: currentLevel,
                last_xp_gain: now
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) throw error;

        return {
            leveledUp,
            oldLevel: profile.level,
            newLevel: currentLevel,
            totalXp: newXp
        };
    },

    async updateXpAdmin(guildId, userId, action, xpAmount) {
        if (!supabase) return { level: 1, xp: 0 };
        const profile = await this.getProfile(guildId, userId);
        
        let newXp = profile.xp;

        if (action === 'ADD') newXp += xpAmount;
        if (action === 'REMOVE') newXp = Math.max(0, newXp - xpAmount);
        if (action === 'SET') newXp = xpAmount;

        let currentLevel = 1;
        while (newXp >= xpNeededForNextLevel(currentLevel)) {
            currentLevel++;
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                xp: newXp,
                level: currentLevel
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        return {
            level: data.level,
            xp: Number(data.xp)
        };
    },

    async setUserXpMultiplier(guildId, userId, multiplier) {
        if (!supabase) return { success: true };
        // Ensure the profile row exists
        await this.getProfile(guildId, userId);

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ xp_multiplier: multiplier })
                .eq('guild_id', guildId)
                .eq('user_id', userId);

            if (error) {
                // Column may not exist yet — log and treat as no-op
                console.warn('[DB WARNING] setUserXpMultiplier: xp_multiplier column missing or update failed.', error.message);
                return { success: false, reason: 'column_missing' };
            }
            return { success: true };
        } catch (err) {
            console.error('[DB ERROR] setUserXpMultiplier:', err.message);
            return { success: false, reason: err.message };
        }
    },

    async getUserXpMultiplier(guildId, userId) {
        if (!supabase) return 1.0;
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('xp_multiplier')
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .maybeSingle();
            if (error || !data) return 1.0;
            return data.xp_multiplier !== undefined && data.xp_multiplier !== null ? Number(data.xp_multiplier) : 1.0;
        } catch {
            return 1.0;
        }
    },

    async getLeaderboard(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id, level, xp')
            .eq('guild_id', guildId)
            .order('level', { ascending: false })
            .order('xp', { ascending: false })
            .limit(10);
        
        if (error) return [];
        return data.map((item, index) => ({
            rank: index + 1,
            userId: item.user_id,
            level: item.level,
            xp: Number(item.xp)
        }));
    },

    async getLevelRewards(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('level_rewards')
            .select('*')
            .eq('guild_id', guildId)
            .order('level', { ascending: true });

        if (error) return [];
        return data.map(item => ({
            level: item.level,
            roleId: item.role_id
        }));
    },

    async addLevelReward(guildId, level, roleId) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('level_rewards')
            .upsert({
                guild_id: guildId,
                level,
                role_id: roleId
            });
        return !error;
    },

    async removeLevelReward(guildId, level) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('level_rewards')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('level', level);
        return !error && count > 0;
    },

    // ==========================================
    // 5. Custom Commands
    // ==========================================

    async getCustomCommands(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('custom_commands')
            .select('*')
            .eq('guild_id', guildId);

        if (error) return [];
        return data.map(c => ({
            name: c.name,
            content: c.content,
            isEmbed: c.is_embed,
            embedData: c.embed_data
        }));
    },

    async getCustomCommand(guildId, name) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('custom_commands')
            .select('*')
            .eq('guild_id', guildId)
            .eq('name', name.toLowerCase().trim())
            .maybeSingle();

        if (error || !data) return null;
        return {
            name: data.name,
            content: data.content,
            isEmbed: data.is_embed,
            embedData: data.embed_data
        };
    },

    async addCustomCommand(guildId, name, content, isEmbed = false, embedData = null) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('custom_commands')
            .upsert({
                guild_id: guildId,
                name: name.toLowerCase().trim(),
                content,
                is_embed: isEmbed,
                embed_data: embedData
            });
        return !error;
    },

    async removeCustomCommand(guildId, name) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('custom_commands')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('name', name.toLowerCase().trim());
        return !error && count > 0;
    },

    // ==========================================
    // 6. Social Media Alerts Configuration
    // ==========================================

    async getYoutubeAlerts(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('youtube_alerts')
            .select('*')
            .eq('guild_id', guildId);
        
        if (error) return [];
        return data.map(item => ({
            channelId: item.channel_id,
            youtubeUrl: item.youtube_url
        }));
    },

    async addYoutubeAlert(guildId, channelId, youtubeUrl) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('youtube_alerts')
            .upsert({
                guild_id: guildId,
                channel_id: channelId,
                youtube_url: youtubeUrl.trim()
            });
        return !error;
    },

    async removeYoutubeAlert(guildId, youtubeUrl) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('youtube_alerts')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('youtube_url', youtubeUrl.trim());
        return !error && count > 0;
    },

    async getTwitchAlerts(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('twitch_alerts')
            .select('*')
            .eq('guild_id', guildId);
        
        if (error) return [];
        return data.map(item => ({
            channelId: item.channel_id,
            twitchUsername: item.twitch_username
        }));
    },

    async addTwitchAlert(guildId, channelId, twitchUsername) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('twitch_alerts')
            .upsert({
                guild_id: guildId,
                channel_id: channelId,
                twitch_username: twitchUsername.toLowerCase().trim()
            });
        return !error;
    },

    async removeTwitchAlert(guildId, twitchUsername) {
        if (!supabase) return false;
        const { error, count } = await supabase
            .from('twitch_alerts')
            .delete({ count: 'exact' })
            .eq('guild_id', guildId)
            .eq('twitch_username', twitchUsername.toLowerCase().trim());
        return !error && count > 0;
    },

    // Returns all youtube_alerts across all guilds (for poller)
    async getAllYoutubeAlerts() {
        if (!supabase) return [];
        const { data, error } = await supabase.from('youtube_alerts').select('*');
        if (error) return [];
        return data.map(item => ({
            guildId: item.guild_id,
            channelId: item.channel_id,
            youtubeUrl: item.youtube_url,
            lastVideoId: item.last_video_id || null
        }));
    },

    async updateYoutubeLastVideo(guildId, youtubeUrl, lastVideoId) {
        if (!supabase) return;
        await supabase
            .from('youtube_alerts')
            .update({ last_video_id: lastVideoId })
            .eq('guild_id', guildId)
            .eq('youtube_url', youtubeUrl.trim());
    },

    // Returns all twitch_alerts across all guilds (for poller)
    async getAllTwitchAlerts() {
        if (!supabase) return [];
        const { data, error } = await supabase.from('twitch_alerts').select('*');
        if (error) return [];
        return data.map(item => ({
            guildId: item.guild_id,
            channelId: item.channel_id,
            twitchUsername: item.twitch_username,
            isLive: item.is_live || false
        }));
    },

    async updateTwitchIsLive(guildId, twitchUsername, isLive) {
        if (!supabase) return;
        await supabase
            .from('twitch_alerts')
            .update({ is_live: isLive })
            .eq('guild_id', guildId)
            .eq('twitch_username', twitchUsername.toLowerCase().trim());
    },

    // ==========================================
    // 7. Giveaway History
    // ==========================================

    async saveGiveaway(guildId, channelId, messageId, prize, winnersCount, endsAt) {
        if (!supabase) return;
        await supabase.from('giveaways').upsert({
            id: messageId,
            guild_id: guildId,
            channel_id: channelId,
            prize,
            winners_count: winnersCount,
            ends_at: endsAt ? new Date(endsAt).toISOString() : null,
            status: 'active'
        });
    },

    async getActiveGiveaways() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('giveaways')
            .select('id, guild_id, channel_id, prize, winners_count, ends_at')
            .eq('status', 'active')
            .not('ends_at', 'is', null);
        if (error) return [];
        return data.map(g => ({
            messageId: g.id,
            guildId: g.guild_id,
            channelId: g.channel_id,
            prize: g.prize,
            winnersCount: g.winners_count,
            endsAt: new Date(g.ends_at).getTime()
        }));
    },

    async endGiveaway(messageId, winnerIds, entrantsCount) {
        if (!supabase) return;
        await supabase.from('giveaways').update({
            status: winnerIds.length > 0 ? 'ended' : 'cancelled',
            winner_ids: winnerIds,
            entrants_count: entrantsCount,
            ended_at: new Date().toISOString()
        }).eq('id', messageId);
    },

    async getGiveawayHistory(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('giveaways')
            .select('*')
            .eq('guild_id', guildId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) return [];
        return data.map(g => ({
            id: g.id,
            guildId: g.guild_id,
            channelId: g.channel_id,
            prize: g.prize,
            winnersCount: g.winners_count,
            entrantsCount: g.entrants_count,
            winnerIds: g.winner_ids || [],
            status: g.status,
            createdAt: g.created_at,
            endedAt: g.ended_at
        }));
    },

    // ==========================================
    // 8. Event History
    // ==========================================

    async saveEvent(guildId, channelId, messageId, title, description, date, location) {
        if (!supabase) return;
        await supabase.from('guild_events').upsert({
            id: messageId,
            guild_id: guildId,
            channel_id: channelId,
            title,
            description,
            date,
            location,
            rsvp_count: 0
        });
    },

    async updateEventRsvpCount(messageId, rsvpCount) {
        if (!supabase) return;
        await supabase.from('guild_events').update({ rsvp_count: rsvpCount }).eq('id', messageId);
    },

    async getEventHistory(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('guild_events')
            .select('*')
            .eq('guild_id', guildId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) return [];
        return data.map(e => ({
            id: e.id,
            guildId: e.guild_id,
            channelId: e.channel_id,
            title: e.title,
            description: e.description,
            date: e.date,
            location: e.location,
            rsvpCount: e.rsvp_count,
            createdAt: e.created_at
        }));
    },

    // ==========================================
    // 9. Polls
    // ==========================================

    async savePoll(guildId, channelId, messageId, question, options, emojis = []) {
        if (!supabase) return;
        await supabase.from('polls').upsert({
            id: messageId,
            guild_id: guildId,
            channel_id: channelId,
            question,
            options,
            emojis,
            status: 'active'
        });
    },

    async closePoll(messageId, results = null) {
        if (!supabase) return;
        const payload = {
            status: 'closed',
            closed_at: new Date().toISOString()
        };
        if (results !== null) payload.results = results;
        await supabase.from('polls').update(payload).eq('id', messageId);
    },

    async getPolls(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('polls')
            .select('*')
            .eq('guild_id', guildId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) return [];
        return data.map(p => ({
            id: p.id,
            guildId: p.guild_id,
            channelId: p.channel_id,
            question: p.question,
            options: p.options || [],
            emojis: p.emojis || [],
            status: p.status,
            createdAt: p.created_at,
            closedAt: p.closed_at,
            results: p.results || null
        }));
    },

    async getGuildProfiles(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('guild_id', guildId);
        if (error) return [];
        return data.map(p => ({
            guildId: p.guild_id,
            userId: p.user_id,
            coins: Number(p.coins),
            bank: Number(p.bank || 0),
            xp: Number(p.xp),
            level: p.level,
            dailyCooldown: Number(p.daily_cooldown),
            workCooldown: Number(p.work_cooldown)
        }));
    },

    async getGuildLogs(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .eq('guild_id', guildId)
            .order('timestamp', { ascending: false })
            .limit(100);
        if (error) return [];
        return data.map(l => ({
            id: l.id,
            guildId: l.guild_id,
            userId: l.user_id,
            moderatorId: l.moderator_id,
            type: l.type,
            reason: l.reason,
            timestamp: Number(l.timestamp)
        }));
    },

    async getGuildWarnings(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('warnings')
            .select('*')
            .eq('guild_id', guildId)
            .order('timestamp', { ascending: false });
        if (error) return [];
        return data.map(w => ({
            id: w.id,
            guildId: w.guild_id,
            userId: w.user_id,
            moderatorId: w.moderator_id,
            reason: w.reason,
            timestamp: Number(w.timestamp)
        }));
    },

    async getEconomyLeaderboard(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id, coins')
            .eq('guild_id', guildId)
            .order('coins', { ascending: false })
            .limit(10);
        if (error) return [];
        return data.map((item, index) => ({
            rank: index + 1,
            userId: item.user_id,
            coins: Number(item.coins)
        }));
    },

    async getModeratorStats(guildId, moderatorId) {
        if (!supabase) return { WARN: 0, TIMEOUT: 0, KICK: 0, BAN: 0 };
        const { data, error } = await supabase
            .from('logs')
            .select('type')
            .eq('guild_id', guildId)
            .eq('moderator_id', moderatorId);
        
        if (error) return { WARN: 0, TIMEOUT: 0, KICK: 0, BAN: 0 };
        
        const stats = { WARN: 0, TIMEOUT: 0, KICK: 0, BAN: 0 };
        data.forEach(l => {
            if (l.type.includes('WARN')) stats.WARN++;
            if (l.type === 'TIMEOUT') stats.TIMEOUT++;
            if (l.type === 'KICK') stats.KICK++;
            if (l.type === 'BAN') stats.BAN++;
        });
        return stats;
    },

    async getPet(guildId, userId) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('user_pets')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) return null;
        return {
            guildId: data.guild_id,
            userId: data.user_id,
            name: data.pet_name,
            type: data.pet_type,
            level: Number(data.level),
            xp: Number(data.xp),
            hunger: Number(data.hunger),
            affection: Number(data.affection),
            energy: Number(data.energy),
            attack: Number(data.attack),
            defense: Number(data.defense),
            lastFed: data.last_fed,
            lastTrained: data.last_trained
        };
    },

    async adoptPet(guildId, userId, petName, petType) {
        if (!supabase) return true;
        const { error } = await supabase
            .from('user_pets')
            .insert([{
                guild_id: guildId,
                user_id: userId,
                pet_name: petName,
                pet_type: petType,
                level: 1,
                xp: 0,
                hunger: 50,
                affection: 50,
                energy: 100,
                attack: 5,
                defense: 5
            }]);
        return !error;
    },

    async updatePetStats(guildId, userId, updates) {
        if (!supabase) return true;
        
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.pet_name = updates.name;
        if (updates.level !== undefined) dbUpdates.level = updates.level;
        if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
        if (updates.hunger !== undefined) dbUpdates.hunger = Math.max(0, Math.min(100, updates.hunger));
        if (updates.affection !== undefined) dbUpdates.affection = Math.max(0, Math.min(100, updates.affection));
        if (updates.energy !== undefined) dbUpdates.energy = Math.max(0, Math.min(100, updates.energy));
        if (updates.attack !== undefined) dbUpdates.attack = updates.attack;
        if (updates.defense !== undefined) dbUpdates.defense = updates.defense;
        if (updates.lastFed !== undefined) dbUpdates.last_fed = updates.lastFed;
        if (updates.lastTrained !== undefined) dbUpdates.last_trained = updates.lastTrained;

        const { error } = await supabase
            .from('user_pets')
            .update(dbUpdates)
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        return !error;
    },

    async releasePet(guildId, userId) {
        if (!supabase) return true;
        const { error } = await supabase
            .from('user_pets')
            .delete()
            .eq('guild_id', guildId)
            .eq('user_id', userId);
        return !error;
    },

    // ==========================================
    // Social — Bio, Rep, Marriage
    // ==========================================

    async getUserSocial(guildId, userId) {
        if (!supabase) return { bio: null, repCount: 0, lastRepGivenAt: 0, partnerId: null, marriedAt: null };
        const { data, error } = await supabase
            .from('user_social')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error || !data) return { bio: null, repCount: 0, lastRepGivenAt: 0, partnerId: null, marriedAt: null };
        return {
            bio: data.bio || null,
            repCount: Number(data.rep_count || 0),
            lastRepGivenAt: Number(data.last_rep_given_at || 0),
            partnerId: data.partner_id || null,
            marriedAt: data.married_at || null
        };
    },

    async setBio(guildId, userId, bio) {
        if (!supabase) return true;
        const { error } = await supabase.from('user_social')
            .upsert({ guild_id: guildId, user_id: userId, bio }, { onConflict: 'guild_id,user_id' });
        return !error;
    },

    async giveRep(guildId, giverId, receiverId) {
        if (!supabase) return { success: true, newRepCount: 1 };
        const now = Date.now();
        const cooldownMs = 24 * 60 * 60 * 1000;

        const giver = await this.getUserSocial(guildId, giverId);
        if (giver.lastRepGivenAt && (now - giver.lastRepGivenAt < cooldownMs)) {
            return { success: false, cooldownLeft: cooldownMs - (now - giver.lastRepGivenAt) };
        }

        await supabase.from('user_social').upsert(
            { guild_id: guildId, user_id: giverId, last_rep_given_at: now },
            { onConflict: 'guild_id,user_id' }
        );

        const receiver = await this.getUserSocial(guildId, receiverId);
        const newRepCount = receiver.repCount + 1;
        await supabase.from('user_social').upsert(
            { guild_id: guildId, user_id: receiverId, rep_count: newRepCount },
            { onConflict: 'guild_id,user_id' }
        );

        return { success: true, newRepCount };
    },

    async getMarriage(guildId, userId) {
        if (!supabase) return null;
        const social = await this.getUserSocial(guildId, userId);
        if (!social.partnerId) return null;
        return { partnerId: social.partnerId, marriedAt: social.marriedAt };
    },

    async setMarriage(guildId, userId1, userId2) {
        if (!supabase) return true;
        const now = new Date().toISOString();
        await supabase.from('user_social').upsert(
            { guild_id: guildId, user_id: userId1, partner_id: userId2, married_at: now },
            { onConflict: 'guild_id,user_id' }
        );
        await supabase.from('user_social').upsert(
            { guild_id: guildId, user_id: userId2, partner_id: userId1, married_at: now },
            { onConflict: 'guild_id,user_id' }
        );
        return true;
    },

    async dissolveMarriage(guildId, userId) {
        if (!supabase) return true;
        const social = await this.getUserSocial(guildId, userId);
        if (!social.partnerId) return false;

        await supabase.from('user_social')
            .update({ partner_id: null, married_at: null })
            .eq('guild_id', guildId).eq('user_id', userId);

        await supabase.from('user_social')
            .update({ partner_id: null, married_at: null })
            .eq('guild_id', guildId).eq('user_id', social.partnerId);

        return true;
    },

    // ==========================================
    // Clans
    // ==========================================

    async createClan(guildId, ownerId, name) {
        if (!supabase) {
            // Memory check
            for (const [key, clan] of memoryClans) {
                if (key.startsWith(guildId) && clan.name.toLowerCase() === name.toLowerCase()) {
                    return { success: false, reason: 'A clan with that name already exists.' };
                }
            }

            const memberKey = `${guildId}_${ownerId}`;
            if (memoryClanMembers.has(memberKey)) {
                return { success: false, reason: 'You are already a member of a clan.' };
            }

            const profile = await this.getProfile(guildId, ownerId);
            if (profile.coins < 5000) return { success: false, reason: 'Creating a clan costs 5,000 coins.' };

            await this.updateCoins(guildId, ownerId, -5000);

            const clanId = `clan_${Math.random().toString(36).substring(2, 9)}`;
            const newClan = {
                id: clanId,
                guild_id: guildId,
                name: name,
                owner_id: ownerId,
                treasury: 0,
                xp_total: 0,
                level: 1,
                created_at: new Date()
            };

            memoryClans.set(`${guildId}_${clanId}`, newClan);
            memoryClanMembers.set(memberKey, clanId);

            return { success: true, clan: { id: clanId, name } };
        }

        const { data: existing } = await supabase.from('clans').select('id')
            .eq('guild_id', guildId).ilike('name', name).maybeSingle();
        if (existing) return { success: false, reason: 'A clan with that name already exists.' };

        const inClan = await this.getClanByMember(guildId, ownerId);
        if (inClan) return { success: false, reason: 'You are already a member of a clan.' };

        const profile = await this.getProfile(guildId, ownerId);
        if (profile.coins < 5000) return { success: false, reason: 'Creating a clan costs 5,000 coins.' };

        await this.updateCoins(guildId, ownerId, -5000);

        const { data, error } = await supabase.from('clans')
            .insert([{ guild_id: guildId, name, owner_id: ownerId, treasury: 0, xp_total: 0, level: 1 }])
            .select().single();

        if (error) { await this.updateCoins(guildId, ownerId, 5000); return { success: false, reason: 'Database error.' }; }

        await supabase.from('clan_members').insert([{ clan_id: data.id, guild_id: guildId, user_id: ownerId }]);
        return { success: true, clan: { id: data.id, name: data.name } };
    },

    async getClan(guildId, clanName) {
        if (!supabase) {
            let targetClan = null;
            for (const [key, clan] of memoryClans) {
                if (key.startsWith(guildId) && clan.name.toLowerCase() === clanName.toLowerCase()) {
                    targetClan = clan;
                    break;
                }
            }
            if (!targetClan) return null;

            const members = [];
            for (const [userKey, clanId] of memoryClanMembers) {
                if (clanId === targetClan.id && userKey.startsWith(guildId)) {
                    const userId = userKey.replace(`${guildId}_`, '');
                    members.push({ userId, joinedAt: new Date() });
                }
            }

            return {
                id: targetClan.id, name: targetClan.name, ownerId: targetClan.owner_id,
                treasury: targetClan.treasury, xpTotal: targetClan.xp_total,
                level: targetClan.level, createdAt: targetClan.created_at,
                members
            };
        }

        const { data, error } = await supabase.from('clans').select('*')
            .eq('guild_id', guildId).ilike('name', clanName).maybeSingle();
        if (error || !data) return null;

        const { data: members } = await supabase.from('clan_members')
            .select('user_id, joined_at').eq('clan_id', data.id).eq('guild_id', guildId);

        return {
            id: data.id, name: data.name, ownerId: data.owner_id,
            treasury: Number(data.treasury), xpTotal: Number(data.xp_total),
            level: data.level, createdAt: data.created_at,
            members: (members || []).map(m => ({ userId: m.user_id, joinedAt: m.joined_at }))
        };
    },

    async getClanByMember(guildId, userId) {
        if (!supabase) {
            const memberKey = `${guildId}_${userId}`;
            const clanId = memoryClanMembers.get(memberKey);
            if (!clanId) return null;

            const targetClan = memoryClans.get(`${guildId}_${clanId}`);
            if (!targetClan) return null;

            const members = [];
            for (const [userKey, cid] of memoryClanMembers) {
                if (cid === clanId && userKey.startsWith(guildId)) {
                    const uid = userKey.replace(`${guildId}_`, '');
                    members.push({ userId: uid, joinedAt: new Date() });
                }
            }

            return {
                id: targetClan.id, name: targetClan.name, ownerId: targetClan.owner_id,
                treasury: targetClan.treasury, xpTotal: targetClan.xp_total,
                level: targetClan.level, createdAt: targetClan.created_at,
                members
            };
        }

        const { data: membership } = await supabase.from('clan_members').select('clan_id')
            .eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
        if (!membership) return null;

        const { data } = await supabase.from('clans').select('*').eq('id', membership.clan_id).maybeSingle();
        if (!data) return null;

        const { data: members } = await supabase.from('clan_members')
            .select('user_id, joined_at').eq('clan_id', data.id);

        return {
            id: data.id, name: data.name, ownerId: data.owner_id,
            treasury: Number(data.treasury), xpTotal: Number(data.xp_total),
            level: data.level, createdAt: data.created_at,
            members: (members || []).map(m => ({ userId: m.user_id, joinedAt: m.joined_at }))
        };
    },

    async joinClan(guildId, userId, clanId) {
        if (!supabase) {
            memoryClanMembers.set(`${guildId}_${userId}`, clanId);
            return { success: true };
        }
        const { error } = await supabase.from('clan_members')
            .insert([{ clan_id: clanId, guild_id: guildId, user_id: userId }]);
        if (error) return { success: false, reason: 'Database error.' };
        return { success: true };
    },

    async leaveClan(guildId, userId) {
        if (!supabase) {
            memoryClanMembers.delete(`${guildId}_${userId}`);
            return true;
        }
        const { error } = await supabase.from('clan_members')
            .delete().eq('guild_id', guildId).eq('user_id', userId);
        return !error;
    },

    async kickFromClan(guildId, clanId, userId) {
        if (!supabase) {
            memoryClanMembers.delete(`${guildId}_${userId}`);
            return true;
        }
        const { error } = await supabase.from('clan_members')
            .delete().eq('clan_id', clanId).eq('guild_id', guildId).eq('user_id', userId);
        return !error;
    },

    async depositToClan(guildId, clanId, userId, amount) {
        const profile = await this.getProfile(guildId, userId);
        if (profile.coins < amount) return { success: false, reason: 'Insufficient wallet balance.' };

        if (!supabase) {
            const key = `${guildId}_${clanId}`;
            const clan = memoryClans.get(key);
            if (!clan) return { success: false, reason: 'Clan not found.' };

            await this.updateCoins(guildId, userId, -amount);
            clan.treasury += amount;
            return { success: true, newTreasury: clan.treasury };
        }

        const { data: clan, error: fetchError } = await supabase.from('clans')
            .select('treasury').eq('id', clanId).single();
        if (fetchError || !clan) return { success: false, reason: 'Clan not found.' };

        await this.updateCoins(guildId, userId, -amount);
        const newTreasury = Number(clan.treasury) + amount;
        const { error } = await supabase.from('clans').update({ treasury: newTreasury }).eq('id', clanId);
        if (error) { await this.updateCoins(guildId, userId, amount); return { success: false, reason: 'Database error.' }; }
        return { success: true, newTreasury };
    },

    async getClanLeaderboard(guildId, sortBy = 'treasury') {
        if (!supabase) {
            const list = [];
            for (const [key, clan] of memoryClans) {
                if (key.startsWith(guildId)) {
                    list.push(clan);
                }
            }

            if (sortBy === 'level') {
                list.sort((a, b) => b.level - a.level || b.xp_total - a.xp_total);
            } else {
                list.sort((a, b) => b.treasury - a.treasury);
            }

            return list.slice(0, 10).map((c, i) => ({
                rank: i + 1, name: c.name, ownerId: c.owner_id,
                treasury: c.treasury, level: c.level, xpTotal: c.xp_total
            }));
        }

        const orderCol = sortBy === 'level' ? 'level' : 'treasury';
        const { data, error } = await supabase.from('clans')
            .select('name, owner_id, treasury, level, xp_total')
            .eq('guild_id', guildId)
            .order(orderCol, { ascending: false })
            .order('xp_total', { ascending: false })
            .limit(10);

        if (error) return [];
        return data.map((c, i) => ({
            rank: i + 1, name: c.name, ownerId: c.owner_id,
            treasury: Number(c.treasury), level: c.level, xpTotal: Number(c.xp_total)
        }));
    },

    async renameClan(guildId, clanId, newName) {
        if (!supabase) {
            // Check if name exists
            for (const [key, c] of memoryClans) {
                if (key.startsWith(guildId) && c.name.toLowerCase() === newName.toLowerCase() && c.id !== clanId) {
                    return { success: false, reason: 'A clan with that name already exists.' };
                }
            }

            const key = `${guildId}_${clanId}`;
            const clan = memoryClans.get(key);
            if (!clan) return { success: false, reason: 'Clan not found.' };
            if (clan.treasury < 2500) return { success: false, reason: 'Renaming costs 2,500 coins from the clan treasury.' };

            clan.treasury -= 2500;
            clan.name = newName;
            return { success: true };
        }

        // Check unique
        const { data: existing } = await supabase.from('clans').select('id')
            .eq('guild_id', guildId).ilike('name', newName).maybeSingle();
        if (existing && existing.id !== clanId) {
            return { success: false, reason: 'A clan with that name already exists.' };
        }

        const { data: clan, error: fetchError } = await supabase.from('clans')
            .select('treasury').eq('id', clanId).single();
        if (fetchError || !clan) return { success: false, reason: 'Clan not found.' };

        if (Number(clan.treasury) < 2500) {
            return { success: false, reason: 'Renaming costs 2,500 coins from the clan treasury.' };
        }

        const newTreasury = Number(clan.treasury) - 2500;
        const { error } = await supabase.from('clans')
            .update({ name: newName, treasury: newTreasury })
            .eq('id', clanId);

        if (error) return { success: false, reason: 'Database error.' };
        return { success: true };
    },

    async disbandClan(guildId, clanId) {
        if (!supabase) {
            memoryClans.delete(`${guildId}_${clanId}`);
            for (const [userKey, cid] of memoryClanMembers) {
                if (cid === clanId && userKey.startsWith(guildId)) {
                    memoryClanMembers.delete(userKey);
                }
            }
            return true;
        }

        const { error } = await supabase.from('clans').delete().eq('id', clanId).eq('guild_id', guildId);
        return !error;
    },

    async addClanXp(guildId, clanId, amount) {
        if (!supabase) {
            const key = `${guildId}_${clanId}`;
            const clan = memoryClans.get(key);
            if (!clan) return { success: false };

            clan.xp_total += amount;
            let currentLevel = clan.level;
            let xpNeeded = currentLevel * 1000;
            let leveledUp = false;

            while (clan.xp_total >= xpNeeded) {
                clan.xp_total -= xpNeeded;
                clan.level += 1;
                currentLevel = clan.level;
                xpNeeded = currentLevel * 1000;
                leveledUp = true;
            }

            return { success: true, levelUp: leveledUp, newLevel: clan.level, newXp: clan.xp_total };
        }

        const { data: clan, error: fetchError } = await supabase.from('clans')
            .select('level, xp_total').eq('id', clanId).single();
        if (fetchError || !clan) return { success: false };

        let currentLevel = clan.level;
        let newXpTotal = Number(clan.xp_total) + amount;
        let xpNeeded = currentLevel * 1000;
        let leveledUp = false;

        while (newXpTotal >= xpNeeded) {
            newXpTotal -= xpNeeded;
            currentLevel += 1;
            xpNeeded = currentLevel * 1000;
            leveledUp = true;
        }

        const { error } = await supabase.from('clans')
            .update({ level: currentLevel, xp_total: newXpTotal })
            .eq('id', clanId);

        if (error) return { success: false };
        return { success: true, levelUp: leveledUp, newLevel: currentLevel, newXp: newXpTotal };
    },

    // ==========================================
    // Analytics
    // ==========================================

    async getServerAnalytics(guildId) {
        if (!supabase) return null;
        const [profilesRes, topRichRes] = await Promise.all([
            supabase.from('user_profiles').select('coins, bank, xp, level').eq('guild_id', guildId),
            supabase.from('user_profiles').select('user_id, coins, bank').eq('guild_id', guildId)
                .order('coins', { ascending: false }).limit(5)
        ]);
        const profiles = profilesRes.data || [];
        const totalMembers = profiles.length;
        const totalCoins = profiles.reduce((s, p) => s + Number(p.coins) + Number(p.bank || 0), 0);
        const totalXp = profiles.reduce((s, p) => s + Number(p.xp), 0);
        const avgLevel = totalMembers > 0
            ? (profiles.reduce((s, p) => s + Number(p.level), 0) / totalMembers).toFixed(1) : 0;
        return {
            totalMembers, totalCoins, totalXp, avgLevel,
            topRich: (topRichRes.data || []).map(p => ({
                userId: p.user_id, wealth: Number(p.coins) + Number(p.bank || 0)
            }))
        };
    },

    async getTopWealthUsers(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase.from('user_profiles')
            .select('user_id, coins, bank, xp, level')
            .eq('guild_id', guildId)
            .order('coins', { ascending: false })
            .limit(10);
        if (error) return [];
        return data.map((p, i) => ({
            rank: i + 1, userId: p.user_id,
            wallet: Number(p.coins), bank: Number(p.bank || 0),
            wealth: Number(p.coins) + Number(p.bank || 0),
            level: p.level, xp: Number(p.xp)
        }));
    },

    xpNeededForNextLevel,

    // ==========================================
    // Reset — wipe all guild data
    // ==========================================

    async resetGuildData(guildId) {
        if (!supabase) return { success: true, note: 'no-op: supabase not configured' };

        const tables = [
            'warnings',
            'logs',
            'guild_configs',
            'blocked_words',
            'automod_exemptions',
            'automod_rules',
            'automod_filter_optouts',
            'user_profiles',
            'shop_items',
            'user_inventory',
            'market_listings',
            'level_rewards',
            'custom_commands',
            'youtube_alerts',
            'twitch_alerts',
            'giveaways',
            'guild_events',
            'polls',
            'guild_tickets',
            'user_pets',
            'user_stocks',
            'clans',
            'clan_members',
            'user_social',
            'lottery_config',
            'lottery_tickets',
            'market_commodities',
            'market_ticks',
        ];

        const errors = [];
        for (const table of tables) {
            const { error } = await supabase.from(table).delete().eq('guild_id', guildId);
            if (error) errors.push(`${table}: ${error.message}`);
        }

        if (errors.length > 0) {
            console.error(`[DB] resetGuildData partial failure for ${guildId}:`, errors);
            return { success: false, errors };
        }

        return { success: true };
    },

    // ==========================================
    // 7. Ticket Tracking
    // ==========================================

    async addTicket(guildId, channelId, channelName, openerId, openerTag) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('guild_tickets')
            .insert([{
                guild_id: guildId,
                channel_id: channelId,
                channel_name: channelName,
                opener_id: openerId,
                opener_tag: openerTag,
                status: 'open',
                opened_at: Date.now()
            }])
            .select()
            .single();
        if (error) { console.error('[DB] addTicket error:', error.message); return null; }
        return data;
    },

    async closeTicket(guildId, channelId) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('guild_tickets')
            .update({ status: 'closed', closed_at: Date.now() })
            .eq('guild_id', guildId)
            .eq('channel_id', channelId);
        if (error) console.error('[DB] closeTicket error:', error.message);
        return !error;
    },

    async getTickets(guildId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('guild_tickets')
            .select('*')
            .eq('guild_id', guildId)
            .order('opened_at', { ascending: false })
            .limit(200);
        if (error) return [];
        return data.map(t => ({
            id: t.id,
            guildId: t.guild_id,
            channelId: t.channel_id,
            channelName: t.channel_name,
            openerId: t.opener_id,
            openerTag: t.opener_tag,
            status: t.status,
            openedAt: Number(t.opened_at),
            closedAt: t.closed_at ? Number(t.closed_at) : null
        }));
    },

    // ==========================================
    // Stock & Asset Management System Helpers
    // ==========================================
    STOCK_CATALOG: {
        // NASDAQ (USA - $)
        AAPL: { symbol: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ', basePrice: 175, currency: '$' },
        MSFT: { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'NASDAQ', basePrice: 420, currency: '$' },
        TSLA: { symbol: 'TSLA', name: 'Tesla Inc.', market: 'NASDAQ', basePrice: 180, currency: '$' },
        NVDA: { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'NASDAQ', basePrice: 900, currency: '$' },
        AMZN: { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'NASDAQ', basePrice: 185, currency: '$' },
        GOOG: { symbol: 'GOOG', name: 'Alphabet Inc.', market: 'NASDAQ', basePrice: 170, currency: '$' },
        META: { symbol: 'META', name: 'Meta Platforms Inc.', market: 'NASDAQ', basePrice: 500, currency: '$' },
        NFLX: { symbol: 'NFLX', name: 'Netflix Inc.', market: 'NASDAQ', basePrice: 620, currency: '$' },
        AMD: { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', market: 'NASDAQ', basePrice: 160, currency: '$' },
        INTC: { symbol: 'INTC', name: 'Intel Corp.', market: 'NASDAQ', basePrice: 30, currency: '$' },
        PYPL: { symbol: 'PYPL', name: 'PayPal Holdings Inc.', market: 'NASDAQ', basePrice: 65, currency: '$' },
        ADBE: { symbol: 'ADBE', name: 'Adobe Inc.', market: 'NASDAQ', basePrice: 450, currency: '$' },
        ORCL: { symbol: 'ORCL', name: 'Oracle Corp.', market: 'NASDAQ', basePrice: 130, currency: '$' },
        CRM: { symbol: 'CRM', name: 'Salesforce Inc.', market: 'NASDAQ', basePrice: 280, currency: '$' },
        QCOM: { symbol: 'QCOM', name: 'Qualcomm Inc.', market: 'NASDAQ', basePrice: 175, currency: '$' },
        COST: { symbol: 'COST', name: 'Costco Wholesale Corp.', market: 'NASDAQ', basePrice: 870, currency: '$' },
        UBER: { symbol: 'UBER', name: 'Uber Technologies Inc.', market: 'NASDAQ', basePrice: 75, currency: '$' },
        ABNB: { symbol: 'ABNB', name: 'Airbnb Inc.', market: 'NASDAQ', basePrice: 145, currency: '$' },
        SBUX: { symbol: 'SBUX', name: 'Starbucks Corp.', market: 'NASDAQ', basePrice: 75, currency: '$' },
        ZM: { symbol: 'ZM', name: 'Zoom Video Communications Inc.', market: 'NASDAQ', basePrice: 65, currency: '$' },

        // NSE (India - ₹)
        RELIANCE: { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', market: 'NSE', basePrice: 2900, currency: '₹' },
        TCS: { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'NSE', basePrice: 3850, currency: '₹' },
        INFY: { symbol: 'INFY', name: 'Infosys Ltd.', market: 'NSE', basePrice: 1420, currency: '₹' },
        HDFCBANK: { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', market: 'NSE', basePrice: 1550, currency: '₹' },
        ICICIBANK: { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', market: 'NSE', basePrice: 1100, currency: '₹' },
        WIPRO: { symbol: 'WIPRO', name: 'Wipro Ltd.', market: 'NSE', basePrice: 480, currency: '₹' },
        HCLTECH: { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', market: 'NSE', basePrice: 1650, currency: '₹' },
        BAJFINANCE: { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', market: 'NSE', basePrice: 7000, currency: '₹' },
        SBIN: { symbol: 'SBIN', name: 'State Bank of India', market: 'NSE', basePrice: 820, currency: '₹' },
        MARUTI: { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', market: 'NSE', basePrice: 12500, currency: '₹' },
        ASIANPAINT: { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', market: 'NSE', basePrice: 2700, currency: '₹' },
        HINDUNILVR: { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', market: 'NSE', basePrice: 2450, currency: '₹' },
        LT: { symbol: 'LT', name: 'Larsen & Toubro Ltd.', market: 'NSE', basePrice: 3500, currency: '₹' },
        SUNPHARMA: { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries', market: 'NSE', basePrice: 1700, currency: '₹' },
        TITAN: { symbol: 'TITAN', name: 'Titan Company Ltd.', market: 'NSE', basePrice: 3600, currency: '₹' },
        ULTRACEMCO: { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', market: 'NSE', basePrice: 10500, currency: '₹' },
        ONGC: { symbol: 'ONGC', name: 'Oil & Natural Gas Corp. Ltd.', market: 'NSE', basePrice: 270, currency: '₹' },
        POWERGRID: { symbol: 'POWERGRID', name: 'Power Grid Corp. of India Ltd.', market: 'NSE', basePrice: 330, currency: '₹' },
        ADANIPORTS: { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd.', market: 'NSE', basePrice: 1400, currency: '₹' },
        ITC: { symbol: 'ITC', name: 'ITC Ltd.', market: 'NSE', basePrice: 450, currency: '₹' },

        // LSE (London - £)
        BP: { symbol: 'BP', name: 'BP plc', market: 'LSE', basePrice: 5.10, currency: '£' },
        HSBA: { symbol: 'HSBA', name: 'HSBC Holdings plc', market: 'LSE', basePrice: 6.80, currency: '£' },
        VOD: { symbol: 'VOD', name: 'Vodafone Group plc', market: 'LSE', basePrice: 0.70, currency: '£' },
        BARC: { symbol: 'BARC', name: 'Barclays plc', market: 'LSE', basePrice: 1.90, currency: '£' },
        GSK: { symbol: 'GSK', name: 'GSK plc', market: 'LSE', basePrice: 16.50, currency: '£' },
        AZN: { symbol: 'AZN', name: 'AstraZeneca plc', market: 'LSE', basePrice: 124, currency: '£' },
        SHEL: { symbol: 'SHEL', name: 'Shell plc', market: 'LSE', basePrice: 26, currency: '£' },
        ULVR: { symbol: 'ULVR', name: 'Unilever plc', market: 'LSE', basePrice: 39, currency: '£' },
        DGE: { symbol: 'DGE', name: 'Diageo plc', market: 'LSE', basePrice: 22, currency: '£' },
        GLEN: { symbol: 'GLEN', name: 'Glencore plc', market: 'LSE', basePrice: 4.50, currency: '£' },
        RKT: { symbol: 'RKT', name: 'Reckitt Benckiser Group plc', market: 'LSE', basePrice: 42, currency: '£' },
        IAG: { symbol: 'IAG', name: 'International Airlines Group plc', market: 'LSE', basePrice: 2.10, currency: '£' },
        NG: { symbol: 'NG', name: 'National Grid plc', market: 'LSE', basePrice: 10, currency: '£' },
        RR: { symbol: 'RR', name: 'Rolls-Royce Holdings plc', market: 'LSE', basePrice: 4.50, currency: '£' },
        MKS: { symbol: 'MKS', name: 'Marks & Spencer Group plc', market: 'LSE', basePrice: 3.80, currency: '£' },
        LLOY: { symbol: 'LLOY', name: 'Lloyds Banking Group plc', market: 'LSE', basePrice: 0.55, currency: '£' },
        NXT: { symbol: 'NXT', name: 'Next plc', market: 'LSE', basePrice: 93, currency: '£' },
        TSCO: { symbol: 'TSCO', name: 'Tesco plc', market: 'LSE', basePrice: 3.50, currency: '£' },
        BT: { symbol: 'BT', name: 'BT Group plc', market: 'LSE', basePrice: 1.50, currency: '£' },
        LSEG: { symbol: 'LSEG', name: 'London Stock Exchange Group plc', market: 'LSE', basePrice: 100, currency: '£' },

        // CRYPTO (Global - ${EMOJIS.coin})
        BTC: { symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', basePrice: 65000, currency: EMOJIS.coin },
        ETH: { symbol: 'ETH', name: 'Ethereum', market: 'CRYPTO', basePrice: 3500, currency: EMOJIS.coin },
        BNB: { symbol: 'BNB', name: 'BNB Coin', market: 'CRYPTO', basePrice: 580, currency: EMOJIS.coin },
        SOL: { symbol: 'SOL', name: 'Solana', market: 'CRYPTO', basePrice: 150, currency: EMOJIS.coin },
        XRP: { symbol: 'XRP', name: 'Ripple', market: 'CRYPTO', basePrice: 0.50, currency: EMOJIS.coin },
        ADA: { symbol: 'ADA', name: 'Cardano', market: 'CRYPTO', basePrice: 0.45, currency: EMOJIS.coin },
        DOGE: { symbol: 'DOGE', name: 'Dogecoin', market: 'CRYPTO', basePrice: 0.15, currency: EMOJIS.coin },
        SHIB: { symbol: 'SHIB', name: 'Shiba Inu', market: 'CRYPTO', basePrice: 0.000025, currency: EMOJIS.coin },
        DOT: { symbol: 'DOT', name: 'Polkadot', market: 'CRYPTO', basePrice: 6.50, currency: EMOJIS.coin },
        MATIC: { symbol: 'MATIC', name: 'Polygon', market: 'CRYPTO', basePrice: 0.70, currency: EMOJIS.coin },
        LINK: { symbol: 'LINK', name: 'Chainlink', market: 'CRYPTO', basePrice: 16.00, currency: EMOJIS.coin },
        LTC: { symbol: 'LTC', name: 'Litecoin', market: 'CRYPTO', basePrice: 85.00, currency: EMOJIS.coin },
        AVAX: { symbol: 'AVAX', name: 'Avalanche', market: 'CRYPTO', basePrice: 35.00, currency: EMOJIS.coin },
        UNI: { symbol: 'UNI', name: 'Uniswap', market: 'CRYPTO', basePrice: 7.50, currency: EMOJIS.coin },
        TRX: { symbol: 'TRX', name: 'TRON', market: 'CRYPTO', basePrice: 0.12, currency: EMOJIS.coin },
        ATOM: { symbol: 'ATOM', name: 'Cosmos', market: 'CRYPTO', basePrice: 8.50, currency: EMOJIS.coin },
        ETC: { symbol: 'ETC', name: 'Ethereum Classic', market: 'CRYPTO', basePrice: 28.00, currency: EMOJIS.coin },
        XLM: { symbol: 'XLM', name: 'Stellar Lumens', market: 'CRYPTO', basePrice: 0.11, currency: EMOJIS.coin },
        NEAR: { symbol: 'NEAR', name: 'Near Protocol', market: 'CRYPTO', basePrice: 6.00, currency: EMOJIS.coin },
        FIL: { symbol: 'FIL', name: 'Filecoin', market: 'CRYPTO', basePrice: 5.50, currency: EMOJIS.coin },

        // TYO (Tokyo, Japan - ¥)
        SONY: { symbol: 'SONY', name: 'Sony Group Corp.', market: 'TYO', basePrice: 13000, currency: '¥' },
        TOYOTA: { symbol: 'TOYOTA', name: 'Toyota Motor Corp.', market: 'TYO', basePrice: 3500, currency: '¥' },
        NINTENDO: { symbol: 'NINTENDO', name: 'Nintendo Co. Ltd.', market: 'TYO', basePrice: 7800, currency: '¥' },
        HONDA: { symbol: 'HONDA', name: 'Honda Motor Co.', market: 'TYO', basePrice: 1700, currency: '¥' },
        SOFTBANK: { symbol: 'SOFTBANK', name: 'SoftBank Group Corp.', market: 'TYO', basePrice: 8500, currency: '¥' },
        KEYENCE: { symbol: 'KEYENCE', name: 'Keyence Corp.', market: 'TYO', basePrice: 65000, currency: '¥' },
        FASTRET: { symbol: 'FASTRET', name: 'Fast Retailing Co.', market: 'TYO', basePrice: 42000, currency: '¥' },
        FANUC: { symbol: 'FANUC', name: 'Fanuc Corp.', market: 'TYO', basePrice: 4200, currency: '¥' },
        HITACHI: { symbol: 'HITACHI', name: 'Hitachi Ltd.', market: 'TYO', basePrice: 14000, currency: '¥' },
        MITSUBISHI: { symbol: 'MITSUBISHI', name: 'Mitsubishi Corp.', market: 'TYO', basePrice: 3200, currency: '¥' },
        RECRUIT: { symbol: 'RECRUIT', name: 'Recruit Holdings Co.', market: 'TYO', basePrice: 6500, currency: '¥' },
        TOKYOEL: { symbol: 'TOKYOEL', name: 'Tokyo Electron Ltd.', market: 'TYO', basePrice: 34000, currency: '¥' },
        SHINETSU: { symbol: 'SHINETSU', name: 'Shin-Etsu Chemical Co.', market: 'TYO', basePrice: 6200, currency: '¥' },
        NIDEC: { symbol: 'NIDEC', name: 'Nidec Corp.', market: 'TYO', basePrice: 5800, currency: '¥' },
        SUMITOMO: { symbol: 'SUMITOMO', name: 'Sumitomo Mitsui Financial Group', market: 'TYO', basePrice: 9200, currency: '¥' },
        MUFG: { symbol: 'MUFG', name: 'Mitsubishi UFJ Financial Group', market: 'TYO', basePrice: 1500, currency: '¥' },
        KDDI: { symbol: 'KDDI', name: 'KDDI Corp.', market: 'TYO', basePrice: 4500, currency: '¥' },
        ANAS: { symbol: 'ANAS', name: 'ANA Holdings Inc.', market: 'TYO', basePrice: 3100, currency: '¥' },
        ASICS: { symbol: 'ASICS', name: 'ASICS Corp.', market: 'TYO', basePrice: 8000, currency: '¥' },
        PANASONIC: { symbol: 'PANASONIC', name: 'Panasonic Holdings Corp.', market: 'TYO', basePrice: 1300, currency: '¥' },

        // ASX (Australia - A$)
        BHP: { symbol: 'BHP', name: 'BHP Group Ltd.', market: 'ASX', basePrice: 43, currency: 'A$' },
        CBA: { symbol: 'CBA', name: 'Commonwealth Bank of Australia', market: 'ASX', basePrice: 115, currency: 'A$' },
        CSL: { symbol: 'CSL', name: 'CSL Limited', market: 'ASX', basePrice: 280, currency: 'A$' },
        WBC: { symbol: 'WBC', name: 'Westpac Banking Corp.', market: 'ASX', basePrice: 26, currency: 'A$' },
        NAB: { symbol: 'NAB', name: 'National Australia Bank Ltd.', market: 'ASX', basePrice: 34, currency: 'A$' },
        ANZ: { symbol: 'ANZ', name: 'ANZ Group Holdings Ltd.', market: 'ASX', basePrice: 28, currency: 'A$' },
        FMG: { symbol: 'FMG', name: 'Fortescue Ltd.', market: 'ASX', basePrice: 22, currency: 'A$' },
        WDS: { symbol: 'WDS', name: 'Woodside Energy Group Ltd.', market: 'ASX', basePrice: 29, currency: 'A$' },
        TLS: { symbol: 'TLS', name: 'Telstra Group Ltd.', market: 'ASX', basePrice: 3.80, currency: 'A$' },
        WOW: { symbol: 'WOW', name: 'Woolworths Group Ltd.', market: 'ASX', basePrice: 32, currency: 'A$' },
        WES: { symbol: 'WES', name: 'Wesfarmers Ltd.', market: 'ASX', basePrice: 65, currency: 'A$' },
        MQG: { symbol: 'MQG', name: 'Macquarie Group Ltd.', market: 'ASX', basePrice: 185, currency: 'A$' },
        RIO: { symbol: 'RIO', name: 'Rio Tinto Ltd.', market: 'ASX', basePrice: 120, currency: 'A$' },
        COL: { symbol: 'COL', name: 'Coles Group Ltd.', market: 'ASX', basePrice: 16, currency: 'A$' },
        TCL: { symbol: 'TCL', name: 'Transurban Group', market: 'ASX', basePrice: 12.50, currency: 'A$' },
        REA: { symbol: 'REA', name: 'REA Group Ltd.', market: 'ASX', basePrice: 180, currency: 'A$' },
        ALL: { symbol: 'ALL', name: 'Aristocrat Leisure Ltd.', market: 'ASX', basePrice: 45, currency: 'A$' },
        XRO: { symbol: 'XRO', name: 'Xero Ltd.', market: 'ASX', basePrice: 130, currency: 'A$' },
        APA: { symbol: 'APA', name: 'APA Group', market: 'ASX', basePrice: 8.20, currency: 'A$' },
        PLS: { symbol: 'PLS', name: 'Pilbara Minerals Ltd.', market: 'ASX', basePrice: 3.50, currency: 'A$' }
    },

    getSymbolHash(symbol) {
        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    },

    getStockParams(symbol) {
        const seed = this.getSymbolHash(symbol);
        let r = seed;
        const nextRand = () => {
            r = Math.sin(r) * 10000;
            return r - Math.floor(r);
        };

        const numWaves = 4;
        const waves = [];
        for (let i = 0; i < numWaves; i++) {
            waves.push({
                freq: (nextRand() * 0.05) + 0.002,
                amp: (nextRand() * 0.04) + 0.01,
                phase: nextRand() * Math.PI * 2
            });
        }

        const driftPerMin = ((nextRand() * 0.0005) + 0.0001) / 1440;

        return { waves, driftPerMin };
    },

    getStockPrice(symbol) {
        const stock = this.STOCK_CATALOG[symbol.toUpperCase()];
        if (!stock) return null;

        const epoch = 1767225600000; // Jan 1, 2026
        const t = Math.floor((Date.now() - epoch) / 60000);
        const params = this.getStockParams(symbol);

        let fluctuation = 0;
        for (const wave of params.waves) {
            fluctuation += wave.amp * Math.sin(wave.freq * t + wave.phase);
        }

        const drift = params.driftPerMin * t;
        const rawPrice = stock.basePrice * (1 + drift + fluctuation);
        const minPrice = stock.basePrice * 0.01;
        const finalPrice = Math.max(minPrice, rawPrice);

        // 24h ago
        const tYesterday = t - 1440;
        let fluctuationYesterday = 0;
        for (const wave of params.waves) {
            fluctuationYesterday += wave.amp * Math.sin(wave.freq * tYesterday + wave.phase);
        }
        const driftYesterday = params.driftPerMin * tYesterday;
        const priceYesterday = Math.max(minPrice, stock.basePrice * (1 + driftYesterday + fluctuationYesterday));

        const changePercent = ((finalPrice - priceYesterday) / priceYesterday) * 100;

        return {
            ...stock,
            price: Number(finalPrice.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            priceYesterday: Number(priceYesterday.toFixed(2))
        };
    },

    async buyStock(guildId, userId, symbol, shares) {
        if (!supabase) throw new Error('Database not connected.');
        
        const stockQuote = this.getStockPrice(symbol);
        if (!stockQuote) throw new Error('Invalid stock symbol.');
        
        const cost = Math.round(shares * stockQuote.price);
        const profile = await this.getProfile(guildId, userId);
        if (profile.coins < cost) {
            throw new Error(`Insufficient wallet balance. You need ${cost} coins but only have ${profile.coins} coins.`);
        }

        // Deduct from wallet
        const newBalance = await this.updateCoins(guildId, userId, -cost);

        // Check if already owns shares
        const { data: existing, error: selectError } = await supabase
            .from('user_stocks')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', stockQuote.symbol)
            .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {
            const oldShares = existing.shares;
            const oldAvg = existing.average_buy_price;
            const newShares = oldShares + shares;
            const newAvg = ((oldShares * oldAvg) + (shares * stockQuote.price)) / newShares;

            const { error: updateError } = await supabase
                .from('user_stocks')
                .update({
                    shares: newShares,
                    average_buy_price: newAvg,
                    updated_at: new Date()
                })
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('symbol', stockQuote.symbol);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('user_stocks')
                .insert([{
                    guild_id: guildId,
                    user_id: userId,
                    symbol: stockQuote.symbol,
                    market: stockQuote.market,
                    shares: shares,
                    average_buy_price: stockQuote.price,
                    updated_at: new Date()
                }]);

            if (insertError) throw insertError;
        }

        return {
            success: true,
            symbol: stockQuote.symbol,
            price: stockQuote.price,
            shares,
            cost,
            currency: stockQuote.currency,
            newBalance
        };
    },

    async sellStock(guildId, userId, symbol, shares) {
        if (!supabase) throw new Error('Database not connected.');
        
        const stockQuote = this.getStockPrice(symbol);
        if (!stockQuote) throw new Error('Invalid stock symbol.');

        const { data: existing, error: selectError } = await supabase
            .from('user_stocks')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', stockQuote.symbol)
            .maybeSingle();

        if (selectError) throw selectError;
        if (!existing || existing.shares < shares) {
            throw new Error(`You do not own enough shares of ${stockQuote.symbol}. Owned: ${existing ? existing.shares : 0}, requested: ${shares}`);
        }

        const revenue = Math.round(shares * stockQuote.price);
        const newShares = existing.shares - shares;

        if (newShares <= 0.00001) {
            // Delete record
            const { error: deleteError } = await supabase
                .from('user_stocks')
                .delete()
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('symbol', stockQuote.symbol);

            if (deleteError) throw deleteError;
        } else {
            // Update record
            const { error: updateError } = await supabase
                .from('user_stocks')
                .update({
                    shares: newShares,
                    updated_at: new Date()
                })
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('symbol', stockQuote.symbol);

            if (updateError) throw updateError;
        }

        // Add to wallet
        const newBalance = await this.updateCoins(guildId, userId, revenue);

        return {
            success: true,
            symbol: stockQuote.symbol,
            price: stockQuote.price,
            shares,
            revenue,
            currency: stockQuote.currency,
            newBalance
        };
    },

    async getUserStocksTotalValue(guildId, userId) {
        if (!supabase) return { totalValue: 0, totalCost: 0, totalProfitLoss: 0, holdings: [] };

        const { data, error } = await supabase
            .from('user_stocks')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) {
            console.error('[DB] getUserStocksTotalValue error:', error.message);
            return { totalValue: 0, totalCost: 0, totalProfitLoss: 0, holdings: [] };
        }

        let totalValue = 0;
        let totalCost = 0;
        const holdings = [];

        for (const item of data) {
            const quote = this.getStockPrice(item.symbol);
            if (quote) {
                const currentVal = item.shares * quote.price;
                const costVal = item.shares * item.average_buy_price;
                totalValue += currentVal;
                totalCost += costVal;

                holdings.push({
                    symbol: item.symbol,
                    market: item.market,
                    shares: item.shares,
                    averageBuyPrice: item.average_buy_price,
                    currentPrice: quote.price,
                    currentValue: currentVal,
                    costValue: costVal,
                    pnl: currentVal - costVal,
                    pnlPercent: costVal > 0 ? ((currentVal - costVal) / costVal) * 100 : 0,
                    currency: quote.currency
                });
            }
        }

        return {
            totalValue,
            totalCost,
            totalProfitLoss: totalValue - totalCost,
            holdings
        };
    },

    // Admin: grant shares to a user without deducting coins (uses current price as avg buy price)
    async adminGrantStock(guildId, userId, symbol, shares) {
        if (!supabase) throw new Error('Database not connected.');
        const quote = this.getStockPrice(symbol);
        if (!quote) throw new Error('Invalid stock symbol.');

        const { data: existing } = await supabase
            .from('user_stocks')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', quote.symbol)
            .maybeSingle();

        if (existing) {
            const newShares = existing.shares + shares;
            const newAvg = ((existing.shares * existing.average_buy_price) + (shares * quote.price)) / newShares;
            const { error } = await supabase
                .from('user_stocks')
                .update({ shares: newShares, average_buy_price: newAvg, updated_at: new Date().toISOString() })
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('symbol', quote.symbol);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('user_stocks')
                .insert([{ guild_id: guildId, user_id: userId, symbol: quote.symbol, market: quote.market, shares, average_buy_price: quote.price }]);
            if (error) throw error;
        }

        return { symbol: quote.symbol, shares, price: quote.price };
    },

    // Admin: remove shares from a user without crediting coins
    async adminRevokeStock(guildId, userId, symbol, shares) {
        if (!supabase) throw new Error('Database not connected.');
        const quote = this.getStockPrice(symbol);
        if (!quote) throw new Error('Invalid stock symbol.');

        const { data: existing } = await supabase
            .from('user_stocks')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', quote.symbol)
            .maybeSingle();

        if (!existing || existing.shares <= 0) throw new Error(`User does not hold any shares of ${symbol}.`);
        if (shares > existing.shares) throw new Error(`User only holds ${existing.shares.toFixed(4)} shares of ${symbol}.`);

        const newShares = existing.shares - shares;
        if (newShares < 0.0001) {
            const { error } = await supabase
                .from('user_stocks')
                .delete()
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('symbol', quote.symbol);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('user_stocks')
                .update({ shares: newShares, updated_at: new Date().toISOString() })
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('symbol', quote.symbol);
            if (error) throw error;
        }

        return { symbol: quote.symbol, shares, price: quote.price };
    },

    // Returns 48 price data points sampled every 30 minutes over the last 24 hours
    getStockChartData(symbol) {
        const stock = this.STOCK_CATALOG[symbol.toUpperCase()];
        if (!stock) return null;

        const epoch = 1767225600000;
        const now = Date.now();
        const points = [];
        const steps = 48;
        const intervalMs = 30 * 60 * 1000;

        for (let i = steps; i >= 0; i--) {
            const ts = now - i * intervalMs;
            const t = Math.floor((ts - epoch) / 60000);
            const params = this.getStockParams(symbol);
            let fluctuation = 0;
            for (const wave of params.waves) {
                fluctuation += wave.amp * Math.sin(wave.freq * t + wave.phase);
            }
            const drift = params.driftPerMin * t;
            const rawPrice = stock.basePrice * (1 + drift + fluctuation);
            const price = Math.max(stock.basePrice * 0.01, rawPrice);
            points.push({ ts, price: Number(price.toFixed(4)) });
        }

        return { symbol: stock.symbol, name: stock.name, currency: stock.currency, market: stock.market, points };
    },

    async openIntradayPosition(guildId, userId, symbol, type, margin, leverage = 5) {
        if (!supabase) throw new Error('Database not connected.');
        
        const stockQuote = this.getStockPrice(symbol);
        if (!stockQuote) throw new Error('Invalid stock symbol.');
        if (type !== 'LONG' && type !== 'SHORT') throw new Error('Position type must be LONG or SHORT.');

        const profile = await this.getProfile(guildId, userId);
        if (profile.coins < margin) {
            throw new Error(`Insufficient wallet balance. You need ${margin} coins but only have ${profile.coins} coins.`);
        }

        // Check if there is already an active intraday position for this symbol
        const { data: existing, error: selectError } = await supabase
            .from('user_intraday')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', stockQuote.symbol)
            .maybeSingle();

        if (selectError) throw selectError;
        if (existing) {
            throw new Error(`You already have an active intraday position for ${stockQuote.symbol}. Close it first using /portfolio close.`);
        }

        // Calculate leveraged shares
        const price = stockQuote.price;
        const buyingPower = margin * leverage;
        const shares = buyingPower / price;

        // Deduct margin from wallet
        const newBalance = await this.updateCoins(guildId, userId, -margin);

        // Insert into user_intraday
        const { error: insertError } = await supabase
            .from('user_intraday')
            .insert([{
                guild_id: guildId,
                user_id: userId,
                symbol: stockQuote.symbol,
                market: stockQuote.market,
                type: type,
                shares: shares,
                entry_price: price,
                leverage: leverage,
                created_at: new Date()
            }]);

        if (insertError) {
            // Refund margin in case of db insert error
            await this.updateCoins(guildId, userId, margin);
            throw insertError;
        }

        return {
            success: true,
            symbol: stockQuote.symbol,
            type,
            margin,
            leverage,
            entryPrice: price,
            shares,
            currency: stockQuote.currency,
            newBalance
        };
    },

    async closeIntradayPosition(guildId, userId, symbol) {
        if (!supabase) throw new Error('Database not connected.');

        const stockQuote = this.getStockPrice(symbol);
        if (!stockQuote) throw new Error('Invalid stock symbol.');

        const { data: pos, error: selectError } = await supabase
            .from('user_intraday')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', stockQuote.symbol)
            .maybeSingle();

        if (selectError) throw selectError;
        if (!pos) {
            throw new Error(`You do not have an active intraday position for ${stockQuote.symbol}.`);
        }

        const exitPrice = stockQuote.price;
        const entryPrice = pos.entry_price;
        const shares = pos.shares;
        const margin = pos.shares * entryPrice / pos.leverage;

        let pnl = 0;
        if (pos.type === 'LONG') {
            pnl = shares * (exitPrice - entryPrice);
        } else {
            pnl = shares * (entryPrice - exitPrice);
        }

        const totalReturn = Math.max(0, margin + pnl);
        const finalReturn = Math.round(totalReturn);

        // Delete from user_intraday
        const { error: deleteError } = await supabase
            .from('user_intraday')
            .delete()
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('symbol', stockQuote.symbol);

        if (deleteError) throw deleteError;

        // Add totalReturn to user's wallet
        const newBalance = await this.updateCoins(guildId, userId, finalReturn);

        return {
            success: true,
            symbol: stockQuote.symbol,
            type: pos.type,
            entryPrice,
            exitPrice,
            shares,
            margin,
            pnl,
            totalReturn,
            currency: stockQuote.currency,
            newBalance
        };
    },

    async getUserIntradayTotalValue(guildId, userId) {
        if (!supabase) return { totalValue: 0, totalMargin: 0, totalProfitLoss: 0, positions: [] };

        const { data, error } = await supabase
            .from('user_intraday')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) {
            console.error('[DB] getUserIntradayTotalValue error:', error.message);
            return { totalValue: 0, totalMargin: 0, totalProfitLoss: 0, positions: [] };
        }

        let totalValue = 0;
        let totalMargin = 0;
        const positions = [];

        for (const item of data) {
            const quote = this.getStockPrice(item.symbol);
            if (quote) {
                const entryPrice = item.entry_price;
                const exitPrice = quote.price;
                const shares = item.shares;
                const margin = shares * entryPrice / item.leverage;

                let pnl = 0;
                if (item.type === 'LONG') {
                    pnl = shares * (exitPrice - entryPrice);
                } else {
                    pnl = shares * (entryPrice - exitPrice);
                }

                const positionVal = Math.max(0, margin + pnl);
                totalValue += positionVal;
                totalMargin += margin;

                positions.push({
                    symbol: item.symbol,
                    market: item.market,
                    type: item.type,
                    shares: shares,
                    entryPrice: entryPrice,
                    currentPrice: exitPrice,
                    margin: margin,
                    leverage: item.leverage,
                    currentValue: positionVal,
                    pnl: pnl,
                    pnlPercent: margin > 0 ? (pnl / margin) * 100 : 0,
                    currency: quote.currency
                });
            }
        }

        return {
            totalValue,
            totalMargin,
            totalProfitLoss: totalValue - totalMargin,
            positions
        };
    },

    // ==========================================
    // 25. Farming System
    // ==========================================

    async getUserCrops(guildId, userId) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const crops = memoryCrops.get(key) || [];
            return crops.map(crop => ({
                id: crop.id,
                guild_id: crop.guild_id,
                user_id: crop.user_id,
                crop_name: crop.crop_name,
                planted_at: new Date(crop.planted_at),
                growth_time: crop.growth_time,
                last_watered: new Date(crop.last_watered),
                water_count: crop.water_count,
                harvest_ready: new Date(crop.harvest_ready),
                plot_index: crop.plot_index || 1,
                fertilizer: crop.fertilizer || null,
                pests: crop.pests || false
            }));
        }

        const { data, error } = await supabase
            .from('user_crops')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) {
            console.error('[DB] getUserCrops error:', error.message);
            return [];
        }

        return data.map(crop => ({
            id: crop.id,
            guild_id: crop.guild_id,
            user_id: crop.user_id,
            crop_name: crop.crop_name,
            planted_at: new Date(crop.planted_at),
            growth_time: crop.growth_time,
            last_watered: new Date(crop.last_watered),
            water_count: crop.water_count,
            harvest_ready: new Date(crop.harvest_ready),
            plot_index: crop.plot_index,
            fertilizer: crop.fertilizer,
            pests: crop.pests
        }));
    },

    async plantCrop(guildId, userId, cropName, growthTimeSec, plotIndex) {
        const harvestReady = new Date(Date.now() + growthTimeSec * 1000);

        if (!supabase) {
            const key = `${guildId}_${userId}`;
            if (!memoryCrops.has(key)) memoryCrops.set(key, []);
            const crops = memoryCrops.get(key);
            const newCrop = {
                id: Math.floor(Math.random() * 100000),
                guild_id: guildId,
                user_id: userId,
                crop_name: cropName,
                planted_at: new Date(),
                growth_time: growthTimeSec,
                last_watered: new Date(),
                water_count: 1,
                harvest_ready: harvestReady,
                plot_index: plotIndex,
                fertilizer: null,
                pests: false
            };
            crops.push(newCrop);
            return { success: true, crop: newCrop };
        }

        const { data, error } = await supabase
            .from('user_crops')
            .insert([{
                guild_id: guildId,
                user_id: userId,
                crop_name: cropName,
                growth_time: growthTimeSec,
                planted_at: new Date().toISOString(),
                last_watered: new Date().toISOString(),
                water_count: 1,
                harvest_ready: harvestReady.toISOString(),
                plot_index: plotIndex,
                fertilizer: null,
                pests: false
            }])
            .select()
            .single();

        if (error) {
            console.error('[DB] plantCrop error:', error.message);
            return { success: false, reason: error.message };
        }

        return { success: true, crop: data };
    },

    async waterCrop(guildId, userId, cropId) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const crops = memoryCrops.get(key) || [];
            const crop = crops.find(c => c.id == cropId);
            if (!crop) return { success: false, reason: 'Crop not found' };
            if (crop.water_count >= 3) return { success: false, reason: 'Already watered 3 times!' };

            crop.water_count += 1;
            crop.last_watered = new Date();
            // Reduce remaining time by 25% of total growth time
            const reductionMs = crop.growth_time * 0.25 * 1000;
            crop.harvest_ready = new Date(crop.harvest_ready.getTime() - reductionMs);

            // 15% chance to attract pests on watering if not already infested
            if (!crop.pests && Math.random() < 0.15) {
                crop.pests = true;
            }

            return { success: true, crop };
        }

        // Fetch crop first to check water count
        const { data: crop, error: getError } = await supabase
            .from('user_crops')
            .select('*')
            .eq('id', cropId)
            .single();

        if (getError || !crop) {
            return { success: false, reason: 'Crop not found' };
        }

        if (crop.water_count >= 3) {
            return { success: false, reason: 'Already watered 3 times!' };
        }

        const newWaterCount = crop.water_count + 1;
        const currentHarvestReady = new Date(crop.harvest_ready);
        const reductionMs = crop.growth_time * 0.25 * 1000;
        const newHarvestReady = new Date(currentHarvestReady.getTime() - reductionMs);

        // 15% chance to attract pests on watering if not already infested
        let newPests = crop.pests;
        if (!crop.pests && Math.random() < 0.15) {
            newPests = true;
        }

        const { data, error } = await supabase
            .from('user_crops')
            .update({
                water_count: newWaterCount,
                last_watered: new Date().toISOString(),
                harvest_ready: newHarvestReady.toISOString(),
                pests: newPests
            })
            .eq('id', cropId)
            .select()
            .single();

        if (error) {
            console.error('[DB] waterCrop error:', error.message);
            return { success: false, reason: error.message };
        }

        return { success: true, crop: data };
    },

    async fertilizeCrop(guildId, userId, cropId, fertilizerType) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const crops = memoryCrops.get(key) || [];
            const crop = crops.find(c => c.id == cropId);
            if (!crop) return { success: false, reason: 'Crop not found' };
            if (crop.fertilizer) return { success: false, reason: 'This crop is already fertilized!' };

            crop.fertilizer = fertilizerType;
            if (fertilizerType === 'basic') {
                const now = Date.now();
                const remaining = Math.max(0, crop.harvest_ready.getTime() - now);
                crop.harvest_ready = new Date(now + remaining * 0.5);
            } else if (fertilizerType === 'growth') {
                crop.harvest_ready = new Date(Date.now() + 1000);
            }
            return { success: true, crop };
        }

        const { data: crop, error: getError } = await supabase
            .from('user_crops')
            .select('*')
            .eq('id', cropId)
            .single();

        if (getError || !crop) {
            return { success: false, reason: 'Crop not found' };
        }

        if (crop.fertilizer) {
            return { success: false, reason: 'This crop is already fertilized!' };
        }

        let newHarvestReady = new Date(crop.harvest_ready);
        if (fertilizerType === 'basic') {
            const now = Date.now();
            const remaining = Math.max(0, newHarvestReady.getTime() - now);
            newHarvestReady = new Date(now + remaining * 0.5);
        } else if (fertilizerType === 'growth') {
            newHarvestReady = new Date(Date.now() + 1000);
        }

        const { data, error } = await supabase
            .from('user_crops')
            .update({
                fertilizer: fertilizerType,
                harvest_ready: newHarvestReady.toISOString()
            })
            .eq('id', cropId)
            .select()
            .single();

        if (error) {
            console.error('[DB] fertilizeCrop error:', error.message);
            return { success: false, reason: error.message };
        }

        return { success: true, crop: data };
    },

    async treatCropPests(guildId, userId, cropId) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const crops = memoryCrops.get(key) || [];
            const crop = crops.find(c => c.id == cropId);
            if (!crop) return { success: false, reason: 'Crop not found' };
            if (!crop.pests) return { success: false, reason: 'This crop does not have a pest infection.' };

            crop.pests = false;
            return { success: true, crop };
        }

        const { data, error } = await supabase
            .from('user_crops')
            .update({ pests: false })
            .eq('id', cropId)
            .select()
            .single();

        if (error) {
            console.error('[DB] treatCropPests error:', error.message);
            return { success: false, reason: error.message };
        }

        return { success: true, crop: data };
    },

    async harvestCrop(guildId, userId, cropId) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const crops = memoryCrops.get(key) || [];
            const index = crops.findIndex(c => c.id == cropId);
            if (index === -1) return false;
            crops.splice(index, 1);
            return true;
        }

        const { error } = await supabase
            .from('user_crops')
            .delete()
            .eq('id', cropId)
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        if (error) {
            console.error('[DB] harvestCrop error:', error.message);
            return false;
        }

        return true;
    },

    async getFarmingProfile(guildId, userId) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            if (!memoryFarmingStats.has(key)) {
                memoryFarmingStats.set(key, { level: 1, xp: 0, max_plots: 3 });
            }
            return memoryFarmingStats.get(key);
        }

        const { data, error } = await supabase
            .from('user_farming_stats')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();

        if (!error && data) {
            return {
                level: data.level,
                xp: data.xp,
                max_plots: data.max_plots
            };
        }

        const defaultProfile = {
            guild_id: guildId,
            user_id: userId,
            level: 1,
            xp: 0,
            max_plots: 3
        };

        const { data: inserted } = await supabase
            .from('user_farming_stats')
            .insert([defaultProfile])
            .select()
            .single();

        return inserted ? {
            level: inserted.level,
            xp: inserted.xp,
            max_plots: inserted.max_plots
        } : defaultProfile;
    },

    async addFarmingXp(guildId, userId, amount) {
        const profile = await this.getFarmingProfile(guildId, userId);
        let newXp = profile.xp + amount;
        let newLevel = profile.level;
        let levelUp = false;

        const xpNeeded = newLevel * 1000;
        if (newXp >= xpNeeded) {
            newXp -= xpNeeded;
            newLevel += 1;
            levelUp = true;
        }

        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const stats = memoryFarmingStats.get(key) || { max_plots: 3 };
            stats.level = newLevel;
            stats.xp = newXp;
            memoryFarmingStats.set(key, stats);
            return { levelUp, newLevel, newXp };
        }

        await supabase
            .from('user_farming_stats')
            .update({ xp: newXp, level: newLevel })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        return { levelUp, newLevel, newXp };
    },

    async expandFarmPlots(guildId, userId, cost) {
        const profile = await this.getFarmingProfile(guildId, userId);
        if (profile.max_plots >= 8) {
            return { success: false, reason: 'You have reached the maximum limit of **8 plots**!' };
        }

        const userProfile = await this.getProfile(guildId, userId);
        if (Number(userProfile.coins) < cost) {
            return { success: false, reason: `Insufficient coins. Upgrading costs ${EMOJIS.coin} **${cost.toLocaleString()}** coins.` };
        }

        await this.updateCoins(guildId, userId, -cost);
        const newMaxPlots = profile.max_plots + 1;

        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const stats = memoryFarmingStats.get(key) || { level: 1, xp: 0, max_plots: 3 };
            stats.max_plots = newMaxPlots;
            memoryFarmingStats.set(key, stats);
            return { success: true, newMaxPlots };
        }

        await supabase
            .from('user_farming_stats')
            .update({ max_plots: newMaxPlots })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

        return { success: true, newMaxPlots };
    },

    // ==========================================
    // 26. Crime Skill Stats
    // ==========================================

    async getCrimeProfile(guildId, userId) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            return memoryCrimeStats.get(key) || { level: 1, xp: 0 };
        }

        const { data, error } = await supabase
            .from('user_crime_stats')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) {
            return { level: 1, xp: 0 };
        }

        return { level: data.level, xp: data.xp };
    },

    async addCrimeXp(guildId, userId, amount) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            if (!memoryCrimeStats.has(key)) {
                memoryCrimeStats.set(key, { level: 1, xp: 0 });
            }
            const stats = memoryCrimeStats.get(key);
            stats.xp += amount;
            let currentLevel = stats.level;
            let xpNeeded = currentLevel * 500;
            let leveledUp = false;

            while (stats.xp >= xpNeeded) {
                stats.xp -= xpNeeded;
                stats.level += 1;
                currentLevel = stats.level;
                xpNeeded = currentLevel * 500;
                leveledUp = true;
            }

            return { success: true, levelUp: leveledUp, newLevel: stats.level, newXp: stats.xp };
        }

        const currentProfile = await this.getCrimeProfile(guildId, userId);
        let currentLevel = currentProfile.level;
        let newXp = currentProfile.xp + amount;
        let xpNeeded = currentLevel * 500;
        let leveledUp = false;

        while (newXp >= xpNeeded) {
            newXp -= xpNeeded;
            currentLevel += 1;
            xpNeeded = currentLevel * 500;
            leveledUp = true;
        }

        const { error } = await supabase
            .from('user_crime_stats')
            .upsert({
                guild_id: guildId,
                user_id: userId,
                xp: newXp,
                level: currentLevel
            }, { onConflict: 'guild_id,user_id' });

        if (error) {
            console.error('[DB] addCrimeXp error:', error.message);
            return { success: false };
        }

        return { success: true, levelUp: leveledUp, newLevel: currentLevel, newXp };
    },

    // ==========================================
    // 27. Daily Quest System
    // ==========================================

    async getUserQuests(guildId, userId) {
        const questPool = [
            { type: 'chop', target_item: 'Pine Log', amount: 3, rewardCoins: 300, rewardXp: 150 },
            { type: 'chop', target_item: 'Oak Log', amount: 2, rewardCoins: 400, rewardXp: 200 },
            { type: 'fish', target_item: 'Common Bass', amount: 2, rewardCoins: 300, rewardXp: 150 },
            { type: 'fish', target_item: 'Salmon', amount: 2, rewardCoins: 450, rewardXp: 220 },
            { type: 'mine', target_item: 'Coal', amount: 3, rewardCoins: 250, rewardXp: 120 },
            { type: 'mine', target_item: 'Iron Ore', amount: 2, rewardCoins: 400, rewardXp: 200 },
            { type: 'sell', target_item: null, amount: 5, rewardCoins: 300, rewardXp: 150 },
            { type: 'water', target_item: null, amount: 3, rewardCoins: 200, rewardXp: 100 },
            { type: 'crime', target_item: null, amount: 2, rewardCoins: 400, rewardXp: 200 },
            { type: 'hack', target_item: null, amount: 1, rewardCoins: 500, rewardXp: 250 }
        ];

        const generateDailyQuests = () => {
            const shuffled = [...questPool].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, 3).map((q, idx) => ({
                quest_index: idx,
                quest_type: q.type,
                target_item: q.target_item,
                target_amount: q.amount,
                current_amount: 0,
                reward_coins: q.rewardCoins,
                reward_xp: q.rewardXp,
                claimed: false,
                created_at: new Date()
            }));
        };

        if (!supabase) {
            const key = `${guildId}_${userId}`;
            let active = memoryQuests.get(key) || [];
            const isToday = active.length > 0 && new Date(active[0].created_at).toDateString() === new Date().toDateString();

            if (!isToday) {
                active = generateDailyQuests();
                memoryQuests.set(key, active);
            }
            return active;
        }

        const { data, error } = await supabase
            .from('user_quests')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .order('quest_index', { ascending: true });

        if (error) {
            console.error('[DB] getUserQuests error:', error.message);
            return [];
        }

        const isToday = data.length > 0 && new Date(data[0].created_at).toDateString() === new Date().toDateString();

        if (!isToday) {
            // Delete old ones
            await supabase
                .from('user_quests')
                .delete()
                .eq('guild_id', guildId)
                .eq('user_id', userId);

            const newQuests = generateDailyQuests();
            const { data: inserted, error: insertError } = await supabase
                .from('user_quests')
                .insert(newQuests.map(q => ({
                    guild_id: guildId,
                    user_id: userId,
                    quest_index: q.quest_index,
                    quest_type: q.quest_type,
                    target_item: q.target_item,
                    target_amount: q.target_amount,
                    current_amount: 0,
                    reward_coins: q.reward_coins,
                    reward_xp: q.reward_xp,
                    claimed: false,
                    created_at: q.created_at.toISOString()
                })))
                .select()
                .order('quest_index', { ascending: true });

            if (insertError) {
                console.error('[DB] insert quests error:', insertError.message);
                return newQuests;
            }

            return inserted.map(q => ({
                quest_index: q.quest_index,
                quest_type: q.quest_type,
                target_item: q.target_item,
                target_amount: q.target_amount,
                current_amount: q.current_amount,
                reward_coins: q.reward_coins,
                reward_xp: q.reward_xp,
                claimed: q.claimed,
                created_at: new Date(q.created_at)
            }));
        }

        return data.map(q => ({
            quest_index: q.quest_index,
            quest_type: q.quest_type,
            target_item: q.target_item,
            target_amount: q.target_amount,
            current_amount: q.current_amount,
            reward_coins: q.reward_coins,
            reward_xp: q.reward_xp,
            claimed: q.claimed,
            created_at: new Date(q.created_at)
        }));
    },

    async incrementQuestProgress(guildId, userId, questType, item = null, amount = 1) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const quests = memoryQuests.get(key) || [];
            quests.forEach(q => {
                const typeMatch = q.quest_type === questType;
                const itemMatch = !q.target_item || (item && q.target_item.toLowerCase() === item.toLowerCase());
                if (typeMatch && itemMatch && !q.claimed) {
                    q.current_amount = Math.min(q.target_amount, q.current_amount + amount);
                }
            });
            return true;
        }

        // Fetch active quests
        const activeQuests = await this.getUserQuests(guildId, userId);
        for (const q of activeQuests) {
            const typeMatch = q.quest_type === questType;
            const itemMatch = !q.target_item || (item && q.target_item.toLowerCase() === item.toLowerCase());

            if (typeMatch && itemMatch && !q.claimed && q.current_amount < q.target_amount) {
                const newAmount = Math.min(q.target_amount, q.current_amount + amount);
                await supabase
                    .from('user_quests')
                    .update({ current_amount: newAmount })
                    .eq('guild_id', guildId)
                    .eq('user_id', userId)
                    .eq('quest_index', q.quest_index);
            }
        }
        return true;
    },

    async claimQuestReward(guildId, userId, questIndex) {
        if (!supabase) {
            const key = `${guildId}_${userId}`;
            const quests = memoryQuests.get(key) || [];
            const quest = quests.find(q => q.quest_index === questIndex);

            if (!quest) return { success: false, reason: 'Quest not found.' };
            if (quest.claimed) return { success: false, reason: 'Quest already claimed.' };
            if (quest.current_amount < quest.target_amount) return { success: false, reason: 'Quest is not completed yet.' };

            quest.claimed = true;
            await this.updateCoins(guildId, userId, quest.reward_coins);
            await this.addXp(guildId, userId, quest.reward_xp);

            return { success: true, reward_coins: quest.reward_coins, reward_xp: quest.reward_xp };
        }

        const quests = await this.getUserQuests(guildId, userId);
        const quest = quests.find(q => q.quest_index === questIndex);

        if (!quest) return { success: false, reason: 'Quest not found.' };
        if (quest.claimed) return { success: false, reason: 'Quest already claimed.' };
        if (quest.current_amount < quest.target_amount) return { success: false, reason: 'Quest is not completed yet.' };

        const { error } = await supabase
            .from('user_quests')
            .update({ claimed: true })
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('quest_index', questIndex);

        if (error) {
            console.error('[DB] claimQuestReward error:', error.message);
            return { success: false, reason: 'Database error.' };
        }

        await this.updateCoins(guildId, userId, quest.reward_coins);
        await this.addXp(guildId, userId, quest.reward_xp);

        return { success: true, reward_coins: quest.reward_coins, reward_xp: quest.reward_xp };
    },

    // ==========================================
    // 28. Player-Driven Supply & Demand Market
    // ==========================================

    async getMarketPrices(guildId, sellCatalog) {
        let shouldTick = false;
        const now = Date.now();

        if (!supabase) {
            const lastTick = memoryMarketTicks.get(guildId) || now;
            if (lastTick === now || (now - lastTick > 3600000)) {
                shouldTick = true;
                memoryMarketTicks.set(guildId, now);
            }
        } else {
            const { data: tickData, error: tickError } = await supabase
                .from('market_ticks')
                .select('*')
                .eq('guild_id', guildId)
                .maybeSingle();

            if (tickError) {
                console.error('[DB] get market ticks error:', tickError.message);
            }

            if (!tickData) {
                await supabase.from('market_ticks').insert([{ guild_id: guildId, last_tick: new Date().toISOString() }]);
                shouldTick = true;
            } else {
                const elapsed = now - new Date(tickData.last_tick).getTime();
                if (elapsed > 3600000) {
                    shouldTick = true;
                    await supabase
                        .from('market_ticks')
                        .update({ last_tick: new Date().toISOString() })
                        .eq('guild_id', guildId);
                }
            }
        }

        if (shouldTick) {
            await this.tickMarket(guildId, sellCatalog);
        }

        // Return commodities map
        const pricesMap = {};
        if (!supabase) {
            for (const itemName in sellCatalog) {
                const basePrice = sellCatalog[itemName];
                const key = `${guildId}_${itemName}`;
                let comm = memoryCommodities.get(key);
                if (!comm) {
                    comm = { price: basePrice, eventText: null, lastUpdated: new Date() };
                    memoryCommodities.set(key, comm);
                }
                pricesMap[itemName] = comm;
            }
            return pricesMap;
        }

        const { data, error } = await supabase
            .from('market_commodities')
            .select('*')
            .eq('guild_id', guildId);

        if (error) {
            console.error('[DB] getMarketPrices error:', error.message);
            for (const itemName in sellCatalog) {
                pricesMap[itemName] = { price: sellCatalog[itemName], eventText: null };
            }
            return pricesMap;
        }

        // Merge defaults
        const dbMap = {};
        data.forEach(row => {
            dbMap[row.item_name.toLowerCase()] = { price: row.price, eventText: row.event_text };
        });

        const toInsert = [];
        for (const itemName in sellCatalog) {
            const lowerName = itemName.toLowerCase();
            if (dbMap[lowerName] !== undefined) {
                pricesMap[lowerName] = dbMap[lowerName];
            } else {
                const basePrice = sellCatalog[itemName];
                pricesMap[lowerName] = { price: basePrice, eventText: null };
                toInsert.push({ guild_id: guildId, item_name: lowerName, price: basePrice, event_text: null });
            }
        }

        if (toInsert.length > 0) {
            await supabase.from('market_commodities').insert(toInsert).catch(() => null);
        }

        return pricesMap;
    },

    async updateMarketPrice(guildId, itemName, basePrice, unitsSold) {
        const lowerName = itemName.toLowerCase();
        const decayPerUnit = Math.round(basePrice * 0.005); // 0.5% per unit sold
        const minPrice = Math.round(basePrice * 0.3); // Minimum 30% of base price

        if (!supabase) {
            const key = `${guildId}_${lowerName}`;
            let comm = memoryCommodities.get(key);
            if (!comm) {
                comm = { price: basePrice, eventText: null, lastUpdated: new Date() };
            }
            comm.price = Math.max(minPrice, comm.price - (decayPerUnit * unitsSold));
            comm.lastUpdated = new Date();
            memoryCommodities.set(key, comm);
            return true;
        }

        // Fetch current price
        const { data, error: fetchError } = await supabase
            .from('market_commodities')
            .select('price')
            .eq('guild_id', guildId)
            .eq('item_name', lowerName)
            .maybeSingle();

        if (fetchError || !data) return false;

        const newPrice = Math.max(minPrice, Number(data.price) - (decayPerUnit * unitsSold));

        await supabase
            .from('market_commodities')
            .update({ price: newPrice, last_updated: new Date().toISOString() })
            .eq('guild_id', guildId)
            .eq('item_name', lowerName);

        return true;
    },

    async tickMarket(guildId, sellCatalog) {
        // Adjust prices hourly
        const marketEvents = [
            { text: '📈 Shortage: High local demand spikes prices by 50%!', multiplier: 1.5, type: 'up' },
            { text: '📉 Glut: Overflowing warehouses crash prices by 50%!', multiplier: 0.5, type: 'down' }
        ];

        // Random roll for a global event (10% chance)
        const triggerEvent = Math.random() < 0.10;
        let eventItem = null;
        let chosenEvent = null;
        if (triggerEvent) {
            const items = Object.keys(sellCatalog);
            eventItem = items[Math.floor(Math.random() * items.length)].toLowerCase();
            chosenEvent = marketEvents[Math.floor(Math.random() * marketEvents.length)];
        }

        if (!supabase) {
            for (const itemName in sellCatalog) {
                const lowerName = itemName.toLowerCase();
                const basePrice = sellCatalog[itemName];
                const key = `${guildId}_${lowerName}`;
                let comm = memoryCommodities.get(key);
                if (!comm) {
                    comm = { price: basePrice, eventText: null, lastUpdated: new Date() };
                }

                if (lowerName === eventItem) {
                    comm.price = Math.round(basePrice * chosenEvent.multiplier);
                    comm.eventText = chosenEvent.text;
                } else {
                    comm.eventText = null;
                    if (comm.price < basePrice) {
                        // Recover price by 10% base price
                        comm.price = Math.min(basePrice, comm.price + Math.round(basePrice * 0.10));
                    } else if (comm.price > basePrice) {
                        // Cool down prices above base price
                        comm.price = Math.max(basePrice, comm.price - Math.round(basePrice * 0.10));
                    } else {
                        // Fluctuate randomly by +/- 5%
                        const fluctuate = Math.random() < 0.5 ? 1 : -1;
                        const amt = Math.round(basePrice * 0.05 * Math.random());
                        comm.price = Math.max(Math.round(basePrice * 0.3), basePrice + (fluctuate * amt));
                    }
                }
                comm.lastUpdated = new Date();
                memoryCommodities.set(key, comm);
            }
            return true;
        }

        // Supabase tick execution
        for (const itemName in sellCatalog) {
            const lowerName = itemName.toLowerCase();
            const basePrice = sellCatalog[itemName];

            const { data, error } = await supabase
                .from('market_commodities')
                .select('*')
                .eq('guild_id', guildId)
                .eq('item_name', lowerName)
                .maybeSingle();

            let price = basePrice;
            let eventText = null;

            if (data) {
                price = Number(data.price);
            }

            if (lowerName === eventItem) {
                price = Math.round(basePrice * chosenEvent.multiplier);
                eventText = chosenEvent.text;
            } else {
                if (price < basePrice) {
                    price = Math.min(basePrice, price + Math.round(basePrice * 0.10));
                } else if (price > basePrice) {
                    price = Math.max(basePrice, price - Math.round(basePrice * 0.10));
                } else {
                    const fluctuate = Math.random() < 0.5 ? 1 : -1;
                    const amt = Math.round(basePrice * 0.05 * Math.random());
                    price = Math.max(Math.round(basePrice * 0.3), basePrice + (fluctuate * amt));
                }
            }

            await supabase
                .from('market_commodities')
                .upsert({
                    guild_id: guildId,
                    item_name: lowerName,
                    price: price,
                    event_text: eventText,
                    last_updated: new Date().toISOString()
                }, { onConflict: 'guild_id,item_name' });
        }
        return true;
    },

    // ==========================================
    // 29. Advanced Lottery System
    // ==========================================

    async getLotteryState(guildId, userId) {
        let config = null;
        let drawResult = null;
        const now = Date.now();

        if (!supabase) {
            config = memoryLotteryConfig.get(guildId);
            if (!config) {
                config = { ticketCost: 100, jackpot: 1000, lastDraw: new Date() };
                memoryLotteryConfig.set(guildId, config);
            }

            const elapsed = now - new Date(config.lastDraw).getTime();
            if (elapsed > 86400000) {
                drawResult = await this.drawLottery(guildId);
                // Refresh config
                config = memoryLotteryConfig.get(guildId);
            }
        } else {
            const { data, error } = await supabase
                .from('lottery_config')
                .select('*')
                .eq('guild_id', guildId)
                .maybeSingle();

            if (error) console.error('[DB] getLotteryState error:', error.message);

            if (!data) {
                const newConfig = { guild_id: guildId, ticket_cost: 100, jackpot: 1000, last_draw: new Date().toISOString() };
                await supabase.from('lottery_config').insert([newConfig]);
                config = { ticketCost: 100, jackpot: 1000, lastDraw: new Date() };
            } else {
                config = {
                    ticketCost: data.ticket_cost,
                    jackpot: Number(data.jackpot),
                    lastDraw: new Date(data.last_draw)
                };

                const elapsed = now - config.lastDraw.getTime();
                if (elapsed > 86400000) {
                    drawResult = await this.drawLottery(guildId);
                    // Refresh config
                    const { data: refData } = await supabase
                        .from('lottery_config')
                        .select('*')
                        .eq('guild_id', guildId)
                        .single();
                    config = {
                        ticketCost: refData.ticket_cost,
                        jackpot: Number(refData.jackpot),
                        lastDraw: new Date(refData.last_draw)
                    };
                }
            }
        }

        // Fetch User and Server Tickets counts
        let userTickets = 0;
        let totalTickets = 0;

        if (!supabase) {
            const prefix = `${guildId}_`;
            for (const [key, count] of memoryLotteryTickets) {
                if (key.startsWith(prefix)) {
                    totalTickets += count;
                    if (key === `${guildId}_${userId}`) {
                        userTickets = count;
                    }
                }
            }
        } else {
            const { data: tickets, error: ticketError } = await supabase
                .from('lottery_tickets')
                .select('*')
                .eq('guild_id', guildId);

            if (!ticketError && tickets) {
                tickets.forEach(t => {
                    totalTickets += t.ticket_count;
                    if (t.user_id === userId) {
                        userTickets = t.ticket_count;
                    }
                });
            }
        }

        // Fetch Last Winner
        let lastWinner = null;
        if (!supabase) {
            const history = memoryLotteryHistory.get(guildId) || [];
            if (history.length > 0) {
                lastWinner = history[history.length - 1];
            }
        } else {
            const { data: winHistory, error: winError } = await supabase
                .from('lottery_history')
                .select('*')
                .eq('guild_id', guildId)
                .order('draw_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!winError && winHistory) {
                lastWinner = {
                    winnerId: winHistory.winner_id,
                    jackpotWon: Number(winHistory.jackpot_won),
                    drawDate: new Date(winHistory.draw_date)
                };
            }
        }

        return {
            config,
            userTickets,
            totalTickets,
            lastWinner,
            drawResult
        };
    },

    async buyLotteryTickets(guildId, userId, amount) {
        const state = await this.getLotteryState(guildId, userId);
        const cost = amount * state.config.ticketCost;

        const profile = await this.getProfile(guildId, userId);
        if (Number(profile.coins) < cost) {
            return { success: false, reason: 'Insufficient coins in wallet.' };
        }

        // Deduct coins
        await this.updateCoins(guildId, userId, -cost);
        const newJackpot = state.config.jackpot + cost;

        if (!supabase) {
            // Update jackpot in config
            const config = memoryLotteryConfig.get(guildId);
            config.jackpot = newJackpot;
            memoryLotteryConfig.set(guildId, config);

            // Increment user tickets
            const ticketKey = `${guildId}_${userId}`;
            const currentTickets = memoryLotteryTickets.get(ticketKey) || 0;
            memoryLotteryTickets.set(ticketKey, currentTickets + amount);

            return { success: true, ticketsBought: amount, costPaid: cost, newJackpot };
        }

        // Supabase database update
        // Update jackpot pool
        await supabase
            .from('lottery_config')
            .update({ jackpot: newJackpot })
            .eq('guild_id', guildId);

        // Fetch or create ticket record
        const { data: ticketRecord } = await supabase
            .from('lottery_tickets')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();

        if (ticketRecord) {
            await supabase
                .from('lottery_tickets')
                .update({ ticket_count: ticketRecord.ticket_count + amount })
                .eq('id', ticketRecord.id);
        } else {
            await supabase
                .from('lottery_tickets')
                .insert([{ guild_id: guildId, user_id: userId, ticket_count: amount }]);
        }

        return { success: true, ticketsBought: amount, costPaid: cost, newJackpot };
    },

    async drawLottery(guildId) {
        let tickets = [];
        let currentJackpot = 1000;

        if (!supabase) {
            const config = memoryLotteryConfig.get(guildId) || { ticketCost: 100, jackpot: 1000 };
            currentJackpot = config.jackpot;

            const prefix = `${guildId}_`;
            for (const [key, count] of memoryLotteryTickets) {
                if (key.startsWith(prefix)) {
                    const userId = key.replace(prefix, '');
                    tickets.push({ user_id: userId, ticket_count: count });
                }
            }
        } else {
            const [configRes, ticketsRes] = await Promise.all([
                supabase.from('lottery_config').select('jackpot').eq('guild_id', guildId).single(),
                supabase.from('lottery_tickets').select('*').eq('guild_id', guildId)
            ]);

            if (configRes.data) currentJackpot = Number(configRes.data.jackpot);
            tickets = ticketsRes.data || [];
        }

        if (tickets.length === 0) {
            // Rollover jackpot
            if (!supabase) {
                const config = memoryLotteryConfig.get(guildId);
                config.lastDraw = new Date();
                memoryLotteryConfig.set(guildId, config);
            } else {
                await supabase
                    .from('lottery_config')
                    .update({ last_draw: new Date().toISOString() })
                    .eq('guild_id', guildId);
            }
            return { winnerId: null, jackpotWon: currentJackpot, rolledOver: true };
        }

        // Weighted draw pool
        const drawPool = [];
        tickets.forEach(t => {
            for (let i = 0; i < t.ticket_count; i++) {
                drawPool.push(t.user_id);
            }
        });

        const winnerId = drawPool[Math.floor(Math.random() * drawPool.length)];

        // Pay winner
        await this.updateCoins(guildId, winnerId, currentJackpot);

        if (!supabase) {
            // Reset config
            memoryLotteryConfig.set(guildId, {
                ticketCost: 100,
                jackpot: 1000,
                lastDraw: new Date()
            });

            // Clear tickets
            const prefix = `${guildId}_`;
            for (const key of memoryLotteryTickets.keys()) {
                if (key.startsWith(prefix)) {
                    memoryLotteryTickets.delete(key);
                }
            }

            // Log history
            const history = memoryLotteryHistory.get(guildId) || [];
            history.push({ winnerId, jackpotWon: currentJackpot, drawDate: new Date() });
            memoryLotteryHistory.set(guildId, history);
        } else {
            // Reset config & update date
            await supabase
                .from('lottery_config')
                .update({ jackpot: 1000, last_draw: new Date().toISOString() })
                .eq('guild_id', guildId);

            // Log history
            await supabase
                .from('lottery_history')
                .insert([{ guild_id: guildId, winner_id: winnerId, jackpot_won: currentJackpot }]);

            // Delete active tickets
            await supabase
                .from('lottery_tickets')
                .delete()
                .eq('guild_id', guildId);
        }

        return { winnerId, jackpotWon: currentJackpot, rolledOver: false };
    }
};
