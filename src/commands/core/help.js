const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a premium interactive help manual containing all 77 Friday bot protocols.'),

    /**
     * Executes the help command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, user } = interaction;
        if (!guild) return;

        // curating the help pages
        const pages = {
            overview: {
                title: '🌌 Friday Protocol Core — System Manual',
                color: '#8b5cf6',
                description: `Welcome to the official manual for **Friday**, your premium cyberpunk administrative assistant.\n\n` +
                    `Friday is powered by a high-performance Express core, a hosted real-time Supabase cluster, and advanced Google Gemini AI model engines.\n\n` +
                    `⚙️ **System Specifications:**\n` +
                    `• Loaded Protocols: \`77 slash commands\`\n` +
                    `• Dynamic Systems: \`Leveling, Economy, Jobs, Pets, Player Bazaar, AutoMod, Onboarding\`\n` +
                    `• UI Control Panel: [Web Dashboard](http://localhost:5173/)\n\n` +
                    `📍 Use the **select menu dropdown below** to load specialized protocol system lists in detail.`,
                fields: [
                    { name: '⚡ Core & AI Systems', value: 'Google Gemini AI generation, conversational ask, text rewriting, quotes, dashboard telemetry.', inline: true },
                    { name: '🪙 Economy & Banking', value: 'Wallets, secured un-robable bank vault transfers, daily coin cycles, job careers, hourly shift wages, scavenging.', inline: true },
                    { name: '🎲 Casino & Gambling', value: 'Interactive Blackjack table, slots spinner, roulette payouts, arena cockfights, heists.', inline: true },
                    { name: '🎣 Scavenging & Shop', value: 'Hunting wild game, fishing lakes, shovel excavations, inventory items, player market bazaar.', inline: true },
                    { name: '📈 Stocks & Trading', value: 'Real-time global stock quotes (NASDAQ/NSE/CRYPTO), long-term share investments, 5× leveraged intraday long/short positions.', inline: true },
                    { name: '✨ Pets & Leveling', value: 'Companion adoption, training, real-time hunger/energy decay, visual rank cards, voice XP trackers.', inline: true },
                    { name: '🛡️ Moderation & AutoMod', value: 'Warning log indexes, time-out silences, kick/ban actions, automated chat content spam blockers.', inline: true },
                    { name: '🛠️ Onboarding & Utility', value: 'Onboarding cards, components reaction role boards, support portal helpdesks, weather alerts.', inline: true },
                    { name: '🎉 Giveaways & Events', value: 'Draw raffles, scheduler RSVP coordinates, voice room lockdown overrides, streaming alerts.', inline: true },
                ]
            },
            help_core: {
                title: '⚡ Core & AI Systems Protocols',
                color: '#00F2FE',
                description: 'Protocols managing artificial intelligence text synthesis, image creations, dynamic system telemetry, and custom server aliases.',
                fields: [
                    { name: '`/friday ask [query]`', value: 'Conversational assistant using Gemini 3.1 LLM system persona.' },
                    { name: '`/friday rewrite [style] [text]`', value: 'Transforms input text into custom personas (Professional, Cyberpunk, Sarcastic, Pirate, Shakespeare).' },
                    { name: '`/friday imagine [prompt]`', value: 'Generates high-res image canvas via Gemini (Costs 🪙50 coins, auto-refunds if failed).' },
                    { name: '`/friday summarize`', value: 'Compiles text summaries of the last 50 text channel messages using Gemini.' },
                    { name: '`/friday status`', value: 'Monitors real-time server telemetry: uptime, memory heap maps, web-socket connection latency.' },
                    { name: '`/friday quote`', value: 'Returns a randomized witty administrative logs system quote.' },
                    { name: '`/friday protocol [name]`', value: 'Executes root automation slates (e.g. `cleanslate`) (Admin).' },
                    { name: '`/customcmd add [name] [text]`', value: 'Configures custom text command server aliases (Admin).' },
                    { name: '`/customcmd embed [name]`', value: 'Creates a custom embed-based command via JSON builder (Admin).' },
                    { name: '`/customcmd remove [name]`', value: 'Removes active custom text command server aliases (Admin).' },
                    { name: '`/customcmd list`', value: 'Displays all active custom commands registered on this server.' }
                ]
            },
            help_economy: {
                title: '🪙 Wallet, Wages & Banking Protocols',
                color: '#FFCC00',
                description: 'Handles server currency flow, active wallet holdings, secure vault configurations, and starter wage generators.',
                fields: [
                    { name: '`/balance [user]`', value: 'Displays comprehensive wealth overview: 🪙 wallet cash, 🏦 bank vault holdings, and 📊 total net worth.' },
                    { name: '`/deposit [amount/all]`', value: 'Deposits active wallet holdings safely inside bank vault. Vault coins are 100% immune to `/rob` heists.' },
                    { name: '`/withdraw [amount/all]`', value: 'Withdraws stored coins from the un-robable bank vault to active wallet.' },
                    { name: '`/pay [user] [amount]`', value: 'Atomically transfers wallet coins to another member.' },
                    { name: '`/gift coins [user] [amount]`', value: 'Securely transfers active wallet coin balances.' },
                    { name: '`/gift item [user] [item_name]`', value: 'Atomically shifts item ownership record entries in the inventory database.' },
                    { name: '`/economy [action] [user] [amount]`', value: 'Spawns or deducts server coins from a member wallet (Admin).' },
                    { name: '`/daily`', value: 'Collects daily coin reward payouts.' },
                    { name: '`/work`', value: 'Performs hourly shift duties. Pay scales with your current job tier (50–660 coins/shift).' },
                    { name: '`/job list`', value: 'Browses all 12 available careers across 4 tiers with pay ranges and XP bonuses.' },
                    { name: '`/job apply [job]`', value: 'Applies for a job career. Higher tiers unlock higher pay per /work shift.' },
                    { name: '`/job quit`', value: 'Resigns from current job. Reverts /work to generic base pay.' },
                    { name: '`/job profile [user]`', value: 'Displays career card showing current job, tier, pay range, and wallet.' },
                    { name: '`/beg`', value: 'Beg strangers for spare change. Grants coins (20 to 120) or rare scavenged junk items.' },
                    { name: '`/search`', value: 'Selects active buttons to scavenge random locations. (Includes catch/bite penalties).' }
                ]
            },
            help_jobs: {
                title: '💼 Job Ecosystem & Career Protocols',
                color: '#FBBF24',
                description: 'Tiered career system that scales `/work` pay. Pick a job to unlock higher salaries and XP bonuses per shift. Switch jobs with a 1-hour cooldown.\n\n' +
                    '**Tier 1 — Starter** *(Level 1+)*: 🛒 Cashier · 🎸 Street Performer · 🚗 Delivery Driver · 🧹 Janitor · ☕ Barista · 🌾 Farmhand\n' +
                    '**Tier 2 — Skilled** *(Level 5+)*: 👨‍🍳 Chef · 🔧 Mechanic · 💂 Security Guard · 🪠 Plumber · ⚡ Electrician · 🏥 Nurse\n' +
                    '**Tier 3 — Professional** *(Level 10+)*: 💻 Software Engineer · 🩺 Doctor · ⚖️ Lawyer · 🏗️ Architect · 💊 Pharmacist · 📊 Financial Analyst\n' +
                    '**Tier 4 — Elite** *(Level 20+)*: 🏢 CEO · 💰 Investment Banker · 🎮 Game Developer · 🔬 Surgeon · 🚀 Aerospace Engineer · 📈 Hedge Fund Manager',
                fields: [
                    { name: '`/job list`', value: 'Displays all 24 available careers sorted by tier, with pay range, XP bonus, and level requirement.' },
                    { name: '`/job apply [job]`', value: 'Applies for a job. Must meet the level requirement. Each job changes `/work` pay and flavor text.' },
                    { name: '`/job quit`', value: 'Resigns from current job. Reverts /work pay to generic base range (50–150).' },
                    { name: '`/job profile [user?]`', value: 'Displays a career summary card — job title, tier, pay range, XP bonus, and time employed.' },
                    { name: '`/work`', value: 'Earn coins for your current job (1-hour cooldown). Pay scales with tier: Starter 50–300 · Skilled 400–920 · Pro 1,200–3,500 · Elite 5,000–20,000.' },
                ]
            },
            help_casino: {
                title: '🎲 Casino, Gambits & Robbery Protocols',
                color: '#FF3366',
                description: 'Risk management, casino tabletop games, player-to-player wallet thefts, and cooperative server vault heist coordination.',
                fields: [
                    { name: '`/blackjack [bet]`', value: 'Play high-stakes Blackjack using interactive Hit & Stand components against the dealer.' },
                    { name: '`/slots [bet]`', value: 'Spins cyber slot rollers for high winning coin multipliers.' },
                    { name: '`/roulette [bet] [space]`', value: 'Color (red/black/green) and number roulette game following casino house odds.' },
                    { name: '`/cockfight [bet]`', value: 'Bets on randomized arena gladiators fights with extensive text simulation narrative logs.' },
                    { name: '`/rob [target]`', value: 'High-risk theft attempt against target active wallet. (45% steal success; 55% penalty fine paid to victim).' },
                    { name: '`/bankrob [target]`', value: 'Spawns cooperative heist lobby using buttons. Scaling crew size increases success chances (Breaches secure vault).' }
                ]
            },
            help_grinding: {
                title: '🎣 Scavenging, Shops & Player Market',
                color: '#00FF66',
                description: 'Tools, inventory management, trade-ins, consumables, and dynamic player-driven global trade auctions.',
                fields: [
                    { name: '`/hunt`', value: 'Ventures wild woodlands (requires Hunting Rifle). Awards animals (Rabbit to Grizzly Bear).' },
                    { name: '`/fish`', value: 'Casts fishing lines (requires Fishing Pole). Awards fish (Goldfish to Mythical Whale).' },
                    { name: '`/dig`', value: 'Excavates the ground (requires Shovel). Awards fossils, junk, or Buried Gold Chests.' },
                    { name: '`/inventory [user]`', value: 'Exposes user items portfolio, details, and purchase timestamps.' },
                    { name: '`/shop`', value: 'Displays merchant tools catalogue (Hunting Rifle, Fishing Pole, Shovel, Pizza, Lootbox).' },
                    { name: '`/buy [item] [amount]`', value: 'Buys tool items or consumables from the official server merchant.' },
                    { name: '`/sell [item] [amount]`', value: 'Sells collected loot items back to the merchant for guaranteed static currency.' },
                    { name: '`/use [item]`', value: 'Consumes items for perks (Pizza for 🏆150 XP, Energy Drink for 🪙300 coins, Lootboxes for prize wheels).' },
                    { name: '`/market view`', value: 'Browses player-posted auction listings (Listing ID, Seller, Price, Timestamp).' },
                    { name: '`/market list [item] [price]`', value: 'Lists an item from your inventory up for sale for a custom coin price.' },
                    { name: '`/market buy [listing_id]`', value: 'Buys listed item from market, transfers coins to seller, and moves item to buyer.' },
                    { name: '`/market cancel [listing_id]`', value: 'Cancels your active market listing and reclaims your item.' }
                ]
            },
            help_pets_leveling: {
                title: '✨ Companions, Levels & Leaderboard Systems',
                color: '#F400FF',
                description: 'Deals with adopting and caring for leveling pets, training stats, and monitoring experience leaders.',
                fields: [
                    { name: '`/pet adopt [name] [type]`', value: 'Adopts a household pet companion (Dog 🐶, Cat 🐱, Hamster 🐹, Lizard 🦎) for 200 coins.' },
                    { name: '`/pet view`', value: 'Renders pet statistics card: Level/XP, Hunger decay, Energy pools, and Attack/Defense ratings.' },
                    { name: '`/pet feed [coins/worm]`', value: 'Feeds companion to fill Hunger stats and stave off starvation levels.' },
                    { name: '`/pet train [attribute]`', value: 'Improves Attack or Defense stats (Costs 25 Energy; trains pet to bite thieves trying to rob you).' },
                    { name: '`/rank [user]`', value: 'Renders custom visual cyber neon canvas Rank Card showing Level, server-wide Rank, and XP progress.' },
                    { name: '`/leaderboard xp/economy`', value: 'Renders top XP leveling tables or coin wealth leaderboards.' },
                    { name: '`/vclevel`', value: 'Displays active voice chat minute leaderboards.' },
                    { name: '`/xp [user] [action] [amount]`', value: 'Modifies member experience levels (ADD/REMOVE/SET) (Admin).' },
                    { name: '`/level-config`', value: 'Adjusts base XP rates, message cooldown timers, and leveling constants (Admin).' },
                    { name: '`/level-rewards`', value: 'Configures role achievements automatically assigned at specific level milestones (Admin).' }
                ]
            },
            help_moderation: {
                title: '🛡️ Moderation & AutoMod Regulations',
                color: '#FF1F1F',
                description: 'Administrative enforcement parameters, formal logs warnings index, and chat filters config settings.',
                fields: [
                    { name: '`/automod rules/exemptions/punishments`', value: 'Configures live spam filters, caps locks, link blockers, bypass exceptions, and timeouts (Admin).' },
                    { name: '`/warn [user] [reason]`', value: 'Logs formal warning strike against member profile records (Admin).' },
                    { name: '`/warnings [user]`', value: 'Inspects user warnings log index histories.' },
                    { name: '`/clearwarn [user] [warn_id/all]`', value: 'Deletes warning entry records from database logs (Admin).' },
                    { name: '`/timeout [user] [duration] [reason]`', value: 'Mutes member chat sending and voice room joining (Admin).' },
                    { name: '`/untimeout [user]`', value: 'Restores target user messaging privileges (Admin).' },
                    { name: '`/purge [amount] [type]`', value: 'Bulk purges messages (all, bot, user, attachments, embeds) (Admin).' },
                    { name: '`/kick [user] [reason]`', value: 'Kicks user from the Discord server (Admin).' },
                    { name: '`/ban [user] [reason]`', value: 'Permabans user profile from guild and database (Admin).' },
                    { name: '`/unban [user_id]`', value: 'Revokes active ban record index entries (Admin).' },
                    { name: '`/lockdown [channel] [action]`', value: 'Locks/unlocks channel send messages permissions for @everyone (Admin).' },
                    { name: '`/slowmode [seconds]`', value: 'Configures message rates throttle (Admin).' }
                ]
            },
            help_utility: {
                title: '🛠️ Utility, Support Tickets & Onboarding',
                color: '#00E8C6',
                description: 'Support portals ticketing pipelines, onboarding visual greetings, auto-roles, and miscellaneous inquiries.',
                fields: [
                    { name: '`/welcome [channel] [msg]`', value: 'Configures visual cyberpunk join greeting canvas cards and text templates (Admin).' },
                    { name: '`/autorole [role/remove]`', value: 'Sets role automatically assigned to members on joining (Admin).' },
                    { name: '`/reactionrole`', value: 'Deploys interactive click button components role assignment menus (Admin).' },
                    { name: '`/ticket setup`', value: 'Deploys the persistent "Create Ticket" helpdesk dashboard panel (Admin).' },
                    { name: '`/ticket close`', value: 'Generates conversation transcript and closes the support portal channel.' },
                    { name: '`/ticket add/remove [user] [role]`', value: 'Grants or revokes member/role access overrides inside the ticket channel.' },
                    { name: '`/ping`', value: 'Calculates roundtrip and WebSocket API latency.' },
                    { name: '`/userinfo [user]` / `/serverinfo`', value: 'Displays rich statistics info of profiles or the server.' },
                    { name: '`/channelinfo [channel]` / `/roleinfo [role]`', value: 'Displays details and metadata of channels or roles.' },
                    { name: '`/avatar [user]` / `/servericon`', value: 'Returns high-res avatar or server graphics.' },
                    { name: '`/remind [time] [message]`', value: 'Schedules deferred in-memory reminder alerts.' },
                    { name: '`/urban [word]`', value: 'Fetches definitions from Urban Dictionary API.' },
                    { name: '`/weather [location]`', value: 'Fetches wttr.in real-time atmospheric updates.' },
                    { name: '`/poll [question] [opts]`', value: 'Constructs custom multi-option reaction voting panels.' },
                    { name: '`/embed`', value: 'Configures visual rich embeds through standard JSON builders (Admin).' }
                ]
            },
            help_stocks: {
                title: '📈 Stocks, Portfolio & Intraday Trading',
                color: '#FF007F',
                description: 'Real-time global stock market data, long-term share investments, and leveraged intraday trading positions.',
                fields: [
                    { name: '`/stock list [market?]`', value: 'Displays all available stocks across NASDAQ, NSE, LSE, CRYPTO, TYO, and ASX markets with live prices.' },
                    { name: '`/stock quote [symbol]`', value: 'Fetches a detailed real-time price quote and market data for a specific stock symbol.' },
                    { name: '`/stock buy [symbol] [shares]`', value: 'Buys long-term investment shares of a stock. Deducts coin cost from wallet at current market price.' },
                    { name: '`/stock sell [symbol] [shares]`', value: 'Sells long-term investment shares back to market. Credits proceeds to wallet.' },
                    { name: '`/portfolio view [user?]`', value: 'Shows all active long-term holdings and open intraday positions with live PnL calculations.' },
                    { name: '`/portfolio open [type] [symbol] [margin]`', value: 'Opens a 5× leveraged intraday LONG (bullish) or SHORT (bearish) position using margin coins as collateral.' },
                    { name: '`/portfolio close [symbol]`', value: 'Closes an active leveraged intraday position and settles profit or loss to your wallet.' },
                ]
            },
            help_giveaways: {
                title: '🎉 Giveaways, Scheduling & Telemetry Logs',
                color: '#FF6F00',
                description: 'Raffle draw integrations, schedule coordinates, auditing logs search queries, and voice room lockdowns.',
                fields: [
                    { name: '`/giveaway start [duration] [winners] [prize]`', value: 'Deploys interactive raffle button drawings in the current channel (Admin).' },
                    { name: '`/giveaway end [id]` / `/giveaway reroll [id]`', value: 'Closes or rolls new winners from a giveaway using the message ID (Admin).' },
                    { name: '`/event create [title] [desc] [date] [location]`', value: 'Spawns scheduled event coordination RSVP tracking panels (Admin).' },
                    { name: '`/vc lock/unlock`', value: 'Toggles room join connect permissions for active voice room owner.' },
                    { name: '`/vc claim`', value: 'Instantly claims voice channel ownership if the current temporary owner left.' },
                    { name: '`/alerts youtube [action] [url] [channel]`', value: 'Subscribes or removes YouTube upload notifications to a text channel (Admin).' },
                    { name: '`/alerts twitch [action] [username] [channel]`', value: 'Subscribes or removes Twitch live stream triggers to a channel (Admin).' },
                    { name: '`/logs message` / `/logs voice`', value: 'Exposes audit logs lists tracking edits/deletions or voice connections (Admin).' },
                    { name: '`/modstats [moderator]`', value: 'Displays enforcement statistics counts (warns/timeouts/bans) (Admin).' },
                    { name: '`/serveractivity`', value: 'Provides visual telemetry stats overview links directing to the web control panel.' }
                ]
            }
        };

        try {
            // Function to generate the embed for a specific page
            const getEmbed = (pageKey) => {
                const data = pages[pageKey];
                const embed = new EmbedBuilder()
                    .setTitle(data.title)
                    .setColor(data.color)
                    .setDescription(data.description)
                    .setFooter({ text: `Friday System v1.0.0 • Requested by ${user.tag}` })
                    .setTimestamp();

                if (pageKey === 'overview') {
                    // Summarized categories for overview
                    embed.addFields(data.fields);
                } else {
                    // Curated descriptions for commands
                    data.fields.forEach(f => {
                        embed.addFields({ name: f.name, value: `• ${f.value}` });
                    });
                }
                return embed;
            };

            // Build select menu categories dropdown
            const menu = new StringSelectMenuBuilder()
                .setCustomId('help_select')
                .setPlaceholder('📂 Select a Protocol category...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Galaxy System Overview')
                        .setDescription('Bot introduction, core systems specs & categories.')
                        .setValue('overview')
                        .setEmoji('🌌'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Core & AI Systems')
                        .setDescription('/friday imagine, ask, rewrite, summarize, customcmd add/remove.')
                        .setValue('help_core')
                        .setEmoji('⚡'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Economy & Banking')
                        .setDescription('/balance, deposit, withdraw, wages, begging, daily.')
                        .setValue('help_economy')
                        .setEmoji('🪙'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Job Ecosystem')
                        .setDescription('/job list, apply, quit, profile. Tiered careers that scale /work pay.')
                        .setValue('help_jobs')
                        .setEmoji('💼'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Casino & Heists')
                        .setDescription('/blackjack, slots, roulette, cockfights, heists.')
                        .setValue('help_casino')
                        .setEmoji('🎲'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Scavenging & Shop')
                        .setDescription('/hunt, fish, dig, inventory, shop, players bazaar.')
                        .setValue('help_grinding')
                        .setEmoji('🎣'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Stocks & Trading')
                        .setDescription('/stock list, quote, buy, sell, portfolio open/close/view.')
                        .setValue('help_stocks')
                        .setEmoji('📈'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Pets & Leveling')
                        .setDescription('/pet adopt, feed, train, visual ranks, leaderboards.')
                        .setValue('help_pets_leveling')
                        .setEmoji('✨'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Moderation & AutoMod')
                        .setDescription('/automod, warns, slowmodes, purges, locks, kicks, bans.')
                        .setValue('help_moderation')
                        .setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Onboarding & Utility')
                        .setDescription('Welcome visual cards, auto-roles, tickets portal, widgets.')
                        .setValue('help_utility')
                        .setEmoji('🛠️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Giveaways & Event Logs')
                        .setDescription('/giveaway, events, voice locks, audit logs list, streamers alerts.')
                        .setValue('help_giveaways')
                        .setEmoji('🎉')
                );

            const row = new ActionRowBuilder().addComponents(menu);

            // Send initial help manual
            const sent = await interaction.editReply({
                embeds: [getEmbed('overview')],
                components: [row],
                fetchReply: true
            });

            // Create component collector to capture select menu switches
            const collector = sent.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000 // 60 seconds lifetime
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== user.id) {
                    return i.reply({ content: '❌ You did not invoke this command. Run `/help` to spawn your own manual.', ephemeral: true });
                }

                const selection = i.values[0];
                await i.update({
                    embeds: [getEmbed(selection)],
                    components: [row]
                });
            });

            collector.on('end', async () => {
                // Disable the select menu when collector times out
                const disabledMenu = StringSelectMenuBuilder.from(menu).setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
                
                await interaction.editReply({
                    components: [disabledRow]
                }).catch(() => {});
            });

        } catch (err) {
            console.error('[ERROR] Help command failed:', err);
            const errMsg = { content: '❌ Failed to process systems help command.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg).catch(() => {});
            } else {
                await interaction.editReply(errMsg).catch(() => {});
            }
        }
    }
};
