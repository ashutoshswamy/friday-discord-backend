const {
 SlashCommandBuilder, ComponentType,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags
} = require('discord.js');

const pages = {
 overview: {
 title: ' Friday Protocol Core — System Manual',
 accentColor: 0x8B5CF6,
 description: `Welcome to the official manual for **Friday**, your premium cyberpunk administrative assistant.\n\nFriday is powered by a high-performance Express core, a hosted real-time Supabase cluster, and advanced Google Gemini AI model engines.`,
 bodyText: `**System Specifications:**\n• Loaded Protocols: \`100+ slash commands\`\n• Dynamic Systems: \`Leveling, Economy, Jobs, Pets, Clans, Social, AutoMod, Onboarding\`\n• UI Control Panel: [Web Dashboard](https://fridaybot.ashutoshswamy.in)`,
 fields: [
 { name: ' Core & AI Systems', value: 'Google Gemini AI generation, conversational ask, text rewriting, quotes, dashboard telemetry.' },
 { name: 'Economy & Banking', value: 'Wallets, secured un-robable bank vault transfers, daily/weekly/monthly coin cycles, job careers, hourly shift wages, scavenging, word scramble, crime, cooldowns.' },
 { name: ' Casino & Gambling', value: 'Interactive Blackjack table, slots spinner, roulette payouts, highlow chains, dice, horse racing, cockfights, heists.' },
 { name: ' Scavenging & Shop', value: 'Hunting wild game, fishing lakes, shovel excavations, mine shaft, 30+ sellable loot drops, consumable items, player market bazaar, interactive trade.' },
 { name: ' Stocks & Trading', value: 'Real-time global stock quotes (NASDAQ/NSE/CRYPTO), long-term share investments, 5× leveraged intraday long/short positions.' },
 { name: ' Pets & Leveling', value: 'Companion adoption, training, rename, release, pet battles, real-time hunger/energy decay, visual rank cards, voice XP trackers.' },
 { name: ' Social & Trivia', value: 'Profile cards, bio/tagline, reputation, marriage proposals, trivia questions for coins & XP.' },
 { name: '🏰 Clans', value: 'Create clans, invite members, treasury deposits, clan leaderboards.' },
 { name: ' Fun & Text', value: 'SpongeBob mock, text reverse, large ASCII art block letters.' },
 { name: ' Moderation & AutoMod', value: 'Warning log indexes, time-out silences, kick/ban actions, automated chat content spam blockers.' },
 { name: ' Onboarding & Utility', value: 'Onboarding cards, components reaction role boards, support portal helpdesks, weather alerts.' },
 { name: ' Giveaways & Events', value: 'Draw raffles, scheduler RSVP coordinates, voice room lockdown overrides, streaming alerts.' },
 { name: '📊 Analytics', value: 'Server economy overview, top spenders leaderboard, per-member activity reports (Admin).' }
 ]
 },
 help_core: {
 title: ' Core & AI Systems Protocols',
 accentColor: 0x00F2FE,
 description: 'Protocols managing artificial intelligence text synthesis, image creations, dynamic system telemetry, and custom server aliases.',
 fields: [
 { name: '`/friday ask [query]`', value: 'Conversational assistant using Gemini 3.1 LLM system persona.' },
 { name: '`/friday rewrite [style] [text]`', value: 'Transforms input text into custom personas (Professional, Cyberpunk, Sarcastic, Pirate, Shakespeare).' },
 { name: '`/friday summarize`', value: 'Compiles text summaries of the last 50 text channel messages using Gemini.' },
 { name: '`/friday status`', value: 'Monitors real-time server telemetry: uptime, memory heap maps, web-socket connection latency.' },
 { name: '`/friday quote`', value: 'Returns a randomized witty administrative logs system quote.' },
 { name: '`/customcmd add [name] [text]`', value: 'Configures custom text command server aliases (Admin).' },
 { name: '`/customcmd embed [name]`', value: 'Creates a custom embed-based command via JSON builder (Admin).' },
 { name: '`/customcmd remove [name]`', value: 'Removes active custom text command server aliases (Admin).' },
 { name: '`/customcmd list`', value: 'Displays all active custom commands registered on this server.' }
 ]
 },
 help_economy: {
 title: 'Wallet, Wages & Banking Protocols',
 accentColor: 0xFFCC00,
 description: 'Handles server currency flow, active wallet holdings, secure vault configurations, and starter wage generators.',
 fields: [
 { name: '`/balance [user]`', value: 'Displays comprehensive wealth overview: wallet cash, bank vault holdings, and total net worth.' },
 { name: '`/deposit [amount/all]`', value: 'Deposits active wallet holdings safely inside bank vault. Vault coins are 100% immune to `/rob` heists.' },
 { name: '`/withdraw [amount/all]`', value: 'Withdraws stored coins from the un-robable bank vault to active wallet.' },
 { name: '`/pay [user] [amount]`', value: 'Atomically transfers wallet coins to another member.' },
 { name: '`/gift coins [user] [amount]`', value: 'Securely transfers active wallet coin balances.' },
 { name: '`/gift item [user] [item_name]`', value: 'Atomically shifts item ownership record entries in the inventory database.' },
 { name: '`/economy [action] [user] [amount]`', value: 'Spawns or deducts server coins from a member wallet (Admin).' },
 { name: '`/daily`', value: 'Collects daily coin reward payouts (200 coins, 24h cooldown).' },
 { name: '`/weekly`', value: 'Collects weekly random coin reward (1,000–3,500 coins, 7-day cooldown).' },
 { name: '`/monthly`', value: 'Collects monthly random coin reward (5,000–15,000 coins, 30-day cooldown).' },
 { name: '`/work`', value: 'Performs hourly shift duties. Pay scales with your current job tier (50–660 coins/shift).' },
 { name: '`/job list`', value: 'Browses all 12 available careers across 4 tiers with pay ranges and XP bonuses.' },
 { name: '`/beg`', value: 'Beg strangers for spare change. Grants coins (20 to 120) or rare scavenged junk items.' },
 { name: '`/search`', value: 'Selects active buttons to scavenge random locations. (Includes catch/bite penalties).' },
 { name: '`/scramble`', value: 'Starts a channel word scramble — first to unscramble wins coins + XP. Reward scales by word length (base: length × 35 coins). Speed bonuses: answer in ≤15s for +75%, ≤30s for +40%, ≤45s for +15%.' },
 { name: '`/crime [type]`', value: 'Attempt pickpocket (62%), carjack (42%), or fraud (28%). Success earns coins; failure deducts a fine. Separate cooldowns per crime type.' },
 { name: '`/cooldowns`', value: 'Shows a full dashboard of all your active command cooldowns — DB-based (daily/work) and in-memory (slots/dice/trivia etc.).' }
 ]
 },
 help_jobs: {
 title: ' Job Ecosystem & Career Protocols',
 accentColor: 0xFBBF24,
 description: 'Tiered career system that scales `/work` pay. Pick a job to unlock higher salaries and XP bonuses per shift.\n\n**Tier 1 — Starter** *(Level 1+)*: Cashier · Street Performer · Delivery Driver · Janitor · Barista · Farmhand\n**Tier 2 — Skilled** *(Level 5+)*: Chef · Mechanic · Security Guard · Plumber · Electrician · Nurse\n**Tier 3 — Professional** *(Level 10+)*: Software Engineer · Doctor · Lawyer · Architect · Pharmacist · Financial Analyst\n**Tier 4 — Elite** *(Level 20+)*: CEO · Investment Banker · Game Developer · Surgeon · Aerospace Engineer · Hedge Fund Manager',
 fields: [
 { name: '`/job list`', value: 'Displays all 24 available careers sorted by tier, with pay range, XP bonus, and level requirement.' },
 { name: '`/job apply [job]`', value: 'Applies for a job. Must meet the level requirement. Each job changes `/work` pay and flavor text.' },
 { name: '`/job quit`', value: 'Resigns from current job. Reverts /work pay to generic base range (50–150).' },
 { name: '`/job profile [user?]`', value: 'Displays a career summary card — job title, tier, pay range, XP bonus, and time employed.' },
 { name: '`/work`', value: 'Earn coins for your current job (1-hour cooldown). Pay scales with tier: Starter 50–300 · Skilled 400–920 · Pro 1,200–3,500 · Elite 5,000–20,000.' }
 ]
 },
 help_casino: {
 title: ' Casino, Gambits & Robbery Protocols',
 accentColor: 0xFF3366,
 description: 'Risk management, casino tabletop games, player-to-player wallet thefts, and cooperative server vault heist coordination.',
 fields: [
 { name: '`/blackjack [bet]`', value: 'Play high-stakes Blackjack using interactive Hit & Stand components against the dealer.' },
 { name: '`/highlow [bet]`', value: 'Draw a card and guess if the next is higher or lower. Chain correct guesses to climb multipliers up to 4.5×. Cash out anytime.' },
 { name: '`/dice [bet]`', value: 'Roll two dice against Friday. Higher total wins 2×. Tie refunds your bet.' },
 { name: '`/horse [horse] [bet]`', value: 'Bet on one of 5 horses in a live-narrated race. Odds range from 1.8× (favourite) to 6× (dark horse).' },
 { name: '`/slots [bet]`', value: 'Spins cyber slot rollers for high winning coin multipliers.' },
 { name: '`/roulette [bet] [space]`', value: 'Color (red/black/green) and number roulette game following casino house odds.' },
 { name: '`/cockfight [bet]`', value: 'Bets on randomized arena gladiators fights with extensive text simulation narrative logs.' },
 { name: '`/rob [target]`', value: 'High-risk theft attempt against target active wallet. (45% steal success; 55% penalty fine paid to victim).' },
 { name: '`/bankrob [target]`', value: 'Spawns cooperative heist lobby using buttons. Scaling crew size increases success chances (Breaches secure vault).' }
 ]
 },
 help_grinding: {
 title: ' Scavenging, Shops & Player Market',
 accentColor: 0x00FF66,
 description: 'Tools, inventory management, trade-ins, consumables, and dynamic player-driven global trade auctions.',
 fields: [
 { name: '`/hunt`', value: 'Ventures wild woodlands (requires Hunting Rifle). Awards 9 drops: Rabbit → Eagle Feather → Duck → Deer → Deer Antler → Wild Boar → Wolf Pelt → Grizzly Bear → Dragon Scale.' },
 { name: '`/fish`', value: 'Casts fishing lines (requires Fishing Pole). Awards 12 drops: Clam → Common Bass → Pufferfish → Salmon → Lobster → Goldfish → Coral Fish → Shark Tooth → Ancient Pearl → Mythical Whale.' },
 { name: '`/dig`', value: 'Excavates the ground (requires Shovel). Awards 9 drops: Common Worm → Old Coin → Cracked Geode → Dirt Fossil → Ancient Vase → Sapphire → Ruby → Diamond → Buried Gold Chest.' },
 { name: '`/mine`', value: 'Excavates the mine shaft (requires Pickaxe). Awards 9 ore tiers: Coal → Iron Ore → Gold Ore → Quartz Crystal → Emerald → Ruby Shard → Diamond Ore → Crystal Shard → Mythril Core.' },
 { name: '`/inventory [user]`', value: 'Exposes user items portfolio, details, and purchase timestamps.' },
 { name: '`/shop view`', value: 'Displays server shop with interactive buy menu.' },
 { name: '`/shop catalog`', value: 'Shows all built-in items (tools, consumables, collectibles) with suggested prices for admins.' },
 { name: '`/buy [item]`', value: 'Buys an item from the server shop by name.' },
 { name: '`/sell [item] [amount]`', value: 'Sells collected loot items back to the merchant. 30+ sellable items including gems, pelts, fish, and fossils.' },
 { name: '`/use [item]`', value: 'Consumes items for perks: Pizza (150 XP), XP Potion (300 XP), Energy Drink (300 coins), Work Gloves (500 coins), Coin Bomb (800–4,000 coins), Lootbox, Mystery Crate.' },
 { name: '`/market view`', value: 'Browses player-posted auction listings (Listing ID, Seller, Price, Timestamp).' },
 { name: '`/market list [item] [price]`', value: 'Lists an item from your inventory up for sale for a custom coin price.' },
 { name: '`/market buy [listing_id]`', value: 'Buys listed item from market, transfers coins to seller, and moves item to buyer.' },
 { name: '`/market cancel [listing_id]`', value: 'Cancels your active market listing and reclaims your item.' },
 { name: '`/trade [@user]`', value: 'Opens an interactive bilateral trade session. Both parties offer coins and up to 5 items each. Trade executes only when both confirm.' }
 ]
 },
 help_pets_leveling: {
 title: ' Companions, Levels & Leaderboard Systems',
 accentColor: 0xF400FF,
 description: 'Deals with adopting and caring for leveling pets, training stats, and monitoring experience leaders.',
 fields: [
 { name: '`/pet adopt [name] [type]`', value: 'Adopts a household pet companion (Dog , Cat , Hamster , Lizard ) for 200 coins.' },
 { name: '`/pet view`', value: 'Renders pet statistics card: Level/XP, Hunger decay, Energy pools, and Attack/Defense ratings.' },
 { name: '`/pet feed [coins/worm]`', value: 'Feeds companion to fill Hunger stats and stave off starvation levels.' },
 { name: '`/pet train [attribute]`', value: 'Improves Attack or Defense stats (Costs 25 Energy; trains pet to bite thieves trying to rob you).' },
 { name: '`/pet rename [name]`', value: 'Gives your pet a new name (max 15 characters).' },
 { name: '`/pet release`', value: 'Permanently releases your pet with a confirmation prompt.' },
 { name: '`/pet battle [@user]`', value: 'Challenges another member\'s pet to a combat simulation. Winner earns bonus Pet XP.' },
 { name: '`/rank [user]`', value: 'Renders custom visual cyber neon canvas Rank Card showing Level, server-wide Rank, and XP progress.' },
 { name: '`/leaderboard xp/economy`', value: 'Renders top XP leveling tables or coin wealth leaderboards.' },
 { name: '`/vclevel`', value: 'Displays active voice chat minute leaderboards.' },
 { name: '`/xp [user] [action] [amount]`', value: 'Modifies member experience levels (ADD/REMOVE/SET) (Admin).' },
 { name: '`/level-config`', value: 'Adjusts base XP rates, message cooldown timers, and leveling constants (Admin).' },
 { name: '`/level-rewards`', value: 'Configures role achievements automatically assigned at specific level milestones (Admin).' }
 ]
 },
 help_moderation: {
 title: ' Moderation & AutoMod Regulations',
 accentColor: 0xFF1F1F,
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
 title: ' Utility, Support Tickets & Onboarding',
 accentColor: 0x00E8C6,
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
 title: ' Stocks, Portfolio & Intraday Trading',
 accentColor: 0xFF007F,
 description: 'Real-time global stock market data, long-term share investments, and leveraged intraday trading positions.',
 fields: [
 { name: '`/stock list [market?]`', value: 'Displays all available stocks across NASDAQ, NSE, LSE, CRYPTO, TYO, and ASX markets with live prices.' },
 { name: '`/stock quote [symbol]`', value: 'Fetches a detailed real-time price quote and market data for a specific stock symbol.' },
 { name: '`/stock buy [symbol] [shares]`', value: 'Buys long-term investment shares of a stock. Deducts coin cost from wallet at current market price.' },
 { name: '`/stock sell [symbol] [shares]`', value: 'Sells long-term investment shares back to market. Credits proceeds to wallet.' },
 { name: '`/portfolio view [user?]`', value: 'Shows all active long-term holdings and open intraday positions with live PnL calculations.' },
 { name: '`/portfolio open [type] [symbol] [margin]`', value: 'Opens a 5× leveraged intraday LONG (bullish) or SHORT (bearish) position using margin coins as collateral.' },
 { name: '`/portfolio close [symbol]`', value: 'Closes an active leveraged intraday position and settles profit or loss to your wallet.' }
 ]
 },
 help_social: {
 title: '👤 Social, Profiles & Trivia',
 accentColor: 0xFF69B4,
 description: 'Profile cards, personal bios, reputation, marriage, and trivia quiz rewards.',
 fields: [
 { name: '`/profile [user]`', value: 'Displays a full profile card: bio, level, net worth, job, pet, clan, marriage status, and rep count.' },
 { name: '`/bio [text]`', value: 'Set your personal tagline/bio (max 150 chars). Use `/bio` alone to view your current bio.' },
 { name: '`/rep [@user]`', value: 'Give a reputation point to another member. Once per 24 hours.' },
 { name: '`/marry propose [@user]`', value: 'Send a marriage proposal with Accept/Decline buttons. Target has 60 seconds to respond.' },
 { name: '`/marry divorce`', value: 'Dissolve your current marriage.' },
 { name: '`/trivia [category]`', value: 'Answer a timed multiple-choice trivia question for coins + XP. Categories: General, Science, History, Gaming, Movies.' }
 ]
 },
 help_clan: {
 title: '🏰 Clans',
 accentColor: 0x8B5CF6,
 description: 'Create and manage a server clan, build your treasury, and climb the leaderboard.',
 fields: [
 { name: '`/clan create [name]`', value: 'Found a new clan for 5,000 coins. Name must be 2–20 characters.' },
 { name: '`/clan invite [@user]`', value: 'Invite a member to your clan (owner only). Invite expires in 2 minutes.' },
 { name: '`/clan join [name]`', value: 'Accept a pending invite and join a clan.' },
 { name: '`/clan leave`', value: 'Leave your current clan (owners cannot leave).' },
 { name: '`/clan kick [@user]`', value: 'Remove a member from your clan (owner only).' },
 { name: '`/clan info [name?]`', value: 'View clan stats, treasury, level, and roster. Leave name blank to view your own clan.' },
 { name: '`/clan deposit [amount]`', value: 'Contribute coins from your wallet to the clan treasury.' },
 { name: '`/clan leaderboard`', value: 'View the top 10 clans ranked by treasury wealth on this server.' }
 ]
 },
 help_fun: {
 title: '🎭 Fun & Text Commands',
 accentColor: 0xF97316,
 description: 'Text transformation tools for laughs and creativity.',
 fields: [
 { name: '`/mock [text]`', value: 'Converts text to SpongeBob alternating-case mocking format (max 500 chars).' },
 { name: '`/reverse [text]`', value: 'Reverses the input text character by character (max 500 chars).' },
 { name: '`/ascii [text]`', value: 'Renders text as giant 5-line tall block art letters in a code block (max 10 chars, A–Z, 0–9).' }
 ]
 },
 help_analytics: {
 title: '📊 Server Analytics (Admin)',
 accentColor: 0x06B6D4,
 description: 'Economy telemetry and member activity inspection tools. Admin only.',
 fields: [
 { name: '`/analytics overview`', value: 'Shows total members with profiles, coins in circulation, total XP distributed, average level, and top 5 wealthiest.' },
 { name: '`/analytics topspenders`', value: 'Top 10 members ranked by combined wallet + bank balance with per-player breakdown.' },
 { name: '`/analytics activity [@user]`', value: 'Inspect a specific member\'s economy summary: coins, XP, level, job, pet, clan, rep, and cooldown status.' }
 ]
 },
 help_giveaways: {
 title: ' Giveaways, Scheduling & Telemetry Logs',
 accentColor: 0xFF6F00,
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

function buildHelpContainer(pageKey, user) {
 const data = pages[pageKey];

 let bodyLines = '';
 if (pageKey === 'overview') {
 bodyLines = data.fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
 } else {
 bodyLines = data.fields.map(f => `**${f.name}**\n• ${f.value}`).join('\n\n');
 }

 const container = new ContainerBuilder()
 .setAccentColor(data.accentColor)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## ${data.title}\n${data.description}`)
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

 if (pageKey === 'overview' && data.bodyText) {
 container.addTextDisplayComponents(new TextDisplayBuilder().setContent(data.bodyText));
 container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
 }

 container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyLines));
 container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
 container.addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Friday System v1.0.0 • Requested by ${user.tag} · Select a category below`)
 );

 return container;
}

function buildMenu(disabled = false) {
 const menu = new StringSelectMenuBuilder()
 .setCustomId('help_select')
 .setPlaceholder('Select a Protocol category...')
 .setDisabled(disabled)
 .addOptions(
 new StringSelectMenuOptionBuilder().setLabel('Galaxy System Overview').setDescription('Bot introduction, core systems specs & categories.').setValue('overview'),
 new StringSelectMenuOptionBuilder().setLabel('Core & AI Systems').setDescription('/friday ask, rewrite, summarize, customcmd add/remove.').setValue('help_core'),
 new StringSelectMenuOptionBuilder().setLabel('Economy & Banking').setDescription('/balance, deposit, wages, daily, weekly, monthly, scramble.').setValue('help_economy'),
 new StringSelectMenuOptionBuilder().setLabel('Job Ecosystem').setDescription('/job list, apply, quit, profile. Tiered careers that scale /work pay.').setValue('help_jobs'),
 new StringSelectMenuOptionBuilder().setLabel('Casino & Heists').setDescription('/blackjack, slots, roulette, cockfights, heists.').setValue('help_casino'),
 new StringSelectMenuOptionBuilder().setLabel('Scavenging & Shop').setDescription('/hunt, fish, dig, sell 30+ items, consumables, market bazaar.').setValue('help_grinding'),
 new StringSelectMenuOptionBuilder().setLabel('Stocks & Trading').setDescription('/stock list, quote, buy, sell, portfolio open/close/view.').setValue('help_stocks'),
 new StringSelectMenuOptionBuilder().setLabel('Pets & Leveling').setDescription('/pet adopt, feed, train, rename, release, battle, ranks.').setValue('help_pets_leveling'),
 new StringSelectMenuOptionBuilder().setLabel('Social & Trivia').setDescription('/profile, bio, rep, marry, trivia quiz rewards.').setValue('help_social'),
 new StringSelectMenuOptionBuilder().setLabel('Clans').setDescription('/clan create, invite, join, leave, deposit, leaderboard.').setValue('help_clan'),
 new StringSelectMenuOptionBuilder().setLabel('Fun & Text').setDescription('/mock, reverse, ascii block art.').setValue('help_fun'),
 new StringSelectMenuOptionBuilder().setLabel('Moderation & AutoMod').setDescription('/automod, warns, slowmodes, purges, locks, kicks, bans.').setValue('help_moderation'),
 new StringSelectMenuOptionBuilder().setLabel('Onboarding & Utility').setDescription('Welcome visual cards, auto-roles, tickets portal, widgets.').setValue('help_utility'),
 new StringSelectMenuOptionBuilder().setLabel('Giveaways & Event Logs').setDescription('/giveaway, events, voice locks, audit logs list, streamers alerts.').setValue('help_giveaways'),
 new StringSelectMenuOptionBuilder().setLabel('Analytics (Admin)').setDescription('/analytics overview, topspenders, activity — admin only.').setValue('help_analytics')
 );

 return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('help')
 .setDescription('Displays a premium interactive help manual containing all 79 Friday bot protocols.'),

 async execute(interaction) {
 const { guild, user } = interaction;
 if (!guild) return;

 try {
 const container = buildHelpContainer('overview', user);
 container.addActionRowComponents(buildMenu());

 const sent = await interaction.editReply({
 flags: MessageFlags.IsComponentsV2,
 components: [container],
 fetchReply: true
 });

 const collector = sent.createMessageComponentCollector({
 componentType: ComponentType.StringSelect,
 time: 60000
 });

 collector.on('collect', async (i) => {
 if (i.user.id !== user.id) {
 return i.reply({ content: 'You did not invoke this command. Run `/help` to spawn your own manual.', ephemeral: true });
 }

 const selection = i.values[0];
 const updatedContainer = buildHelpContainer(selection, user);
 updatedContainer.addActionRowComponents(buildMenu());

 await i.update({ flags: MessageFlags.IsComponentsV2, components: [updatedContainer] });
 });

 collector.on('end', async () => {
 const expiredContainer = buildHelpContainer('overview', user);
 expiredContainer.addActionRowComponents(buildMenu(true));
 await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expiredContainer] }).catch(() => {});
 });

 } catch (err) {
 console.error('[ERROR] Help command failed:', err);
 const errMsg = { content: 'Failed to process systems help command.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(errMsg).catch(() => {});
 } else {
 await interaction.editReply(errMsg).catch(() => {});
 }
 }
 }
};
