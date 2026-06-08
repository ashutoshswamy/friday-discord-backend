# Friday — Discord Community Bot

A feature-rich Discord bot with a React web dashboard.
**Live:** [fridaybot.ashutoshswamy.in](https://fridaybot.ashutoshswamy.in)

---

## Commands Reference

### Core — `/friday`

| Subcommand               | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `ask <query>`            | AI query via Gemini                                                    |
| `rewrite <style> <text>` | Rewrite in Professional / Cyberpunk / Sarcastic / Pirate / Shakespeare |
| `summarize`              | Summarize last 50 channel messages                                     |
| `quote`                  | Random Friday system narrative quote                                   |
| `status`                 | Bot diagnostics — latency, memory, uptime                              |

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
| `toggle <module>`                          | Enable/disable spam, links, caps, slurs, toxicity |
| `blocklist add/remove/list <pattern>`      | Manage blocked words and regex patterns           |
| `whitelist add/remove/list <role/channel>` | Exempt roles/channels from all AutoMod            |
| `optout <action> <filter> [channel]`       | Opt a channel out of a specific filter only       |
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

| Command                   | Description                |
| ------------------------- | -------------------------- |
| `/balance [user]`         | View wallet + bank balance |
| `/pay <user> <amount>`    | Transfer coins             |
| `/deposit <amount\|all>`  | Wallet → bank              |
| `/withdraw <amount\|all>` | Bank → wallet              |

**Grinding**

| Command           | Description                                | Requires      |
| ----------------- | ------------------------------------------ | ------------- |
| `/fish`           | Fish for items + coins                     | Fishing Pole  |
| `/hunt`           | Hunt in virtual woods                      | Hunting Rifle |
| `/dig`            | Dig for buried treasure                    | Shovel        |
| `/mine`           | Excavate ores (coal → mythril)             | Pickaxe       |
| `/search`         | Choose 1 of 3 locations                    | None          |
| `/beg`            | Beg for spare change                       | None          |
| `/crime <type>`   | Pickpocket / Carjack / Bank Fraud          | None          |
| `/job list/apply/quit/profile` | Career system — tier-based pay | None          |

**Cooldowns**

| Command      | Description                             |
| ------------ | --------------------------------------- |
| `/daily`     | Claim 200 coins (24h cooldown)          |
| `/weekly`    | Claim 1,000–3,500 coins (7d cooldown)   |
| `/monthly`   | Claim 5,000–15,000 coins (30d cooldown) |
| `/work`      | Earn random salary (1h cooldown)        |
| `/cooldowns` | View all active cooldown timers         |

**Gambling**

| Command                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `/slots <bet>`                   | Spin slot machine                        |
| `/blackjack <bet>`               | Blackjack vs Friday dealer               |
| `/roulette <bet> <color/number>` | Roulette wheel                           |
| `/cockfight <bet>`               | Bet on cockfight arena                   |
| `/coinflip [bet]`                | Heads or Tails with optional wager       |
| `/dice <bet>`                    | Roll two dice — highest total wins       |
| `/highlow <bet>`                 | Guess higher or lower card (chain bonus) |
| `/horse <horse> <bet>`           | Horse race (1–5, odds-based payout)      |
| `/rps [bet]`                     | Rock Paper Scissors vs Friday            |
| `/rob <user>`                    | Rob another member's wallet              |
| `/bankrob <user>`                | Rob another member's bank                |

**Shop & Items**

| Command                           | Description                   | Permission    |
| --------------------------------- | ----------------------------- | ------------- |
| `/shop view`                      | Browse shop listings          | Anyone        |
| `/shop catalog`                   | Browse all server shop items  | Anyone        |
| `/shop add <item> <price> [role]` | Add item                      | Administrator |
| `/shop remove <item>`             | Remove item                   | Administrator |
| `/buy <item>`                     | Purchase from shop            | Anyone        |
| `/sell <item>`                    | Sell loot items for coins     | Anyone        |
| `/use <item>`                     | Use a consumable item         | Anyone        |
| `/inventory [user]`               | View inventory                | Anyone        |

**Market (Player-to-Player)**

| Command                       | Description            |
| ----------------------------- | ---------------------- |
| `/market view`                | Browse active listings |
| `/market list <item> <price>` | List an item for sale  |
| `/market buy <listing-id>`    | Buy a listing          |
| `/market cancel <listing-id>` | Cancel your listing    |

**Trading**

| Command                     | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `/trade <user>`             | Initiate bilateral trade — exchange items/coins |
| `/scramble [answer]`        | Start or answer a word scramble for coins/XP   |

**Stocks**

| Command                             | Description                               |
| ----------------------------------- | ----------------------------------------- |
| `/stock list [market]`              | Browse stocks (NASDAQ, NSE, LSE, Crypto…) |
| `/stock quote <symbol>`             | Detailed real-time quote with price chart |
| `/stock buy <symbol> <shares>`      | Buy long-term investment shares           |
| `/stock sell <symbol> <shares>`     | Sell investment shares                    |
| `/portfolio view [user]`                   | View holdings and intraday positions      |
| `/portfolio open <type> <symbol> <margin>` | Open 5x leveraged LONG/SHORT position     |
| `/portfolio close <symbol>`                | Close an intraday position and settle PnL |

**Gifting**

| Command                       | Description            |
| ----------------------------- | ---------------------- |
| `/gift coins <user> <amount>` | Gift coins             |
| `/gift item <user> <item>`    | Gift an inventory item |

**Pets**

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `/pet adopt <type> [name]` | Adopt a pet (Dog, Cat, Dragon, Fox, Rabbit)          |
| `/pet view`               | View pet stats (hunger, affection, energy, ATK, DEF) |
| `/pet feed`               | Feed your pet (coins or Worm item)                   |
| `/pet train <attribute>`  | Train ATK or DEF (costs 25 energy)                   |
| `/pet rename <name>`      | Give your pet a new name                             |
| `/pet release`            | Release your pet permanently                         |
| `/pet battle <user>`      | Challenge another member's pet                       |

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
| `/modstats [moderator]`            | Moderation action counts             | View Audit Log |
| `/serveractivity`                  | Link to dashboard analytics          | Manage Guild   |
| `/analytics overview`              | High-level economy and XP stats      | Administrator  |
| `/analytics topspenders`           | Top 10 wealthiest members            | Administrator  |
| `/analytics activity <user>`       | Individual member economy summary    | Administrator  |

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
| `/poll create <question> <options> [duration]` | Create a native Discord poll  |
| `/poll close <message-id>`                     | End a running poll early      |
| `/remind <time> <message>`   | Schedule a DM reminder                     |
| `/embed create`              | Interactive embed builder modal            |
| `/urban <term>`              | Urban Dictionary lookup                    |
| `/weather <city>`            | Real-time weather                          |
| `/meme [subreddit]`          | Random meme from Reddit                    |

---

### Custom Commands

| Command                               | Description                     | Permission    |
| ------------------------------------- | ------------------------------- | ------------- |
| `/customcmd add <trigger> <response>` | Create `!trigger` text command  | Administrator |
| `/customcmd embed <trigger>`          | Create trigger that sends embed | Administrator |
| `/customcmd remove <trigger>`         | Delete a custom command         | Administrator |
| `/customcmd list`                     | List all custom commands        | Administrator |

---

### Fun

| Command           | Description                               |
| ----------------- | ----------------------------------------- |
| `/ascii <text>`   | Render text as large ASCII block letters  |
| `/mock <text>`    | SpongeBob alternating-case mocking format |
| `/reverse <text>` | Reverse input text backwards              |

---

### Games

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `/trivia [category]` | Answer a timed trivia question for coins and XP    |

---

### Social

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `/profile [user]`    | View full social and economy profile card             |
| `/bio [text]`        | Set or view your custom profile bio tagline           |
| `/rep <user>`        | Give a reputation point (once every 24 hours)         |
| `/marry propose/divorce` | Propose marriage or divorce a current partner     |

---

### Clans

| Command                           | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `/clan create <name>`             | Found a new clan (costs 5,000 coins)         |
| `/clan invite <user>`             | Invite a member (owner only)                 |
| `/clan join <name>`               | Join a clan you were invited to              |
| `/clan leave`                     | Leave your current clan                      |
| `/clan kick <user>`               | Kick a member (owner only)                   |
| `/clan info [name]`               | View clan roster and stats                   |
| `/clan deposit <amount>`          | Contribute coins to the clan treasury        |
| `/clan leaderboard`               | Top clans by treasury wealth                 |

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
