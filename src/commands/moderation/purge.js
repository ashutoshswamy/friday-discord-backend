const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
 .setName('purge')
 .setDescription('Bulk deletes messages in the current channel with optional filtering.')
 .addIntegerOption(option => 
 option.setName('amount')
 .setDescription('Number of messages to delete (1-100)')
 .setMinValue(1)
 .setMaxValue(100)
 .setRequired(true))
 .addStringOption(option => 
 option.setName('filter')
 .setDescription('Optional filter to apply to the message purge')
 .setRequired(false)
 .addChoices(
 { name: 'Bot Messages Only', value: 'bots' },
 { name: 'Messages with Links Only', value: 'links' },
 { name: 'Messages with Attachments Only', value: 'attachments' },
 { name: 'Embeds Only', value: 'embeds' }
 ))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

 /**
 * Executes the purge command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 */
 async execute(interaction) {
 const amount = interaction.options.getInteger('amount');
 const filter = interaction.options.getString('filter');
 const { channel } = interaction;

 if (!channel) return;

 // Defer reply since bulk fetching and deleting can occasionally exceed the 3 second threshold
 await interaction.deferReply({ ephemeral: true });

 try {
 // Fetch messages; if a filter is active, fetch maximum (100) to find enough matching messages
 const fetchLimit = filter ? 100 : amount;
 const fetched = await channel.messages.fetch({ limit: fetchLimit });

 let messagesToDelete;

 if (filter) {
 const linkRegex = /https?:\/\/[^\s]+/i;

 if (filter === 'bots') {
 messagesToDelete = fetched.filter(m => m.author.bot);
 } else if (filter === 'links') {
 messagesToDelete = fetched.filter(m => linkRegex.test(m.content));
 } else if (filter === 'attachments') {
 messagesToDelete = fetched.filter(m => m.attachments.size > 0);
 } else if (filter === 'embeds') {
 messagesToDelete = fetched.filter(m => m.embeds.length > 0);
 }

 // Slice collection down to the user's requested amount
 messagesToDelete = messagesToDelete.first(amount);
 } else {
 messagesToDelete = fetched.first(amount);
 }

 const messageCount = Array.isArray(messagesToDelete) ? messagesToDelete.length : (messagesToDelete.size || 0);

  if (messageCount === 0) {
    const container = new ContainerBuilder()
      .setAccentColor(0xEF4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('❌ No messages matched the selected filter in the latest channel scan.')
      );
    return interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container]
    });
  }

 // Perform bulk delete
 // The second parameter 'true' filters out messages older than 14 days automatically (saving crashes)
 const deleted = await channel.bulkDelete(messagesToDelete, true);

 const filterLabels = {
 'bots': ' (Bot Messages)',
 'links': ' (Messages with Links)',
 'attachments': ' (Messages with Attachments)',
 'embeds': ' (Embed Messages)'
 };
 const filterLabel = filter ? filterLabels[filter] : '';

  if (deleted.size === 0) {
    const container = new ContainerBuilder()
      .setAccentColor(0xEF4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('❌ Failed to delete messages. They may be older than 14 days, which Discord restricts from bulk deletion.')
      );
    return interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container]
    });
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x10B981)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`✅ Successfully deleted **${deleted.size}** message(s)${filterLabel} from this channel.`)
    );
  await interaction.editReply({ 
    flags: MessageFlags.IsComponentsV2,
    components: [container]
  });
 } catch (err) {
 console.error('[ERROR] Purge failed:', err);
  const container = new ContainerBuilder()
    .setAccentColor(0xEF4444)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('❌ Failed to delete messages due to an internal error.')
    );
  await interaction.editReply({ 
    flags: MessageFlags.IsComponentsV2,
    components: [container]
  });
 }
 }
};
