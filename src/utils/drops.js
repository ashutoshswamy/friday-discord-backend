/**
 * Shared rare bonus-drop logic for grind commands (hunt, fish, dig, mine, chop).
 * On top of the guaranteed loot roll, a small chance to also drop a consumable.
 */
const { getEmoji } = require('./emojis');
const db = require('./db');

const BONUS_DROPS = [
 { name: 'Coin Bomb',    chance: 0.02, msg: 'a ticking **Coin Bomb**' },
 { name: 'Mystery Crate', chance: 0.01, msg: 'a sealed **Mystery Crate**' }
];

/**
 * Rolls for a rare bonus drop and, if won, adds it to the user's inventory.
 * @returns {Promise<{name: string, line: string}|null>}
 */
async function rollBonusDrop(guildId, userId) {
 for (const drop of BONUS_DROPS) {
  if (Math.random() < drop.chance) {
   await db.addItemToInventory(guildId, userId, drop.name);
   return {
    name: drop.name,
    line: `\n **Bonus Drop!** You also found ${getEmoji(drop.name)} ${drop.msg} — open it with \`/use\`!`
   };
  }
 }
 return null;
}

module.exports = { rollBonusDrop, BONUS_DROPS };
