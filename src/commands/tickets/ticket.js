const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Comprehensive support ticket management panel.')
        
        // Subcommand: setup
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Deploys the persistent "Create Ticket" helpdesk dashboard (Admin only).'))
        
        // Subcommand: close
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Generates conversation transcript and closes the support ticket.'))
        
        // Subcommand: add
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Grants a user or role access to view and reply inside this ticket.')
                .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(false))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(false)))
        
        // Subcommand: remove
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Revokes a user or role access from this ticket.')
                .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(false))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(false))),

    /**
     * Executes the ticket command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, channel, options, member } = interaction;
        if (!guild || !channel || !member) return;

        const subcommand = options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: setup
            // ------------------------------------------
            if (subcommand === 'setup') {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.editReply({ 
                        content: '❌ You must be an Administrator to deploy support helpdesk dashboards!', 
                        ephemeral: true 
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎟️ Helpdesk Support Tickets')
                    .setColor('#00FFCC')
                    .setDescription(
                        `Need to contact our support agents or open an inquiry?\n` +
                        `Click the button below to open a private **Support Ticket**.\n\n` +
                        `Our support agents will join you shortly to assist.`
                    )
                    .setFooter({ text: `${guild.name} Support Panel` })
                    .setTimestamp();

                const button = new ButtonBuilder()
                    .setCustomId('ticket_create')
                    .setLabel('🎟️ Open Ticket')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(button);

                await channel.send({ 
                    embeds: [embed], 
                    components: [row] 
                });

                return interaction.editReply({ content: '✅ Helpdesk panel successfully deployed in this channel!', ephemeral: true });
            }

            // ------------------------------------------
            // B. Subcommand: close
            // ------------------------------------------
            if (subcommand === 'close') {
                // Ensure we are inside a ticket channel
                if (!channel.name.startsWith('ticket-')) {
                    return interaction.editReply({ 
                        content: '❌ This command can only be executed inside an active `ticket-` channel.', 
                        ephemeral: true 
                    });
                }

                await interaction.editReply({ content: '🔒 Closing ticket in 5 seconds... Compiling chat logs...', ephemeral: false });

                // Fetch up to 100 messages for conversation transcript
                const fetched = await channel.messages.fetch({ limit: 100 });
                const logs = fetched.reverse().map(m => {
                    const time = new Date(m.createdTimestamp).toLocaleString();
                    return `[${time}] ${m.author.tag}: ${m.content}`;
                }).join('\n');

                // Determine ticket creator (the non-bot override)
                const creatorOverride = channel.permissionOverwrites.cache.find(o => o.type === 1 && o.id !== interaction.client.user.id);
                
                if (creatorOverride) {
                    const ticketOwner = await guild.members.fetch(creatorOverride.id).catch(() => null);
                    if (ticketOwner) {
                        const buffer = Buffer.from(logs, 'utf-8');
                        const attachment = new AttachmentBuilder(buffer, { name: `${channel.name}-transcript.txt` });

                        await ticketOwner.send({
                            content: `🎟️ Your support ticket **${channel.name}** in **${guild.name}** was closed. Here is your message history:`,
                            files: [attachment]
                        }).catch(() => null);
                    }
                }

                await db.closeTicket(guild.id, channel.id).catch(() => null);

                // Delete channel after 5 seconds
                setTimeout(async () => {
                    await channel.delete('Ticket closed').catch(() => null);
                }, 5000);

                return;
            }

            // ------------------------------------------
            // C. Subcommands: add & remove
            // ------------------------------------------
            if (subcommand === 'add' || subcommand === 'remove') {
                if (!channel.name.startsWith('ticket-')) {
                    return interaction.editReply({ 
                        content: '❌ You can only adjust overrides inside active `ticket-` channels.', 
                        ephemeral: true 
                    });
                }

                const userOption = options.getUser('user');
                const roleOption = options.getRole('role');

                if (!userOption && !roleOption) {
                    return interaction.editReply({ 
                        content: '❌ You must specify either a `user` or a `role` override to configure!', 
                        ephemeral: true 
                    });
                }

                if (subcommand === 'add') {
                    if (userOption) {
                        await channel.permissionOverwrites.edit(userOption.id, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true
                        });
                        return interaction.editReply({ content: `✅ Successfully added ${userOption} to this support ticket.` });
                    }
                    if (roleOption) {
                        await channel.permissionOverwrites.edit(roleOption.id, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true
                        });
                        return interaction.editReply({ content: `✅ Successfully added role **${roleOption.name}** to this support ticket.` });
                    }
                }

                if (subcommand === 'remove') {
                    if (userOption) {
                        await channel.permissionOverwrites.delete(userOption.id);
                        return interaction.editReply({ content: `✅ Successfully removed ${userOption} from this support ticket.` });
                    }
                    if (roleOption) {
                        await channel.permissionOverwrites.delete(roleOption.id);
                        return interaction.editReply({ content: `✅ Successfully removed role **${roleOption.name}** from this support ticket.` });
                    }
                }
            }

        } catch (err) {
            console.error('[TICKET COMMAND ERROR] Failed:', err);
            const _errMsg = { content: '❌ Failed to process support ticket operation.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(_errMsg).catch(() => null);
            } else {
                await interaction.editReply(_errMsg).catch(() => null);
            }
        }
    }
};
