const fs = require('fs');
const path = require('path');

/**
 * Dynamically loads all commands from the commands directory.
 * @param {import('discord.js').Client} client 
 */
module.exports = (client) => {
    const commandsPath = path.join(__dirname, '../commands');
    
    // If the directory doesn't exist, create it
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath, { recursive: true });
    }

    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        // Ensure we are reading a directory
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            // Discord.js v14 slash commands require 'data' (SlashCommandBuilder) and 'execute' (function)
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
    
    console.log(`Successfully loaded ${client.commands.size} slash command(s).`);
};
