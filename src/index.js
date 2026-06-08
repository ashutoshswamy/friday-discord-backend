require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');

// Create a new client instance
// GatewayIntentBits.Guilds is required for basic bot functionality and slash commands
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// A Collection is a utility class that extends JavaScript's Map, holding our commands
client.commands = new Collection();
client.messageAuditLog = new Map(); // Map<guildId, entry[]>
client.voiceAuditLog = new Map();   // Map<guildId, entry[]>

// Load event and command handlers
console.log('Initializing bot handlers...');
require('./handlers/commandHandler')(client);
require('./handlers/eventHandler')(client);

// Set up in-memory audit log listeners
function pushAuditEntry(map, guildId, entry, limit = 100) {
    if (!map.has(guildId)) map.set(guildId, []);
    const entries = map.get(guildId);
    entries.unshift(entry);
    if (entries.length > limit) entries.pop();
}

client.on('messageDelete', message => {
    if (!message.guild || message.author?.bot) return;
    pushAuditEntry(client.messageAuditLog, message.guild.id, {
        guildId: message.guild.id,
        userId: message.author.id,
        userTag: message.author.tag,
        type: 'DELETE',
        content: message.content || '[No Text Content]',
        channelName: message.channel.name,
        timestamp: Date.now()
    });
});

client.on('messageUpdate', (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    pushAuditEntry(client.messageAuditLog, oldMessage.guild.id, {
        guildId: oldMessage.guild.id,
        userId: oldMessage.author.id,
        userTag: oldMessage.author.tag,
        type: 'EDIT',
        oldContent: oldMessage.content || '[No Text Content]',
        newContent: newMessage.content || '[No Text Content]',
        channelName: oldMessage.channel.name,
        timestamp: Date.now()
    });
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (!oldState.guild || oldState.member.user.bot) return;
    let action = '';
    let details = '';
    
    if (!oldState.channelId && newState.channelId) {
        action = 'JOIN';
        details = `Joined channel **#${newState.channel.name}**`;
    } else if (oldState.channelId && !newState.channelId) {
        action = 'LEAVE';
        details = `Left channel **#${oldState.channel.name}**`;
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        action = 'MOVE';
        details = `Moved from **#${oldState.channel.name}** to **#${newState.channel.name}**`;
    } else {
        if (!oldState.selfMute && newState.selfMute) {
            action = 'MUTE';
            details = 'Self-muted';
        } else if (oldState.selfMute && !newState.selfMute) {
            action = 'UNMUTE';
            details = 'Self-unmuted';
        } else return;
    }
    
    pushAuditEntry(client.voiceAuditLog, oldState.guild.id, {
        guildId: oldState.guild.id,
        userId: oldState.member.id,
        userTag: oldState.member.user.tag,
        action,
        details,
        timestamp: Date.now()
    });
});

// Register error event listener on client to prevent EventEmitter crashes
client.on('error', error => {
    console.error('[DISCORD CLIENT ERROR] Unhandled client connection or interaction event error:', error);
});

// Register global safety catchers for unhandled promise rejections and uncaught process exceptions
process.on('unhandledRejection', error => {
    console.error('[UNHANDLED REJECTION]', error);
    process.exit(1);
});

process.on('uncaughtException', error => {
    console.error('[UNCAUGHT EXCEPTION]', error);
    process.exit(1);
});

function gracefulShutdown(signal) {
    console.log(`[SHUTDOWN] ${signal} received — closing gracefully`);
    client.destroy();
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Log in to Discord with your client's token
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_bot_token_here') {
    console.error('[ERROR] Please set your actual DISCORD_TOKEN in the .env file!');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN)
    .catch(err => {
        console.error('[ERROR] Failed to log in to Discord. Check if your bot token is correct in the .env file.');
        console.error(err);
    });
