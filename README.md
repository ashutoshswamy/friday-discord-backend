# Friday — Discord Bot

A feature-rich Discord bot with a React web dashboard. Built on Discord.js v14, Express, and Supabase.

---

## Project Structure

```
friday/
├── src/                    # Bot + API backend
│   ├── index.js            # Bot entry point
│   ├── server.js           # Express REST API (port 5001)
│   ├── deploy-commands.js  # Slash command registration script
│   ├── commands/           # All slash commands (grouped by category)
│   ├── events/             # Discord.js event handlers
│   ├── handlers/           # Command + event loader
│   └── utils/
│       └── db.js           # Supabase database helpers
├── frontend/               # React dashboard (Vite + React 19)
│   ├── src/
│   │   ├── App.jsx         # Main dashboard app
│   │   ├── Landing.jsx     # Login/landing page
│   │   └── Commands.jsx    # Public command reference page
│   └── package.json
├── supabase/
│   └── migrations/         # Database schema migrations
├── package.json            # Bot dependencies
└── .env                    # Environment variables (see setup)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot | Discord.js v14 |
| API | Express 5 |
| Database | Supabase (PostgreSQL) |
| Auth | Discord OAuth2 + JWT |
| AI | Google Gemini (`@google/generative-ai`) |
| Canvas | `@napi-rs/canvas` (rank cards, welcome cards) |
| Frontend | React 19, Vite 8, React Router v6 |

---

## Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```env
# Discord
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
CLIENT_SECRET=your_application_client_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

# Auth
JWT_SECRET=any_random_secret_string

# Dashboard OAuth redirect
DASHBOARD_REDIRECT_URI=http://localhost:5173/

# AI (optional)
GEMINI_API_KEY=your_google_ai_api_key
```

### 2. Database

Run the migrations in `supabase/migrations/` against your Supabase project in order.

### 3. Install & Run

```bash
# Bot + API
npm install
npm run deploy        # register slash commands with Discord
npm start             # start bot + Express API on port 5001

# Dashboard (separate terminal)
cd frontend
npm install
npm run dev           # dev server at http://localhost:5173
```

---

## Commands Reference

### Core — `/friday`

| Subcommand | Description |
|---|---|
| `quote` | Random Friday system narrative quote |
| `status` | Bot diagnostics — latency, memory, uptime |
| `protocol <name>` | Execute admin automation protocols (e.g. `cleanslate`) |
| `ask <query>` | AI conversation using Friday's Gemini persona |
| `rewrite <text>` | AI-powered text rewriter |
| `summarize <text>` | AI text summarizer |
| `imagine <prompt>` | AI image description generator |

| Command | Description |
|---|---|
| `/ping` | Bot latency and API response time |
| `/help` | Interactive help manual listing all commands |

---

### Moderation

| Command | Description | Permission |
|---|---|---|
| `/ban <user> [reason] [days]` | Ban user, delete recent messages | Ban Members |
| `/unban <id>` | Unban by user ID | Ban Members |
| `/kick <user> [reason]` | Kick user from server | Kick Members |
| `/timeout <user> <duration> [reason]` | Native Discord timeout | Moderate Members |
| `/untimeout <user>` | Remove active timeout early | Moderate Members |
| `/warn <user> <reason>` | Issue a formal warning (stored in DB) | Moderate Members |
| `/warnings <user>` | View all warnings for a member | Moderate Members |
| `/clearwarn <user> [id]` | Delete specific or all warnings | Moderate Members |
| `/purge <amount> [user]` | Bulk delete messages (optional user filter) | Manage Messages |
| `/lockdown` | Toggle message permissions for @everyone in channel | Manage Channels |
| `/slowmode <seconds>` | Set channel slowmode delay (0 to disable) | Manage Channels |

#### AutoMod — `/automod`

| Subcommand | Description |
|---|---|
| `toggle <filter>` | Enable/disable spam, links, caps, slurs, toxicity filters |
| `blocklist add/remove/list <word>` | Manage custom blocked word list |
| `whitelist add/remove/list <role/channel>` | Exempt roles/channels from AutoMod |
| `punishments` | View/set punishment escalation (warn → timeout → ban) |

---

### Leveling & XP

| Command | Description | Permission |
|---|---|---|
| `/rank [user]` | Display canvas rank card with XP, level, progress bar | Anyone |
| `/leaderboard xp` | Top 10 members by level and XP | Anyone |
| `/leaderboard economy` | Top 10 wealthiest members | Anyone |
| `/xp <add/remove> <user> <amount>` | Manually adjust a member's XP | Administrator |
| `/level-config` | Set XP multiplier (0.5× to 2.0×), XP cooldown, min/max XP per message | Administrator |
| `/level-rewards <add/remove/list> [level] [role]` | Assign roles auto-granted at specific levels | Administrator |
| `/vclevel` | Voice channel engagement leaderboard (XP from VC time) | Anyone |

---

### Economy

**Wallet & Banking**

| Command | Description |
|---|---|
| `/balance [user]` | View wallet + bank balance |
| `/daily` | Claim 200 coins (24h cooldown) |
| `/work` | Earn random salary (5 min cooldown) |
| `/pay <user> <amount>` | Transfer coins to another member |
| `/deposit <amount\|all>` | Move coins from wallet to bank |
| `/withdraw <amount\|all>` | Move coins from bank to wallet |

**Grinding (item-based)**

| Command | Description | Requires |
|---|---|---|
| `/fish` | Fish in virtual lake for items + coins | Fishing Pole (shop) |
| `/hunt` | Hunt in virtual woods | Hunting Rifle (shop) |
| `/dig` | Dig for buried treasure | Shovel (shop) |
| `/search` | Choose 1 of 3 locations to search | None |
| `/beg` | Beg for spare change | None |

**Gambling**

| Command | Description |
|---|---|
| `/slots <bet>` | Spin slot machine for coin multipliers |
| `/blackjack <bet>` | Blackjack vs Friday dealer |
| `/roulette <bet> <color/number>` | Roulette wheel bet |
| `/cockfight <bet>` | Bet on cockfight arena simulation |
| `/rob <user>` | Attempt to rob another member's wallet |
| `/bankrob <user>` | Attempt to rob another member's bank |

**Shop & Items**

| Command | Description | Permission |
|---|---|---|
| `/shop view` | Browse server shop listings | Anyone |
| `/shop add <item> <price> [role]` | Add item to shop | Administrator |
| `/shop remove <item>` | Remove item from shop | Administrator |
| `/buy <item>` | Purchase item from shop | Anyone |
| `/sell <item>` | Sell loot items back for coins | Anyone |
| `/use <item>` | Activate a consumable inventory item | Anyone |
| `/inventory [user]` | View inventory contents | Anyone |

**Market (Player-to-Player)**

| Command | Description |
|---|---|
| `/market view` | Browse all active player listings |
| `/market list <item> <price>` | List an inventory item for sale |
| `/market buy <listing-id>` | Buy a player listing |
| `/market cancel <listing-id>` | Cancel your own listing |

**Gifting**

| Command | Description |
|---|---|
| `/gift coins <user> <amount>` | Gift coins to a member |
| `/gift item <user> <item>` | Gift an inventory item to a member |

**Admin Economy**

| Command | Description | Permission |
|---|---|---|
| `/economy add <user> <amount>` | Spawn coins for a member | Administrator |
| `/economy remove <user> <amount>` | Deduct coins from a member | Administrator |

**Pets**

| Command | Description |
|---|---|
| `/pet view` | View your pet's stats (hunger, affection, energy, ATK, DEF) |
| `/pet adopt <type>` | Adopt a new pet (Dog, Cat, Dragon, Fox, Rabbit) |
| `/pet feed` | Feed your pet to restore hunger |
| `/pet train` | Train your pet to raise ATK/DEF stats |

---

### Onboarding

| Command | Description | Permission |
|---|---|---|
| `/welcome set <channel> [message]` | Set welcome channel and optional custom message | Administrator |
| `/welcome disable` | Disable welcome messages | Administrator |
| `/autorole set <role>` | Auto-assign a role when members join | Administrator |
| `/autorole disable` | Remove auto-role assignment | Administrator |
| `/reactionrole <channel> <title> <role1..5>` | Deploy button-based role selection menu | Administrator |

---

### Giveaways & Events

| Command | Description | Permission |
|---|---|---|
| `/giveaway start <duration> <winners> <prize> <channel>` | Start a giveaway with timer (e.g. `30m`, `2h`, `7d`) | Manage Guild |
| `/giveaway end <message-id>` | End a giveaway early and draw winners | Manage Guild |
| `/giveaway reroll <message-id>` | Pick new winners for an ended giveaway | Manage Guild |
| `/event create <title> <date> <description> <channel>` | Deploy an RSVP event card with Join button | Manage Guild |

---

### Tickets

| Command | Description | Permission |
|---|---|---|
| `/ticket setup <channel> [category]` | Deploy persistent helpdesk "Create Ticket" panel | Administrator |
| `/ticket close` | Close and archive the current ticket channel | Manage Channels |
| `/ticket add <user>` | Add a member to the current ticket | Manage Channels |
| `/ticket remove <user>` | Remove a member from the current ticket | Manage Channels |

---

### Auditing & Logs

| Command | Description | Permission |
|---|---|---|
| `/logs message [user]` | View recent deleted/edited message logs | View Audit Log |
| `/logs voice [user]` | View recent voice channel join/leave activity | View Audit Log |
| `/modstats [moderator]` | View moderation action counts for a staff member | View Audit Log |
| `/serveractivity` | Link to the web dashboard analytics page | Manage Guild |

---

### Utility

| Command | Description |
|---|---|
| `/avatar [user]` | Display high-resolution profile avatar |
| `/userinfo [user]` | Detailed member profile (join date, roles, booster status) |
| `/serverinfo` | Server statistics (member count, channels, boost level) |
| `/channelinfo [channel]` | Channel metadata (type, topic, slowmode, NSFW) |
| `/roleinfo <role>` | Role metadata (color, permissions, member count) |
| `/servericon` | Display server icon in full resolution |
| `/poll <question> <options>` | Create a button-based poll |
| `/remind <time> <message>` | Schedule a DM reminder (e.g. `10m`, `2h`) |
| `/embed create` | Interactive modal embed builder |
| `/urban <term>` | Urban Dictionary definition lookup |
| `/weather <city>` | Real-time weather conditions |

---

### Custom Commands

| Command | Description | Permission |
|---|---|---|
| `/customcmd add <trigger> <response>` | Create a custom `!trigger` text command | Administrator |
| `/customcmd embed <trigger>` | Create a custom trigger that sends an embed | Administrator |
| `/customcmd remove <trigger>` | Delete a custom command | Administrator |
| `/customcmd list` | List all custom commands in this server | Administrator |

---

### Alerts / Notifications

| Command | Description | Permission |
|---|---|---|
| `/alerts youtube <channel-id> <discord-channel>` | Post alert when YouTube channel uploads | Administrator |
| `/alerts twitch <username> <discord-channel>` | Post alert when Twitch channel goes live | Administrator |

---

### Voice

| Command | Description |
|---|---|
| `/vc lock` | Lock your temporary voice channel (kick permissions removed) |
| `/vc unlock` | Unlock your temporary voice channel |
| `/vc claim` | Claim ownership of an abandoned temp VC |
| `/vclevel` | Voice XP leaderboard for the server |

---

## Web Dashboard

The React dashboard at `frontend/` connects to the Express API at port 5001 via Discord OAuth2.

### Dashboard Tabs

| Tab | Features |
|---|---|
| **Overview** | Member count, XP/economy charts, top members |
| **Leaderboard** | XP + economy podium rankings |
| **Members** | Member list, ban/kick/timeout/warn actions |
| **AutoMod** | Toggle filters, manage blocklist, set punishments |
| **Onboarding** | Welcome channel, welcome card customizer (theme, accent color), reaction roles |
| **Giveaways** | Launch giveaways, manage active giveaways, create events |
| **Milestones** | Level-up role reward configuration |
| **Shop** | Add/remove shop items |
| **Tickets** | Ticket system settings |
| **Logs** | Moderation incident log |
| **Rank Card** | Rank card theme + color customizer |
| **Commands** | Full slash command reference |
| **Inventory** | Browse all member inventories |
| **Pets** | View all server pets and stats |
| **Market** | Live player market listings, admin cancel |

### API Endpoints (port 5001)

All endpoints require `Authorization: Bearer <jwt>` except `/api/auth/*`.

```
POST   /api/auth/discord          OAuth2 token exchange
GET    /api/guilds                List user's guilds
GET    /api/guilds/:id/dashboard  Full guild telemetry
POST   /api/guilds/:id/config     Update guild config
GET    /api/guilds/:id/members    Member list with XP + economy
POST   /api/guilds/:id/ban        Ban member
POST   /api/guilds/:id/kick       Kick member
POST   /api/guilds/:id/timeout    Timeout member
POST   /api/guilds/:id/warn       Issue warning
GET    /api/guilds/:id/giveaways  List active giveaways
POST   /api/guilds/:id/giveaway   Create giveaway
POST   /api/guilds/:id/giveaway/:msgId/end    End early
POST   /api/guilds/:id/giveaway/:msgId/reroll Reroll winners
POST   /api/guilds/:id/event      Deploy event RSVP card
POST   /api/guilds/:id/reaction-roles Deploy reaction role menu
GET    /api/guilds/:id/welcome-card   Welcome card config
POST   /api/guilds/:id/welcome-card   Update welcome card config
GET    /api/guilds/:id/inventory  All member inventory items
GET    /api/guilds/:id/pets       All server pets
GET    /api/guilds/:id/market     Active market listings
```

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production deployment instructions (Railway/VPS for bot, Vercel/Netlify for frontend).
