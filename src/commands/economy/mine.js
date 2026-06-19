const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');
const { rollBonusDrop } = require('../../utils/drops');
const { checkCooldown } = require('../../utils/cooldowns');

const LOOT_CHANCES = [
 { name: 'Coal',          chance: 0.30, msg: 'You chipped away at the cave wall and extracted a rough chunk of **Coal**.' },
 { name: 'Iron Ore',      chance: 0.52, msg: 'Your pickaxe struck a vein — you pried out a solid chunk of **Iron Ore**.' },
 { name: 'Gold Ore',      chance: 0.68, msg: 'A glint in the stone caught your eye — you pulled free a chunk of **Gold Ore**!' },
 { name: 'Quartz Crystal',chance: 0.80, msg: 'You uncovered a sparkling **Quartz Crystal** embedded deep in the rock face.' },
 { name: 'Emerald',       chance: 0.89, msg: '**NICE FIND!** A brilliant green **Emerald** rolled out from a crack in the stone!' },
 { name: 'Ruby Shard',    chance: 0.95, msg: '**RARE!** A deep crimson **Ruby Shard** shattered free from the rock wall!' },
 { name: 'Diamond Ore',   chance: 0.985, msg: '**JACKPOT!** You unearthed a priceless chunk of **Diamond Ore** buried in the deep rock!' },
 { name: 'Crystal Shard', chance: 0.997, msg: '**ULTRA RARE!** A luminous **Crystal Shard** pulsed with strange energy as you pried it free!' },
 { name: 'Mythril Core',  chance: 1.00,  msg: '**LEGENDARY!** Deep in the earth you discovered a **Mythril Core** — a near-mythical mineral of impossible purity!' }
];

module.exports = {
 data: new SlashCommandBuilder()
  .setName('mine')
  .setDescription('Descend into the mine shaft and excavate rare ores. Requires a Pickaxe from the shop.'),

 async execute(interaction) {
  const { guild, user } = interaction;
  if (!guild) return;

  const cd = await checkCooldown('mine', user.id, 60);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `Your arms are tired from swinging! Wait **${cd.remaining}s** before mining again.`, ephemeral: true });
  }

  try {
   const inventory = await db.getInventory(guild.id, user.id);
   const hasPickaxe = inventory.some(item => item.toLowerCase() === 'pickaxe');

   if (!hasPickaxe) {
    return interaction.editReply({ content: 'You do not own a **Pickaxe**! Purchase one from the shop using `/buy`.', ephemeral: true });
   }

   const roll = Math.random();
   const reward = LOOT_CHANCES.find(loot => roll <= loot.chance);
   await db.addItemToInventory(guild.id, user.id, reward.name);
   await db.incrementQuestProgress(guild.id, user.id, 'mine', reward.name, 1);
   const bonus = await rollBonusDrop(guild.id, user.id);

   const container = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(`## Mining Expedition\n${reward.msg}`)
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**Ore Extracted:** Added ${getEmoji(reward.name)} **${reward.name}** to your inventory${bonus ? bonus.line : ''}\n` +
      `-# Use \`/sell\` to cash it in at the merchant!`
     )
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[MINE ERROR]', err);
   const errMsg = { content: 'Failed to execute mining expedition.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
