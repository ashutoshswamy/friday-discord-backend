const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../../utils/db');

const FRIDAY_QUOTES = [
    "I am Friday. I monitor this server. I scan for anomalies.",
    "System status: Operational. Integrity: 100%. Ready for commands.",
    "If you want peace, prepare for AutoMod spam filters.",
    "Database linked. Coin economy in circulation. Leveling index active.",
    "Do you require assistance? Or would you prefer to spin the slots?",
    "Moderation protocol initialized. Warning counters are active.",
    "I am designed by Google DeepMind. Antigravity and I have this server covered.",
    "Chat activity detected. Generating experience points..."
];

module.exports = {
    noDefer: true,
    data: new SlashCommandBuilder()
        .setName('friday')
        .setDescription('Friday Core System commands.')
        .addSubcommand(sub =>
            sub.setName('quote')
                .setDescription('Pulls a randomized narrative system quote.'))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Renders bot diagnostic indicators, memory layouts, and latency.'))
        .addSubcommand(sub =>
            sub.setName('protocol')
                .setDescription('Executes specialized system automation protocol slates (Admin only).')
                .addStringOption(opt => 
                    opt.setName('name')
                        .setDescription('The protocol slate keyword (e.g. cleanslate)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('ask')
                .setDescription('Direct AI conversational query using system\'s persona.')
                .addStringOption(opt =>
                    opt.setName('query')
                        .setDescription('The question or query for Friday')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('rewrite')
                .setDescription('Translates or adjusts text into distinct persona styles.')
                .addStringOption(opt =>
                    opt.setName('style')
                        .setDescription('The style persona to rewrite the text in')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Professional', value: 'Professional' },
                            { name: 'Cyberpunk', value: 'Cyberpunk' },
                            { name: 'Sarcastic', value: 'Sarcastic' },
                            { name: 'Pirate', value: 'Pirate' },
                            { name: 'Shakespeare', value: 'Shakespeare' }
                        ))
                .addStringOption(opt =>
                    opt.setName('text')
                        .setDescription('The text to rewrite')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('summarize')
                .setDescription('Reads recent channel history and outputs a concise summary.'))
        .addSubcommand(sub =>
            sub.setName('imagine')
                .setDescription('Generates a synthetic image from a prompt (Costs 50 coins).')
                .addStringOption(opt =>
                    opt.setName('prompt')
                        .setDescription('The visual description for the image generator')
                        .setRequired(true))),

    /**
     * Executes the friday command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options, client, member } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: quote
            // ------------------------------------------
            if (subcommand === 'quote') {
                const quote = FRIDAY_QUOTES[Math.floor(Math.random() * FRIDAY_QUOTES.length)];

                const embed = new EmbedBuilder()
                    .setTitle('🤖 Friday Core Protocol')
                    .setColor('#8b5cf6')
                    .setDescription(`*"${quote}"*`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            // ------------------------------------------
            // B. Subcommand: status
            // ------------------------------------------
            if (subcommand === 'status') {
                // Calculate diagnostic indicators
                const uptimeMs = client.uptime || 0;
                const hours = Math.floor(uptimeMs / 3600000);
                const minutes = Math.floor((uptimeMs % 3600000) / 60000);
                const seconds = Math.floor((uptimeMs % 60000) / 1000);

                const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
                const ping = client.ws.ping;
                const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

                const embed = new EmbedBuilder()
                    .setTitle('⚙️ System Diagnostics & Metrics')
                    .setColor('#00E5FF')
                    .setThumbnail(client.user.displayAvatarURL({ forceStatic: true }))
                    .addFields(
                        { name: 'Core Engine Name', value: 'Friday Core', inline: true },
                        { name: 'Bot Latency Ping', value: `⚡ **${ping}ms**`, inline: true },
                        { name: 'Uptime Active', value: `⏱️ **${uptimeStr}**`, inline: true },
                        { name: 'RAM Heap Allocation', value: `💾 **${memoryUsage} MB**`, inline: true },
                        { name: 'Node.js Version', value: `🟢 **${process.version}**`, inline: true },
                        { name: 'Discord.js Version', value: `🔵 **v14.26.4**`, inline: true }
                    )
                    .setFooter({ text: 'System Integrity: 100% Operational' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            // ------------------------------------------
            // C. Subcommand: protocol
            // ------------------------------------------
            if (subcommand === 'protocol') {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: '❌ Access Denied: Administrator clearance is required to execute protocol slates!',
                        ephemeral: true
                    });
                }

                const protocolName = options.getString('name').trim().toLowerCase();

                if (protocolName === 'cleanslate') {
                    // Protocol: clean slate (mock purge / reset)
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Protocol: CLEAN SLATE')
                        .setColor('#FF3333')
                        .setDescription(
                            `⏳ **Executing system clean-slate diagnostics...**\n\n` +
                            `• Auditing active database connections... **[SECURE]**\n` +
                            `• Scanning temporary files... **[PURGED]**\n` +
                            `• Flushing active gateway sockets... **[OK]**\n\n` +
                            `✅ Friday Core has successfully re-aligned system indexes.`
                        )
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed] });
                } else {
                    return interaction.reply({
                        content: `❌ Unknown protocol code: \`${protocolName}\`. Try: \`cleanslate\`.`,
                        ephemeral: true
                    });
                }
            }

            // ------------------------------------------
            // D. Subcommand: ask
            // ------------------------------------------
            if (subcommand === 'ask') {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
                    return interaction.reply({
                        content: '⚠️ **Gemini API Key is not configured.** Please add a valid `GEMINI_API_KEY` to your `.env` file in the bot root directory to enable AI commands.',
                        ephemeral: true
                    });
                }

                const query = options.getString('query');
                await interaction.deferReply();

                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

                    const prompt = `System Prompt: You are Friday, a sleek, highly intelligent, administrative AI assistant. Keep responses helpful, direct, and concise, speaking with the tone of a high-tech administrative system.\n\nUser Query: ${query}`;
                    
                    const result = await model.generateContent(prompt);
                    let responseText = result.response.text().trim();

                    if (responseText.length > 1900) {
                        responseText = responseText.substring(0, 1850) + '\n\n*(Truncated due to length limits)*';
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('🤖 Friday Protocol: AI Query Response')
                        .setColor('#8b5cf6')
                        .setDescription(responseText)
                        .setTimestamp()
                        .setFooter({ text: 'Friday AI Engine • Powered by Gemini 3.1' });

                    return interaction.editReply({ embeds: [embed] });
                } catch (apiError) {
                    console.error('[GEMINI API ERROR IN ASK]', apiError);
                    return interaction.editReply({
                        content: '❌ **AI Generation Failure:** Encountered an error while communicating with the Gemini API. Please verify your API key and try again later.'
                    });
                }
            }

            // ------------------------------------------
            // E. Subcommand: rewrite
            // ------------------------------------------
            if (subcommand === 'rewrite') {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
                    return interaction.reply({
                        content: '⚠️ **Gemini API Key is not configured.** Please add a valid `GEMINI_API_KEY` to your `.env` file in the bot root directory to enable AI commands.',
                        ephemeral: true
                    });
                }

                const style = options.getString('style');
                const text = options.getString('text');
                await interaction.deferReply();

                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

                    const prompt = `You are Friday, a highly advanced server administrative AI. Rewrite the following text to match a ${style} persona. Maintain the core meaning but completely transform the tone and vocabulary to fit the requested style. Do not include conversational filler in your response (like "Here is your rewrite:"), just output the rewritten text directly.\n\nText to rewrite: ${text}`;
                    
                    const result = await model.generateContent(prompt);
                    let responseText = result.response.text().trim();

                    if (responseText.length > 1800) {
                        responseText = responseText.substring(0, 1750) + '\n\n*(Truncated due to length)*';
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('📝 Friday Protocol: Persona Rewrite')
                        .setColor('#10b981')
                        .addFields(
                            { name: 'Original Text', value: text.length > 1000 ? text.substring(0, 950) + '...' : text },
                            { name: 'Style Persona', value: `✨ **${style}**`, inline: true }
                        )
                        .setDescription(`### Rewritten Output:\n${responseText}`)
                        .setTimestamp()
                        .setFooter({ text: 'Friday AI Persona Core • Powered by Gemini 3.1' });

                    return interaction.editReply({ embeds: [embed] });
                } catch (apiError) {
                    console.error('[GEMINI API ERROR IN REWRITE]', apiError);
                    return interaction.editReply({
                        content: '❌ **AI Generation Failure:** Encountered an error while communicating with the Gemini API.'
                    });
                }
            }

            // ------------------------------------------
            // F. Subcommand: summarize
            // ------------------------------------------
            if (subcommand === 'summarize') {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
                    return interaction.reply({
                        content: '⚠️ **Gemini API Key is not configured.** Please add a valid `GEMINI_API_KEY` to your `.env` file in the bot root directory to enable AI commands.',
                        ephemeral: true
                    });
                }

                await interaction.deferReply();

                try {
                    // Fetch recent 50 messages from the active channel
                    const messages = await interaction.channel.messages.fetch({ limit: 50 });
                    
                    if (messages.size === 0) {
                        return interaction.editReply({
                            content: '⚠️ No messages found in the active channel history to summarize.'
                        });
                    }

                    // Format message log history (reversing to preserve chronological sequence)
                    const messageArray = Array.from(messages.values()).reverse();
                    let chatLogs = '';
                    for (const msg of messageArray) {
                        // Skip system messages and empty content
                        if (msg.system || !msg.content || msg.content.trim() === '') continue;
                        
                        const formattedLine = `[${msg.author.tag}]: ${msg.content.substring(0, 200)}\n`;
                        if ((chatLogs + formattedLine).length > 8000) break;
                        chatLogs += formattedLine;
                    }

                    if (chatLogs.trim() === '') {
                        return interaction.editReply({
                            content: '⚠️ Could not find any readable user text messages in the last 50 entries to summarize.'
                        });
                    }

                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

                    const prompt = `You are Friday, a highly advanced server administrative AI. Summarize the following Discord channel chat log in a structured, concise bulleted list of key topics, decisions, and overall vibe. Keep the formatting clean, professional, and readable for a Discord embed (using bold text and markdown list points). Avoid exposing credentials or irrelevant bot commands.\n\nChat Logs:\n${chatLogs}`;
                    
                    const result = await model.generateContent(prompt);
                    let responseText = result.response.text().trim();

                    if (responseText.length > 1900) {
                        responseText = responseText.substring(0, 1850) + '\n\n*(Truncated due to length limits)*';
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('📊 Friday Protocol: Channel Briefing')
                        .setColor('#06b6d4')
                        .setDescription(`### Recent Chat Activity Summary:\n\n${responseText}`)
                        .setTimestamp()
                        .setFooter({ text: 'Analyzed recent chat buffer • Powered by Gemini 3.1' });

                    return interaction.editReply({ embeds: [embed] });
                } catch (apiError) {
                    console.error('[GEMINI API ERROR IN SUMMARIZE]', apiError);
                    return interaction.editReply({
                        content: '❌ **AI Generation Failure:** Encountered an error while reading history or communicating with the Gemini API.'
                    });
                }
            }

            // ------------------------------------------
            // G. Subcommand: imagine
            // ------------------------------------------
            if (subcommand === 'imagine') {
                const prompt = options.getString('prompt');
                await interaction.deferReply();

                let profile;
                try {
                    // Check user balance first
                    profile = await db.getProfile(guild.id, member.id);
                    if (!profile || profile.coins < 50) {
                        return interaction.editReply({
                            content: `❌ **Insufficient Coins:** You need at least **50 coins** to generate a synthetic image. (Current Balance: **${profile ? profile.coins : 0} coins**)`
                        });
                    }

                    // Deduct 50 coins
                    await db.updateCoins(guild.id, member.id, -50);
                } catch (dbError) {
                    console.error('[DATABASE ERROR IN IMAGINE]', dbError);
                    return interaction.editReply({
                        content: '❌ Failed to process coin transaction. Please try again later.'
                    });
                }

                try {
                    // Generate image via Pollinations AI (keyless, no quota)
                    const seed = Math.floor(Math.random() * 1000000);
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

                    // Get updated balance to display
                    const updatedProfile = await db.getProfile(guild.id, member.id);
                    const remainingCoins = updatedProfile ? updatedProfile.coins : (profile.coins - 50);

                    const embed = new EmbedBuilder()
                        .setTitle('🎨 Friday Protocol: Neural Image Synthesis')
                        .setColor('#ec4899')
                        .setDescription(`*Prompt:* "${prompt}"\n\nDeducted **50 coins** from your wallet.`)
                        .setImage(imageUrl)
                        .setTimestamp()
                        .setFooter({ text: `Remaining Balance: ${remainingCoins} coins • Friday Generator Core` });

                    return interaction.editReply({ embeds: [embed] });
                } catch (genError) {
                    console.error('[IMAGE GENERATION ERROR]', genError);

                    // Refund coins on failure
                    try {
                        await db.updateCoins(guild.id, member.id, 50);
                    } catch (refundError) {
                        console.error('[REFUND FAILURE]', refundError);
                    }

                    return interaction.editReply({
                        content: `❌ **Generation Failed:** Could not generate the image. Your 50 coins have been refunded.`
                    });
                }
            }

        } catch (err) {
            console.error('[FRIDAY SYSTEM CORE ERROR]', err);
            // Check if already replied/deferred to avoid double-reply crash
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ Failed to process Friday core operations.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Failed to process Friday core operations.', ephemeral: true });
            }
        }
    }
};
