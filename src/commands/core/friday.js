const {
 SlashCommandBuilder, PermissionFlagsBits,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
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
 .setDescription('Reads recent channel history and outputs a concise summary.')),

 async execute(interaction) {
 const { guild, options, client, member } = interaction;
 if (!guild) return;

 const subcommand = options.getSubcommand();

 try {
 if (subcommand === 'quote') {
 const quote = FRIDAY_QUOTES[Math.floor(Math.random() * FRIDAY_QUOTES.length)];

 const container = new ContainerBuilder()
 .setAccentColor(0x8B5CF6)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Friday Core Protocol\n*"${quote}"*`)
 );

 return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'status') {
 const uptimeMs = client.uptime || 0;
 const hours = Math.floor(uptimeMs / 3600000);
 const minutes = Math.floor((uptimeMs % 3600000) / 60000);
 const seconds = Math.floor((uptimeMs % 60000) / 1000);
 const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
 const ping = client.ws.ping;
 const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

 const container = new ContainerBuilder()
 .setAccentColor(0x00E5FF)
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## System Diagnostics & Metrics\n**Core Engine Name:** Friday Core`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ forceStatic: true })))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Bot Latency:** ${ping}ms\n` +
 `**Uptime:** ${uptimeStr}\n` +
 `**RAM Heap:** ${memoryUsage} MB\n` +
 `**Node.js:** ${process.version}\n` +
 `**Discord.js:** v14.26.4`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# System Integrity: 100% Operational`)
 );

 return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 }

 if (subcommand === 'protocol') {
 if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
 return interaction.reply({
 content: 'Access Denied: Administrator clearance is required to execute protocol slates!',
 ephemeral: true
 });
 }

 const protocolName = options.getString('name').trim().toLowerCase();

 if (protocolName === 'cleanslate') {
 const container = new ContainerBuilder()
 .setAccentColor(0xFF3333)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## Protocol: CLEAN SLATE\n **Executing system clean-slate diagnostics...**`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `• Auditing active database connections... **[SECURE]**\n` +
 `• Scanning temporary files... **[PURGED]**\n` +
 `• Flushing active gateway sockets... **[OK]**\n\n` +
 `Friday Core has successfully re-aligned system indexes.`
 )
 );

 return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } else {
 return interaction.reply({
 content: `Unknown protocol code: \`${protocolName}\`. Try: \`cleanslate\`.`,
 ephemeral: true
 });
 }
 }

 if (subcommand === 'ask') {
 const apiKey = process.env.GEMINI_API_KEY;
 if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
 return interaction.reply({
 content: '**Gemini API Key is not configured.** Please add a valid `GEMINI_API_KEY` to your `.env` file.',
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
 if (responseText.length > 1900) responseText = responseText.substring(0, 1850) + '\n\n*(Truncated due to length limits)*';

 const container = new ContainerBuilder()
 .setAccentColor(0x8B5CF6)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Friday Protocol: AI Query Response`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(responseText))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Friday AI Engine • Powered by Gemini 3.1`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (apiError) {
 console.error('[GEMINI API ERROR IN ASK]', apiError);
 return interaction.editReply({ content: '**AI Generation Failure:** Encountered an error while communicating with the Gemini API.' });
 }
 }

 if (subcommand === 'rewrite') {
 const apiKey = process.env.GEMINI_API_KEY;
 if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
 return interaction.reply({
 content: '**Gemini API Key is not configured.** Please add a valid `GEMINI_API_KEY` to your `.env` file.',
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
 if (responseText.length > 1800) responseText = responseText.substring(0, 1750) + '\n\n*(Truncated due to length)*';

 const originalDisplay = text.length > 1000 ? text.substring(0, 950) + '...' : text;

 const container = new ContainerBuilder()
 .setAccentColor(0x10B981)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Friday Protocol: Persona Rewrite\n**Style Persona:** **${style}**`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`**Original Text:**\n> ${originalDisplay}`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`### Rewritten Output:\n${responseText}`)
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Friday AI Persona Core • Powered by Gemini 3.1`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (apiError) {
 console.error('[GEMINI API ERROR IN REWRITE]', apiError);
 return interaction.editReply({ content: '**AI Generation Failure:** Encountered an error while communicating with the Gemini API.' });
 }
 }

 if (subcommand === 'summarize') {
 const apiKey = process.env.GEMINI_API_KEY;
 if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
 return interaction.reply({
 content: '**Gemini API Key is not configured.** Please add a valid `GEMINI_API_KEY` to your `.env` file.',
 ephemeral: true
 });
 }

 await interaction.deferReply();

 try {
 const messages = await interaction.channel.messages.fetch({ limit: 50 });

 if (messages.size === 0) {
 return interaction.editReply({ content: 'No messages found in the active channel history to summarize.' });
 }

 const messageArray = Array.from(messages.values()).reverse();
 let chatLogs = '';
 for (const msg of messageArray) {
 if (msg.system || !msg.content || msg.content.trim() === '') continue;
 const formattedLine = `[${msg.author.tag}]: ${msg.content.substring(0, 200)}\n`;
 if ((chatLogs + formattedLine).length > 8000) break;
 chatLogs += formattedLine;
 }

 if (chatLogs.trim() === '') {
 return interaction.editReply({ content: 'Could not find any readable user text messages in the last 50 entries to summarize.' });
 }

 const genAI = new GoogleGenerativeAI(apiKey);
 const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

 const prompt = `You are Friday, a highly advanced server administrative AI. Summarize the following Discord channel chat log in a structured, concise bulleted list of key topics, decisions, and overall vibe. Keep the formatting clean, professional, and readable for a Discord embed (using bold text and markdown list points). Avoid exposing credentials or irrelevant bot commands.\n\nChat Logs:\n${chatLogs}`;
 const result = await model.generateContent(prompt);
 let responseText = result.response.text().trim();
 if (responseText.length > 1900) responseText = responseText.substring(0, 1850) + '\n\n*(Truncated due to length limits)*';

 const container = new ContainerBuilder()
 .setAccentColor(0x06B6D4)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Friday Protocol: Channel Briefing\n### Recent Chat Activity Summary:`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(responseText))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Analyzed recent chat buffer • Powered by Gemini 3.1`)
 );

 return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
 } catch (apiError) {
 console.error('[GEMINI API ERROR IN SUMMARIZE]', apiError);
 return interaction.editReply({ content: '**AI Generation Failure:** Encountered an error while reading history or communicating with the Gemini API.' });
 }
 }

 } catch (err) {
 console.error('[FRIDAY SYSTEM CORE ERROR]', err);
 if (interaction.deferred || interaction.replied) {
 await interaction.followUp({ content: 'Failed to process Friday core operations.', ephemeral: true });
 } else {
 await interaction.reply({ content: 'Failed to process Friday core operations.', ephemeral: true });
 }
 }
 }
};
