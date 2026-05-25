# Friday — Discord Community Bot

A feature-rich Discord bot with a React web dashboard.
**Live:** [fridaybot.ashutoshswamy.in](https://fridaybot.ashutoshswamy.in)

---

## Tech Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Bot      | Discord.js v14                                |
| API      | Express 5                                     |
| Database | Supabase (PostgreSQL)                         |
| Auth     | Discord OAuth2 + JWT                          |
| AI       | Google Gemini (`@google/generative-ai`)       |
| Canvas   | `@napi-rs/canvas` (rank cards, welcome cards) |
| Frontend | React 19, Vite 8, React Router v7             |

---

## Project Structure

```
friday/
├── src/                        # Bot + API backend
│   ├── index.js                # Bot entry point
│   ├── server.js               # Express REST API (port 5001)
│   ├── deploy-commands.js      # Slash command registration
│   ├── commands/               # Slash commands grouped by category
│   │   ├── alerts/
│   │   ├── auditing/
│   │   ├── core/
│   │   ├── customcmds/
│   │   ├── economy/
│   │   ├── giveaways/
│   │   ├── leveling/
│   │   ├── moderation/
│   │   ├── onboarding/
│   │   ├── tickets/
│   │   ├── utility/
│   │   └── voice/
│   ├── events/                 # Discord.js event handlers
│   ├── handlers/               # Command + event loader
│   └── utils/
│       └── db.js               # Supabase helpers
├── supabase/
│   └── migrations/             # Database schema migrations (run in order)
├── package.json                # Bot dependencies
└── .env                        # Environment variables (see below)
```

---

## Setup

### 1. Environment Variables

Create `.env` in the project root:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
CLIENT_SECRET=your_application_client_secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

JWT_SECRET=any_random_secret_string

DASHBOARD_REDIRECT_URI=http://localhost:5173/

GEMINI_API_KEY=your_google_ai_api_key
```

Create `frontend/.env`:

```env
VITE_API_BASE=http://localhost:5001/api
VITE_CLIENT_ID=your_application_client_id
```

### 2. Database

Run migrations in `supabase/migrations/` against your Supabase project in order.

### 3. Install & Run

```bash
# Bot + API
npm install
npm run deploy    # register slash commands with Discord
npm start         # bot + Express API on port 5001

# Dashboard (separate terminal)
cd frontend
npm install
npm run dev       # dev server at http://localhost:5173
```

---

## Commands Reference

### Core — `/friday`

| Subcommand               | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `ask <query>`            | AI query via Gemini                                                    |
| `imagine <prompt>`       | AI image generation (costs 50 coins)                                   |
| `rewrite <style> <text>` | Rewrite in Professional / Cyberpunk / Sarcastic / Pirate / Shakespeare |
| `summarize`              | Summarize last 50 channel messages                                     |
| `quote`                  | Random Friday system narrative quote                                   |
| `status`                 | Bot diagnostics — latency, memory, uptime                              |
| `protocol <name>`        | Execute admin automation protocols                                     |

| Command | Description                       |
| ------- | --------------------------------- |
| `/ping` | Bot latency and API response time |
| `/help` | Interactive help manual           |

---

### Moderation

| Command                               | Description                         | Permission       |
| ------------------------------------- | ----------------------------------- | ---------------- |
| `/ban <user> [reason] [days]`         | Ban user, delete recent messages    | Ban Members      |
| `/unban <id>`                         | Unban by user ID                    | Ban Members      |
| `/kick <user> [reason]`               | Kick user                           | Kick Members     |
| `/timeout <user> <duration> [reason]` | Discord native timeout              | Moderate Members |
| `/untimeout <user>`                   | Remove active timeout               | Moderate Members |
| `/warn <user> <reason>`               | Issue a warning (stored in DB)      | Moderate Members |
| `/warnings <user>`                    | View all warnings for a member      | Moderate Members |
| `/clearwarn <user> [id]`              | Delete specific or all warnings     | Moderate Members |
| `/purge <amount> [user]`              | Bulk delete messages                | Manage Messages  |
| `/lockdown`                           | Toggle @everyone send permissions   | Manage Channels  |
| `/slowmode <seconds>`                 | Set channel slowmode (0 to disable) | Manage Channels  |

**AutoMod — `/automod`**

| Subcommand                                 | Description                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `toggle <filter>`                          | Enable/disable spam, links, caps, slurs, toxicity |
| `blocklist add/remove/list <word>`         | Manage blocked word list                          |
| `whitelist add/remove/list <role/channel>` | Exempt roles/channels                             |
| `punishments`                              | View/set escalation rules (warn → timeout → ban)  |

---

### Leveling & XP

| Command                            | Description                                      | Permission    |
| ---------------------------------- | ------------------------------------------------ | ------------- |
| `/rank [user]`                     | Canvas rank card with XP, level, progress        | Anyone        |
| `/leaderboard xp`                  | Top 10 by level and XP                           | Anyone        |
| `/leaderboard economy`             | Top 10 wealthiest members                        | Anyone        |
| `/xp <add/remove> <user> <amount>` | Manually adjust XP                               | Administrator |
| `/level-config`                    | Set XP multiplier, cooldown, min/max per message | Administrator |
| `/level-rewards <add/remove/list>` | Assign roles at specific levels                  | Administrator |
| `/vclevel`                         | Voice channel XP leaderboard                     | Anyone        |

---

### Economy

**Wallet & Banking**

| Command                   | Description                         |
| ------------------------- | ----------------------------------- |
| `/balance [user]`         | View wallet + bank balance          |
| `/daily`                  | Claim 200 coins (24h cooldown)      |
| `/work`                   | Earn random salary (5 min cooldown) |
| `/pay <user> <amount>`    | Transfer coins                      |
| `/deposit <amount\|all>`  | Wallet → bank                       |
| `/withdraw <amount\|all>` | Bank → wallet                       |

**Grinding**

| Command   | Description             | Requires      |
| --------- | ----------------------- | ------------- |
| `/fish`   | Fish for items + coins  | Fishing Pole  |
| `/hunt`   | Hunt in virtual woods   | Hunting Rifle |
| `/dig`    | Dig for buried treasure | Shovel        |
| `/search` | Choose 1 of 3 locations | None          |
| `/beg`    | Beg for spare change    | None          |

**Gambling**

| Command                          | Description                 |
| -------------------------------- | --------------------------- |
| `/slots <bet>`                   | Spin slot machine           |
| `/blackjack <bet>`               | Blackjack vs Friday dealer  |
| `/roulette <bet> <color/number>` | Roulette wheel              |
| `/cockfight <bet>`               | Bet on cockfight arena      |
| `/rob <user>`                    | Rob another member's wallet |
| `/bankrob <user>`                | Rob another member's bank   |

**Shop & Items**

| Command                           | Description               | Permission    |
| --------------------------------- | ------------------------- | ------------- |
| `/shop view`                      | Browse shop listings      | Anyone        |
| `/shop add <item> <price> [role]` | Add item                  | Administrator |
| `/shop remove <item>`             | Remove item               | Administrator |
| `/buy <item>`                     | Purchase from shop        | Anyone        |
| `/sell <item>`                    | Sell loot items for coins | Anyone        |
| `/use <item>`                     | Use a consumable item     | Anyone        |
| `/inventory [user]`               | View inventory            | Anyone        |

**Market (Player-to-Player)**

| Command                       | Description            |
| ----------------------------- | ---------------------- |
| `/market view`                | Browse active listings |
| `/market list <item> <price>` | List an item for sale  |
| `/market buy <listing-id>`    | Buy a listing          |
| `/market cancel <listing-id>` | Cancel your listing    |

**Gifting**

| Command                       | Description            |
| ----------------------------- | ---------------------- |
| `/gift coins <user> <amount>` | Gift coins             |
| `/gift item <user> <item>`    | Gift an inventory item |

**Pets**

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `/pet adopt <type>` | Adopt a pet (Dog, Cat, Dragon, Fox, Rabbit)          |
| `/pet view`         | View pet stats (hunger, affection, energy, ATK, DEF) |
| `/pet feed`         | Feed your pet                                        |
| `/pet train`        | Train your pet                                       |

**Admin Economy**

| Command                           | Permission    |
| --------------------------------- | ------------- |
| `/economy add <user> <amount>`    | Administrator |
| `/economy remove <user> <amount>` | Administrator |

---

### Onboarding

| Command                                      | Description              | Permission    |
| -------------------------------------------- | ------------------------ | ------------- |
| `/welcome set <channel> [message]`           | Set welcome channel      | Administrator |
| `/welcome disable`                           | Disable welcome messages | Administrator |
| `/autorole set <role>`                       | Auto-assign role on join | Administrator |
| `/autorole disable`                          | Remove auto-role         | Administrator |
| `/reactionrole <channel> <title> <role1..5>` | Deploy button role menu  | Administrator |

---

### Giveaways & Events

| Command                                                  | Description              | Permission   |
| -------------------------------------------------------- | ------------------------ | ------------ |
| `/giveaway start <duration> <winners> <prize> <channel>` | Start giveaway           | Manage Guild |
| `/giveaway end <message-id>`                             | End early + draw winners | Manage Guild |
| `/giveaway reroll <message-id>`                          | Pick new winners         | Manage Guild |
| `/event create <title> <date> <description> <channel>`   | Deploy RSVP card         | Manage Guild |

---

### Tickets

| Command                              | Description               | Permission      |
| ------------------------------------ | ------------------------- | --------------- |
| `/ticket setup <channel> [category]` | Deploy helpdesk panel     | Administrator   |
| `/ticket close`                      | Close and archive ticket  | Manage Channels |
| `/ticket add <user>`                 | Add member to ticket      | Manage Channels |
| `/ticket remove <user>`              | Remove member from ticket | Manage Channels |

---

### Auditing & Logs

| Command                 | Description                 | Permission     |
| ----------------------- | --------------------------- | -------------- |
| `/logs message [user]`  | Deleted/edited message logs | View Audit Log |
| `/logs voice [user]`    | Voice join/leave activity   | View Audit Log |
| `/modstats [moderator]` | Moderation action counts    | View Audit Log |
| `/serveractivity`       | Link to dashboard analytics | Manage Guild   |

---

### Utility

| Command                      | Description                                |
| ---------------------------- | ------------------------------------------ |
| `/avatar [user]`             | High-res profile avatar                    |
| `/userinfo [user]`           | Member profile (join date, roles, booster) |
| `/serverinfo`                | Server stats (members, channels, boost)    |
| `/channelinfo [channel]`     | Channel metadata                           |
| `/roleinfo <role>`           | Role metadata (color, permissions, count)  |
| `/servericon`                | Full-res server icon                       |
| `/poll <question> <options>` | Button-based poll                          |
| `/remind <time> <message>`   | Schedule a DM reminder                     |
| `/embed create`              | Interactive embed builder modal            |
| `/urban <term>`              | Urban Dictionary lookup                    |
| `/weather <city>`            | Real-time weather                          |

---

### Custom Commands

| Command                               | Description                     | Permission    |
| ------------------------------------- | ------------------------------- | ------------- |
| `/customcmd add <trigger> <response>` | Create `!trigger` text command  | Administrator |
| `/customcmd embed <trigger>`          | Create trigger that sends embed | Administrator |
| `/customcmd remove <trigger>`         | Delete a custom command         | Administrator |
| `/customcmd list`                     | List all custom commands        | Administrator |

---

### Alerts

| Command                                          | Description                 | Permission    |
| ------------------------------------------------ | --------------------------- | ------------- |
| `/alerts youtube <channel-id> <discord-channel>` | Alert on YouTube upload     | Administrator |
| `/alerts twitch <username> <discord-channel>`    | Alert when Twitch goes live | Administrator |

---

### Voice

| Command      | Description                         |
| ------------ | ----------------------------------- |
| `/vc lock`   | Lock your temporary voice channel   |
| `/vc unlock` | Unlock your temporary voice channel |
| `/vc claim`  | Claim an abandoned temp VC          |
| `/vclevel`   | Voice XP leaderboard                |

---

## Web Dashboard

**URL:** [fridaybot.ashutoshswamy.in](https://fridaybot.ashutoshswamy.in)

React SPA connecting to the Express API via Discord OAuth2.

| Tab               | Features                                                 |
| ----------------- | -------------------------------------------------------- |
| **Overview**      | Member count, XP/economy charts, top members             |
| **Leaderboard**   | XP + economy podium rankings                             |
| **Members**       | Member list, ban/kick/timeout/warn/coin/XP actions       |
| **AutoMod**       | Toggle filters, blocklist, punishment escalation         |
| **Onboarding**    | Welcome channel, welcome card customizer, reaction roles |
| **Giveaways**     | Launch giveaways, manage active ones, create events      |
| **Milestones**    | Level-up role reward configuration                       |
| **Shop**          | Add/remove shop items                                    |
| **Tickets**       | Ticket system config + transcript view                   |
| **Logs**          | Moderation incident log + modstats                       |
| **Rank Card**     | Rank card theme + accent color                           |
| **Inventory**     | Browse all member inventories                            |
| **Pets**          | View all server pets and stats                           |
| **Market**        | Live player-to-player market listings                    |
| **Stocks**        | Stock catalog, price charts, portfolio admin             |
| **Alerts**        | YouTube + Twitch notification setup                      |
| **Custom Cmds**   | Create/manage custom text commands                       |
| **Embed Builder** | Send rich embeds to any channel                          |

---

## Deployment

- **Bot + API:** Railway or any VPS (port 5001)
- **Frontend:** Vercel or Netlify — build with `npm run build` in `frontend/`
