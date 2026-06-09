const {
 SlashCommandBuilder,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { getEmoji } = require('../../utils/emojis');
const { rollBonusDrop } = require('../../utils/drops');

const WOOD_CHANCES = [
 { name: 'Pine Log',       chance: 0.35, msg: 'You chopped down a slender pine and gathered a **Pine Log**.' },
 { name: 'Oak Log',        chance: 0.60, msg: 'You split a sturdy oak and gathered an **Oak Log**.' },
 { name: 'Birch Log',      chance: 0.78, msg: 'You fell a silver birch and gathered a **Birch Log**.' },
 { name: 'Mahogany Log',   chance: 0.90, msg: 'Excellent swing! You harvested a rare **Mahogany Log**.' },
 { name: 'Yew Log',        chance: 0.96, msg: 'Beautiful chop! You acquired a solid **Yew Log**.' },
 { name: 'Elderwood Log',  chance: 0.992, msg: '**AMAZING!** You chopped a magical **Elderwood Log**!' },
 { name: 'Golden Sap',     chance: 1.00,  msg: '**UNBELIEVABLE!** You pierced a sacred elder tree and extracted glowing **Golden Sap**!' }
];

module.exports = {
 data: new SlashCommandBuilder()
  .setName('chop')
  .setDescription('Chop wood in the forest for logs. Requires an Axe from the shop.'),

 async execute(interaction) {
  const { guild, user } = interaction;
  if (!guild) return;

  const cd = checkCooldown('chop', user.id, 45);
  if (cd.onCooldown) {
   return interaction.editReply({ content: `Your arms are sore from chopping! Wait **${cd.remaining}s** before swinging again.`, ephemeral: true });
  }

  try {
   const inventory = await db.getInventory(guild.id, user.id);
   const hasAxe = inventory.some(item => item.toLowerCase() === 'axe');

   if (!hasAxe) {
    return interaction.editReply({ content: 'You do not own an **Axe**! Purchase one from the shop using `/buy`.', ephemeral: true });
   }

   const roll = Math.random();
   const reward = WOOD_CHANCES.find(loot => roll <= loot.chance);
   await db.addItemToInventory(guild.id, user.id, reward.name);
   await db.incrementQuestProgress(guild.id, user.id, 'chop', reward.name, 1);
   const bonus = await rollBonusDrop(guild.id, user.id);

   const container = new ContainerBuilder()
    .addSectionComponents(
     new SectionBuilder()
      .addTextDisplayComponents(
       new TextDisplayBuilder().setContent(`## Forest Woodcutting\n${reward.msg}`)
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**Harvest Stored:** Added ${getEmoji(reward.name)} **${reward.name}** to your inventory${bonus ? bonus.line : ''}\n` +
      `-# Use \`/sell\` to cash it in!`
     )
    );

   await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

  } catch (err) {
   console.error('[CHOP ERROR]', err);
   const errMsg = { content: 'Failed to execute woodcutting expedition.', ephemeral: true };
   if (interaction.replied || interaction.deferred) await interaction.followUp(errMsg).catch(() => null);
   else await interaction.editReply(errMsg).catch(() => null);
  }
 }
};
