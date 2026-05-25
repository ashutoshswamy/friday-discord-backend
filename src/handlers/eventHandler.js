const fs = require('fs');
const path = require('path');

/**
 * Dynamically loads and registers all events from the events directory.
 * @param {import('discord.js').Client} client 
 */
module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');

    // If the directory doesn't exist, create it
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
    }

    const eventFolders = fs.readdirSync(eventsPath);
    let eventCount = 0;

    for (const folder of eventFolders) {
        const folderPath = path.join(eventsPath, folder);

        // Ensure we are reading a directory
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const eventFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(folderPath, file);
            const event = require(filePath);

            // Make sure the event structure is valid
            if (!event.name || typeof event.execute !== 'function') {
                console.warn(`[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
                continue;
            }

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            eventCount++;
        }
    }

    console.log(`Successfully loaded ${eventCount} event listener(s).`);
};
