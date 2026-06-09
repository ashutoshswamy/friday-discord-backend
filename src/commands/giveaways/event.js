const {
 SlashCommandBuilder, PermissionFlagsBits,
 ButtonBuilder, ActionRowBuilder, ButtonStyle,
 ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
 SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('event')
 .setDescription('Manage server events and scheduled activities.')
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .addSubcommand(sub =>
 sub.setName('create')
 .setDescription('Deploy a guild event RSVP card.')
 .addStringOption(opt => opt.setName('title').setDescription('Event title / heading').setRequired(true))
 .addStringOption(opt => opt.setName('description').setDescription('Context details of the event').setRequired(true))
 .addStringOption(opt => opt.setName('date').setDescription('Time and date (e.g. Tomorrow at 8 PM)').setRequired(true))
 .addStringOption(opt => opt.setName('location').setDescription('Voice channel or physical location').setRequired(true))),

 async execute(interaction) {
 const { guild, channel, options, client } = interaction;
 if (!guild || !channel) return;

 const subcommand = options.getSubcommand();
 client.events = client.events || new Map();

 try {
 if (subcommand === 'create') {
 const title = options.getString('title');
 const desc = options.getString('description');
 const date = options.getString('date');
 const location = options.getString('location');

 await interaction.editReply({ content: 'Deploying event card...', ephemeral: true });

 const iconUrl = guild.iconURL({ forceStatic: true });

 const container = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Guild Event: ${title}\n${desc}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Date / Time:** \`${date}\`\n **Location:** \`${location}\`\n **RSVPs:** *No one yet*`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setCustomId('event_rsvp_TEMP')
 .setLabel('RSVP / Attend')
 .setStyle(ButtonStyle.Success)
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Click the button above to RSVP for this event`)
 );

 const msg = await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });

 const realContainer = new ContainerBuilder()
 .addSectionComponents(
 new SectionBuilder()
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`## Guild Event: ${title}\n${desc}`)
 )
 .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'))
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(
 `**Date / Time:** \`${date}\`\n **Location:** \`${location}\`\n **RSVPs:** *No one yet*`
 )
 )
 .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
 .addActionRowComponents(
 new ActionRowBuilder().addComponents(
 new ButtonBuilder()
 .setCustomId(`event_rsvp_${msg.id}`)
 .setLabel('RSVP / Attend')
 .setStyle(ButtonStyle.Success)
 )
 )
 .addTextDisplayComponents(
 new TextDisplayBuilder().setContent(`-# Click the button above to RSVP for this event`)
 );

 await msg.edit({ flags: MessageFlags.IsComponentsV2, components: [realContainer] });

 client.events.set(msg.id, {
 messageId: msg.id,
 guildId: guild.id,
 title,
 desc,
 date,
 location,
 rsvps: new Set()
 });

 await db.saveEvent(guild.id, channel.id, msg.id, title, desc, date, location);
 }
 } catch (err) {
 console.error('[EVENT CREATE ERROR]', err);
 const _errMsg = { content: 'Failed to deploy server event.', ephemeral: true };
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp(_errMsg).catch(() => null);
 } else {
 await interaction.editReply(_errMsg).catch(() => null);
 }
 }
 }
};
