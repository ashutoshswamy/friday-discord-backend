const { createClient } = require('@supabase/supabase-js');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// ponytail: in-memory fallback for when supabase is not configured
const memMap = new Map();

async function checkCooldown(commandName, userId, seconds) {
    const now = Date.now();
    const expiresAt = now + seconds * 1000;

    if (supabase) {
        const { data } = await supabase
            .from('command_cooldowns')
            .select('expires_at')
            .eq('user_id', userId)
            .eq('command', commandName)
            .maybeSingle();

        if (data && data.expires_at > now) {
            const remaining = ((data.expires_at - now) / 1000).toFixed(1);
            return { onCooldown: true, remaining };
        }

        await supabase.from('command_cooldowns').upsert(
            { user_id: userId, command: commandName, expires_at: expiresAt },
            { onConflict: 'user_id,command' }
        );
        return { onCooldown: false };
    }

    const key = `${commandName}:${userId}`;
    const expiry = memMap.get(key);
    if (expiry && now < expiry) {
        return { onCooldown: true, remaining: ((expiry - now) / 1000).toFixed(1) };
    }
    memMap.set(key, expiresAt);
    return { onCooldown: false };
}

async function getCooldownRemaining(commandName, userId) {
    const now = Date.now();

    if (supabase) {
        const { data } = await supabase
            .from('command_cooldowns')
            .select('expires_at')
            .eq('user_id', userId)
            .eq('command', commandName)
            .maybeSingle();

        return data ? Math.max(0, data.expires_at - now) : 0;
    }

    const key = `${commandName}:${userId}`;
    const expiry = memMap.get(key);
    return expiry ? Math.max(0, expiry - now) : 0;
}

module.exports = { checkCooldown, getCooldownRemaining };
