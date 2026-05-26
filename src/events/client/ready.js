const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    
    /**
     * Executes when the client is ready.
     * @param {import('discord.js').Client} client 
     */
    execute(client) {
        console.log(`[SUCCESS] Bot is online! Logged in as ${client.user.tag}`);
        
        // Optional: Set a custom status/activity for your bot
        if (client.user) {
            client.user.setActivity({
                name: 'with code',
                type: 0 // ActivityType.Playing
            });
        }

        // Start Dashboard API server
        try {
            require('../../server')(client);
        } catch (err) {
            console.error('[ERROR] Failed to start Dashboard API Server:', err);
        }

        // Start YouTube / Twitch alert pollers
        try {
            require('../../utils/alertPoller').startAlertPoller(client);
        } catch (err) {
            console.error('[ERROR] Failed to start alert poller:', err);
        }
    },
};
