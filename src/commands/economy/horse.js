const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

const HORSES = [
 { id: 1, name: 'Thunderbolt',  odds: 1.8, winChance: 0.38, label: 'Favourite'  },
 { id: 2, name: 'Silver Arrow', odds: 2.5, winChance: 0.25, label: 'Contender'  },
 { id: 3, name: 'Dark Phantom', odds: 3.5, winChance: 0.17, label: 'Longshot'   },
 { id: 4, name: 'Lucky Charm',  odds: 4.5, winChance: 0.12, label: 'Outsider'   },
 { id: 5, name: 'Iron Hoof',    odds: 6.0, winChance: 0.08, label: 'Dark Horse'  },
];

const RACE_EVENTS = [
 '{name} rockets out of the gate and takes an early lead!',
 '{name} stumbles on the first turn but quickly recovers!',
 '{name} is neck-and-neck with the pack at the halfway mark!',
 '{name} surges forward with a powerful stride on the back straight!',
 '{name} is falling behind — the jockey cracks the whip!',
 '{name} pulls away cleanly entering the final stretch!',
 '{name} is boxed in by two other horses rounding the bend!',
 '{name} digs deep and finds another gear in the final furlong!',
];

function pickWinner() {
 const roll = Math.random();
 let cumulative = 0;
 for (const horse of HORSES) {
  cumulative += horse.winChance;
  if (roll < cumulative) return horse;
 }
 return HORSES[HORSES.length - 1];
}

function generateRaceNarrative(pickedHorse, winner) {
 const events = RACE_EVENTS.sort(() => Math.random() - 0.5).slice(0, 3);
 const lines = events.map(e => `• ${e.replace('{name}', `**${pickedHorse.name}**`)}`);
 lines.push(`**${winner.name}** crosses the finish line first!`);
 return lines.join('\n');
}

module.exports = {
 data: new SlashCommandBuilder()
  .setName('horse')
  .setDescription('Bet on a horse race. Higher odds = bigger payout but lower win chance.')
  .addIntegerOption(opt =>
   opt.setName('horse')
    .setDescription('Pick your horse (1–5)')
    .setRequired(true)
    .setMinValue(1)
    .setMaxValue(5))
  .addIntegerOption(opt =>
   opt.setName('bet')
    .setDescription('The amount of coins to wager')
    .setRequired(true)
    .setMinValue(1)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const horseId = options.getInteger('horse');
  const bet = options.getInteger('bet');

  const cd = await checkCooldown('horse', user.id, 10);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `The next race hasn't started yet. Try again in **${cd.remaining}s**.`, ephemeral: true });
  }

  try {
   const profile = await db.getProfile(guild.id, user.id);
   if (profile.coins < bet) {
    return interaction.editReply({
     content: `Insufficient balance! You only have ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins.`,
     ephemeral: true
    });
   }

   const picked = HORSES[horseId - 1];
   await db.updateCoins(guild.id, user.id, -bet);

   const winner = pickWinner();
   const playerWon = winner.id === picked.id;
   const payout = playerWon ? Math.floor(bet * picked.odds) : 0;
   if (playerWon) await db.updateCoins(guild.id, user.id, payout);

   const finalProfile = await db.getProfile(guild.id, user.id);
   const narrative = generateRaceNarrative(picked, winner);
   const color = playerWon ? 0xFFD700 : 0xFF3333;

   const horseListLines = HORSES.map(h =>
    `${h.id === picked.id ? '**→** ' : '     '} #${h.id} **${h.name}** — ${h.odds}× odds *(${h.label})*`
   ).join('\n');

   const resultLine = playerWon
    ? `**Your horse won!** You collected ${EMOJIS.coin} **${payout.toLocaleString()}** coins at **${picked.odds}×** odds!`
    : `**${winner.name}** won the race. You lost ${EMOJIS.coin} **${bet.toLocaleString()}** coins.`;

   const container = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(
        `## Horse Race\n**Your Pick:** #${picked.id} **${picked.name}** (${picked.odds}× odds)`
       )
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(horseListLines)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`**Race Commentary:**\n${narrative}`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `${resultLine}\n**Wallet:** ${EMOJIS.coin} **${finalProfile.coins.toLocaleString()}**`
     )
    )
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent('-# Odds: Favourite 1.8× · Contender 2.5× · Longshot 3.5× · Outsider 4.5× · Dark Horse 6×')
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[HORSE ERROR]', err);
   const errMsg = { content: 'Failed to process horse race.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
