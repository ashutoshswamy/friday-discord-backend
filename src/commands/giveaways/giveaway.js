const {
 SlashCommandBuilder, PermissionFlagsBits,
 ButtonBuilder, ActionRowBuilder, ButtonStyle,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

function parseDuration(timeStr) {
 const regex = /^(\d+)([smh])$/;
 const match = timeStr.match(regex);
 if (!match) return null;
 const value = parseInt(match[1]);
 const unit = match[2];
 if (unit === 's') return value * 1000;
 if (unit === 'm') return value * 60 * 1000;
 if (unit === 'h') return value * 60 * 60 * 1000;
 return null;
}

function buildGiveawayContainer(prize, winnersCount, endUnix, entrantCount = 0, active = true) {
 const container = new ContainerBuilder()
 .setAccentColor(0xFF0099)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## 🎉 GIVEAWAY${active ? '' : ' ENDED'} \n` +
 `**Prize:** **${prize}**\n` +
 `**Winners:** ${winnersCount}\n` +
 (active
 ? `**Ends:** <t:${endUnix}:R> (at <t:${endUnix}:f>)\n\n-# Click the button below to enter the draw!`
 : `**Total Entries:** ${entrantCount}`)
 )
 );

 if (active) {
 container.addActionRowComponents(
 new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setCustomId('giveaway_join_PLACEHOLDER')
 .setLabel('🎉 Enter Draw')
 .setStyle(ButtonStyle.Primary)
 )
 );
 } else {
 container.addActionRowComponents(
 new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setCustomId('giveaway_ended_placeholder')
 .setLabel('Closed')
 .setStyle(ButtonStyle.Secondary)
 .setDisabled(true)
 )
 );
 }

 return container;
}

module.exports = {
 data: new SlashCommandBuilder()
 .setName('giveaway')
 .setDescription('Create and manage server giveaways.')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .addSubcommand(sub =>
 sub.setName('start')
 .setDescription('Launch a new interactive giveaway with button entries.')
 .addStringOption(opt => opt.setName('duration').setDescription('Giveaway duration (e.g. 30s, 5m, 2h)').setRequired(true))
 .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners to draw').setRequired(true).setMinValue(1))
 .addStringOption(opt => opt.setName('prize').setDescription('The prize item being offered').setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('end')
 .setDescription('Immediately close a running giveaway and draw winners.')
 .addStringOption(opt => opt.setName('id').setDescription('The Message ID of the active giveaway').setRequired(true)))
 .addSubcommand(sub =>
 sub.setName('reroll')
 .setDescription('Select new winners from the participants of an ended giveaway.')
 .addStringOption(opt => opt.setName('id').setDescription('The Message ID of the ended giveaway').setRequired(true))),

 async execute(interaction) {
 const { guild, channel, options, client } = interaction;
 if (!guild || !channel) return;

 const subcommand = options.getSubcommand();
 const id = options.getString('id');

 client.giveaways = client.giveaways || new Map();

 try {
 if (subcommand === 'start') {
 const durationInput = options.getString('duration').trim().toLowerCase();
 const winnersCount = options.getInteger('winners');
 const prize = options.getString('prize');

 const durationMs = parseDuration(durationInput);
 if (!durationMs || durationMs < 10000) {
 return interaction.editReply({
 content: 'Invalid duration! Use formats like `30s` (30 seconds), `5m` (5 minutes), or `2h` (2 hours). Minimum duration is 10 seconds.',
 ephemeral: true
 });
 }

 const endUnix = Math.floor((Date.now() + durationMs) / 1000);

 const container = buildGiveawayContainer(prize, winnersCount, endUnix, 0, true);

 await interaction.editReply({ content: 'Starting giveaway...', ephemeral: true });

 const msg = await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });

 const realContainer = new ContainerBuilder()
 .setAccentColor(0xFF0099)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## 🎉 GIVEAWAY \n**Prize:** **${prize}**\n**Winners:** ${winnersCount}\n**Ends:** <t:${endUnix}:R> (at <t:${endUnix}:f>)\n\n-# Click the button below to enter the draw!`
 )
 )
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setCustomId(`giveaway_join_${msg.id}`)
 .setLabel('🎉 Enter Draw')
 .setStyle(ButtonStyle.Primary)
 )
 );

 await msg.edit({ flags: MessageFlags.IsComponentsV2, components: [realContainer] });

 client.giveaways.set(msg.id, {
 messageId: msg.id,
 channelId: channel.id,
 guildId: guild.id,
 prize,
 winnersCount,
 entrants: new Set(),
 active: true,
 timer: setTimeout(() => endGiveaway(msg.id), durationMs)
 });

 await db.saveGiveaway(guild.id, channel.id, msg.id, prize, winnersCount);
 return;
 }

 if (subcommand === 'end') {
 if (!client.giveaways.has(id)) {
 return interaction.editReply({ content: 'Could not find an active giveaway matching that message ID!', ephemeral: true });
 }

 await interaction.editReply({ content: 'Closing giveaway and drawing winners...', ephemeral: true });
 endGiveaway(id);
 return;
 }

 if (subcommand === 'reroll') {
 if (!client.giveaways.has(id)) {
 return interaction.editReply({ content: 'No recorded participants found for that giveaway ID in memory!', ephemeral: true });
 }

 const giveaway = client.giveaways.get(id);
 const entrantsArray = Array.from(giveaway.entrants);

 if (entrantsArray.length === 0) {
 return interaction.editReply({ content: 'No one entered the giveaway, so it cannot be re-rolled!', ephemeral: true });
 }

 const shuffled = entrantsArray.sort(() => 0.5 - Math.random());
 const winners = shuffled.slice(0, giveaway.winnersCount);
 const winnerPings = winners.map(w => `<@${w}>`).join(', ');

 const rerollContainer = new ContainerBuilder()
 .setAccentColor(0xFF0099)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## 🎉 GIVEAWAY RE-ROLLED! \n**Prize:** **${giveaway.prize}**\n**New Winners:** ${winnerPings}!\n\nCongratulations on your victory!`
 )
 );

 await channel.send({
 content: `Congratulations ${winnerPings}! You won the re-roll for **${giveaway.prize}**!`,
 flags: MessageFlags.IsComponentsV2,
 components: [rerollContainer]
 });
 return interaction.editReply({ content: 'Giveaway successfully re-rolled!', ephemeral: true });
 }

 async function endGiveaway(messageId) {
 if (!client.giveaways.has(messageId)) return;
 const giveaway = client.giveaways.get(messageId);

 if (!giveaway.active) return;
 giveaway.active = false;
 clearTimeout(giveaway.timer);

 const targetChannel = await client.channels.fetch(giveaway.channelId).catch(() => null);
 if (!targetChannel) return;

 const message = await targetChannel.messages.fetch(messageId).catch(() => null);
 if (!message) return;

 const entrantsArray = Array.from(giveaway.entrants);
 const disabledRow = new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setCustomId(`giveaway_ended_${messageId}`)
 .setLabel('Closed')
 .setStyle(ButtonStyle.Secondary)
 .setDisabled(true)
 );

 if (entrantsArray.length === 0) {
 const endedContainer = new ContainerBuilder()
 .setAccentColor(0x71717A)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## 🎉 GIVEAWAY ENDED \n**Prize:** **${giveaway.prize}**\n\n **Draw Cancelled:**No valid entrants participated in the draw.`
 )
 )
 .addActionRowComponents(disabledRow);

 await message.edit({ flags: MessageFlags.IsComponentsV2, components: [endedContainer] });
 await db.endGiveaway(messageId, [], 0);
 return;
 }

 const shuffled = entrantsArray.sort(() => 0.5 - Math.random());
 const winners = shuffled.slice(0, giveaway.winnersCount);
 const winnerPings = winners.map(w => `<@${w}>`).join(', ');

 const resultsContainer = new ContainerBuilder()
 .setAccentColor(0xFF0099)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## 🎉 GIVEAWAY RESULTS \n**Prize Won:** **${giveaway.prize}**\n**Winners:** ${winnerPings}!\n\nThank you everyone for participating!`
 )
 )
 .addActionRowComponents(disabledRow);

 const winnerContainer = new ContainerBuilder()
 .setAccentColor(0xFFD700)
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `## 🎉 Congratulations!\n${winnerPings} won the **${giveaway.prize}** giveaway!`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Prize:** ${giveaway.prize}\n **Total Entries:** ${entrantsArray.length}\n **Winners:** ${winnerPings}`
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Giveaway ID: ${messageId}`)
 );

 await message.edit({ flags: MessageFlags.IsComponentsV2, components: [resultsContainer] });
 await targetChannel.send({
 content: `Congratulations ${winnerPings}! You won **${giveaway.prize}**!`,
 flags: MessageFlags.IsComponentsV2,
 components: [winnerContainer],
 reply: { messageReference: messageId }
 });
 await db.endGiveaway(messageId, winners, entrantsArray.length);
 }

 } catch (err) {
 console.error('[GIVEAWAY ERROR]', err);
 const _errMsg = { content: 'Failed to process giveaway operation.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
