/**
 * Friday Brand Custom Emojis
 */

const EMOJIS = {
  coin: '<:coin:1512926963239489606>',

  // Tools
  pickaxe: '<:fridaypickaxe:1513592060471541800>',
  axe: '<:fridayaxe:1513592544200495225>',
  'fishing pole': '<:fridayfishingpole:1513593530566709288>',
  shovel: '<:fridayshovel:1513593559893278770>',
  'hunting rifle': '<:fridayhuntingrifle:1513594003189137578>',
  'hacker laptop': '<:fridayhackerlaptop:1513594577456463922>',

  // Seeds
  'wheat seed': '<:fridaywheatseed:1513601451358687312>',
  'tomato seed': '<:fridaytomatoseed:1513601449064399019>',
  'carrot seed': '<:fridaycarrotseed:1513601427069599835>',
  'golden apple seed': '<:fridaygoldenappleseed:1513601436380954845>',

  // Consumables & Upgrades
  pizza: '<:fridaypizza:1513601446778507324>',
  'xp potion': '<:fridayxppotion:1513601455691399360>',
  'energy drink': '<:fridayenergydrink:1513601431683469453>',
  'gamer energy drink': '<:fridaygamerenergydrink:1513601433910644906>',
  lootbox: '<:fridaylootbox:1513601440336052364>',
  'prize box': '<:fridaylootbox:1513601440336052364>', // maps to lootbox emoji
  'mystery crate': '<:fridaymysterycrate:1513601442533871828>',
  'work gloves': '<:fridayworkgloves:1513601453632262194>',
  'coin bomb': '<:fridaycoinbomb:1513601429531660431>',
  'basic fertilizer': '<:fridaybasicfertilizer:1513601424716726452>',
  'growth serum': '<:fridaygrowthserum:1513601438230642948>',
  'yield booster': '<:fridayyieldbooster:1513601457952264342>',
  pesticide: '<:fridaypesticide:1513601444647800853>',

  // Fish
  'junk seaweed': '<:fridayjunkseaweed:1513627813557698560>',
  'old boot': '<:fridayoldboot:1513627831043620894>',
  clam: '<:fridayclam:1513627731605192785>',
  'common bass': '<:fridaycommonbass:1513627733559611554>',
  salmon: '<:fridaysalmon:1513627856851304488>',
  pufferfish: '<:fridaypufferfish:1513627840300453932>',
  goldfish: '<:fridaygoldfish:1513627781777592460>',
  'tropical coral fish': '<:fridaytropicalcoralfish:1513627877671698614>',
  lobster: '<:fridaylobster:1513627819295506513>',
  'shark tooth': '<:fridaysharktooth:1513627862446641404>',
  'ancient pearl': '<:fridayancientpearl:1513627721257844807>',
  'mythical whale': '<:fridaymysticalwhale:1513627824345321672>',

  // Hunt
  rabbit: '<:fridayrabbit:1513627847590285494>',
  'eagle feather': '<:fridayeaglefeather:1513627762945036558>',
  duck: '<:fridayduck:1513627759753166929>',
  deer: '<:fridaydeer:1513627746432061681>',
  'deer antler': '<:fridaydeerantler:1513627748495790262>',
  'wild boar': '<:fridaywildboar:1513627879831765176>',
  'wolf pelt': '<:fridaywolfpelt:1513627881937440909>',
  'grizzly bear': '<:fridaygrizzlybear:1513627799104131192>',
  'dragon scale': '<:fridaydragonscale:1513627757731647529>',

  // Dig
  'common worm': '<:fridaycommonworm:1513627737825345536>',
  'old coin': '<:fridayoldcoin:1513627833740693635>',
  'cracked geode': '<:fridaycrackedgeode:1513627739943604234>',
  'dirt fossil': '<:fridaydirtfossil:1513627755307077663>',
  'ancient vase': '<:fridayancientvase:1513627724160176173>',
  sapphire: '<:fridaysapphire:1513627860416331921>',
  ruby: '<:fridayruby:1513627852740755457>',
  diamond: '<:fridaydiamond:1513627750597136396>',
  'buried gold chest': '<:fridayburiedchest:1513627729277358221>',

  // Mine
  coal: '<:fridaycoal:1513630946535145675>',
  'iron ore': '<:fridayironore:1513627810974007457>',
  'gold ore': '<:fridaygoldore:1513627793647206722>',
  'quartz crystal': '<:fridayquartzcrystal:1513627844884959262>',
  emerald: '<:fridayemerald:1513627777226768497>',
  'ruby shard': '<:fridayrubyshard:1513627854921928764>',
  'diamond ore': '<:fridaydiamondore:1513627752744616116>',
  'crystal shard': '<:fridaycrystalshard:1513627742074175719>',
  'mythril core': '<:fridaymythrilcore:1513627826815893685>',

  // Chop
  'pine log': '<:fridaypinelog:1513627836320317675>',
  'oak log': '<:fridayoaklog:1513627828380500029>',
  'birch log': '<:fridaybirchlog:1513627726635077865>',
  'mahogany log': '<:fridaymahoganylog:1513630782042935498>',
  'yew log': '<:fridayyewlog:1513627883900240042>',
  'elderwood log': '<:fridayelderwoodlog:1513627775116775616>',
  'golden sap': '<:fridaygoldensap:1513627779701145782>',

  // Hack
  'decrypted hard drive': '<:fridaydecryptedharddrive:1513627744141840526>',
  'mainframe core': '<:fridaymainframecore:1513627821619281940>',
  'stolen crypto key': '<:fridaystolencryptokey:1513627875260240034>',

  // Farm Harvests
  'harvested wheat': '<:fridayharvestedwheat:1513627808130269244>',
  'silver harvested wheat': '<:fridaysilverharvestedwheat:1513627871262937168>',
  'gold harvested wheat': '<:fridaygoldharvestedwheat:1513627791512309840>',
  'harvested tomato': '<:fridayharvestedtomato:1513627805936652360>',
  'silver harvested tomato': '<:fridaysilverharvestedtomato:1513627869144940714>',
  'gold harvested tomato': '<:fridaygoldharvestedtomato:1513627789398380644>',
  'harvested carrot': '<:fridayharvestedcarrot:1513627801868046336>',
  'silver harvested carrot': '<:fridaysilverharvestedcarrot:1513627864988385391>',
  'gold harvested carrot': '<:fridaygoldharvestedcarrot:1513627784335982713>',
  'harvested golden apple': '<:fridayharvestedgoldenapple:1513627803902545970>',
  'silver harvested golden apple': '<:fridaysilverharvestedgoldenapple:1513627867022364672>',
  'gold harvested golden apple': '<:fridaygoldharvestedgoldenapple:1513627786890317944>',

  // Collectibles
  'common gem': '<:fridaycommongem:1513627735610884157>',
  'silver ring': '<:fridaysilverring:1513627873431261304>',
  'rare gem': '<:fridayraregem:1513627850312253652>',
  'legendary gem': '<:fridaylegendarygem:1513627817081045143>'
};

const EMOJI_IDS = {
  coin: '1512926963239489606',

  // Tools
  pickaxe: '1513592060471541800',
  axe: '1513592544200495225',
  'fishing pole': '1513593530566709288',
  shovel: '1513593559893278770',
  'hunting rifle': '1513594003189137578',
  'hacker laptop': '1513594577456463922',

  // Seeds
  'wheat seed': '1513601451358687312',
  'tomato seed': '1513601449064399019',
  'carrot seed': '1513601427069599835',
  'golden apple seed': '1513601436380954845',

  // Consumables & Upgrades
  pizza: '1513601446778507324',
  'xp potion': '1513601455691399360',
  'energy drink': '1513601431683469453',
  'gamer energy drink': '1513601433910644906',
  lootbox: '1513601440336052364',
  'prize box': '1513601440336052364',
  'mystery crate': '1513601442533871828',
  'work gloves': '1513601453632262194',
  'coin bomb': '1513601429531660431',
  'basic fertilizer': '1513601424716726452',
  'growth serum': '1513601438230642948',
  'yield booster': '1513601457952264342',
  pesticide: '1513601444647800853',

  // Fish
  'junk seaweed': '1513627813557698560',
  'old boot': '1513627831043620894',
  clam: '1513627731605192785',
  'common bass': '1513627733559611554',
  salmon: '1513627856851304488',
  pufferfish: '1513627840300453932',
  goldfish: '1513627781777592460',
  'tropical coral fish': '1513627877671698614',
  lobster: '1513627819295506513',
  'shark tooth': '1513627862446641404',
  'ancient pearl': '1513627721257844807',
  'mythical whale': '1513627824345321672',

  // Hunt
  rabbit: '1513627847590285494',
  'eagle feather': '1513627762945036558',
  duck: '1513627759753166929',
  deer: '1513627746432061681',
  'deer antler': '1513627748495790262',
  'wild boar': '1513627879831765176',
  'wolf pelt': '1513627881937440909',
  'grizzly bear': '1513627799104131192',
  'dragon scale': '1513627757731647529',

  // Dig
  'common worm': '1513627737825345536',
  'old coin': '1513627833740693635',
  'cracked geode': '1513627739943604234',
  'dirt fossil': '1513627755307077663',
  'ancient vase': '1513627724160176173',
  sapphire: '1513627860416331921',
  ruby: '1513627852740755457',
  diamond: '1513627750597136396',
  'buried gold chest': '1513627729277358221',

  // Mine
  coal: '1513630946535145675',
  'iron ore': '1513627810974007457',
  'gold ore': '1513627793647206722',
  'quartz crystal': '1513627844884959262',
  emerald: '1513627777226768497',
  'ruby shard': '1513627854921928764',
  'diamond ore': '1513627752744616116',
  'crystal shard': '1513627742074175719',
  'mythril core': '1513627826815893685',

  // Chop
  'pine log': '1513627836320317675',
  'oak log': '1513627828380500029',
  'birch log': '1513627726635077865',
  'mahogany log': '1513630782042935498',
  'yew log': '1513627883900240042',
  'elderwood log': '1513627775116775616',
  'golden sap': '1513627779701145782',

  // Hack
  'decrypted hard drive': '1513627744141840526',
  'mainframe core': '1513627821619281940',
  'stolen crypto key': '1513627875260240034',

  // Farm Harvests
  'harvested wheat': '1513627808130269244',
  'silver harvested wheat': '1513627871262937168',
  'gold harvested wheat': '1513627791512309840',
  'harvested tomato': '1513627805936652360',
  'silver harvested tomato': '1513627869144940714',
  'gold harvested tomato': '1513627789398380644',
  'harvested carrot': '1513627801868046336',
  'silver harvested carrot': '1513627864988385391',
  'gold harvested carrot': '1513627784335982713',
  'harvested golden apple': '1513627803902545970',
  'silver harvested golden apple': '1513627867022364672',
  'gold harvested golden apple': '1513627786890317944',

  // Collectibles
  'common gem': '1513627735610884157',
  'silver ring': '1513627873431261304',
  'rare gem': '1513627850312253652',
  'legendary gem': '1513627817081045143'
};

function getEmoji(itemName) {
  if (!itemName) return '';
  const key = itemName.toLowerCase().trim();
  return EMOJIS[key] || '';
}

function getEmojiId(itemName) {
  if (!itemName) return null;
  const key = itemName.toLowerCase().trim();
  return EMOJI_IDS[key] || null;
}

module.exports = {
  EMOJIS,
  EMOJI_IDS,
  getEmoji,
  getEmojiId
};
