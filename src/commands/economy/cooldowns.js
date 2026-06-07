const {
 SlashCommandBuilder,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getCooldownRemaining } = require('../../utils/cooldowns');

const UTILITY_COMMANDS = ['slots', 'blackjack', 'roulette', 'dice', 'highlow', 'horse', 'cockfight', 'scramble', 'beg', 'trivia'];

function formatMs(ms) {
 if (ms <= 0) return null;
 const totalSec = Math.ceil(ms / 1000);
 const h = Math.floor(totalSec / 3600);
 const m = Math.floor((totalSec % 3600) / 60);
 const s = totalSec % 60;
 if (h > 0) return `${h}h ${m}m`;
 if (m > 0) return `${m}m ${s}s`;
 return `${s}s`;
}

function cooldownLine(label, remainingMs) {
 const fmt = formatMs(remainingMs);
 return fmt ? `🔴 **${label}** — ${fmt} remaining` : `🟢 **${label}** — Ready`;
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('cooldowns')
  .setDescription('View all your active command cooldown timers in one panel.'),

 async execute(interaction) {
  const { guild, user } = interaction;
  if (!guild) return;

  try {
   const profile = await db.getProfile(guild.id, user.id);
   const now = Date.now();

   const workRemaining = Math.max(0, (profile.workCooldown + 3600000) - now);
   const dailyRemaining = Math.max(0, (profile.dailyCooldown + 86400000) - now);
   const weeklyRemaining = Math.max(0, (profile.weeklyCooldown + 604800000) - now);
   const monthlyRemaining = Math.max(0, (profile.monthlyCooldown + 2592000000) - now);

   const dbLines = [
    cooldownLine('Daily', dailyRemaining),
    cooldownLine('Weekly', weeklyRemaining),
    cooldownLine('Monthly', monthlyRemaining),
    cooldownLine('Work', workRemaining),
   ].join('\n');

   const utilityLines = UTILITY_COMMANDS.map(cmd => {
    const remaining = getCooldownRemaining(cmd, user.id);
    return cooldownLine(`/${cmd}`, remaining);
   }).join('\n');

   const container = new ContainerBuilder()
    .setAccentColor(0x8B5CF6)
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`## Your Active Cooldowns`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`**Economy & Wages**\n${dbLines}`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`**Games & Activities**\n${utilityLines}`)
    )
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent('-# Activity cooldowns (hunt, fish, dig, mine) show on the command itself')
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[COOLDOWNS ERROR]', err);
   const errMsg = { content: 'Failed to retrieve cooldown data.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
