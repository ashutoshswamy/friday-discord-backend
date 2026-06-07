const {
    SlashCommandBuilder, PermissionFlagsBits,
    ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Comprehensive support ticket management panel.')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Deploys the persistent "Create Ticket" helpdesk dashboard (Admin only).'))
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Generates conversation transcript and closes the support ticket.'))
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Grants a user or role access to view and reply inside this ticket.')
                .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(false))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Revokes a user or role access from this ticket.')
                .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(false))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(false))),

    async execute(interaction) {
        const { guild, channel, options, member } = interaction;
        if (!guild || !channel || !member) return;

        const subcommand = options.getSubcommand();

        try {
            if (subcommand === 'setup') {
                if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.editReply({
                        content: '❌ You must be an Administrator to deploy support helpdesk dashboards!',
                        ephemeral: true
                    });
                }

                const container = new ContainerBuilder()
                    .setAccentColor(0x00FFCC)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## 🎟️ Helpdesk Support Tickets\nNeed to contact our support agents or open an inquiry?\nClick the button below to open a private **Support Ticket**.\n\nOur support agents will join you shortly to assist.`
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('ticket_create')
                                .setLabel('🎟️ Open Ticket')
                                .setStyle(ButtonStyle.Primary)
                        )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# ${guild.name} Support Panel`)
                    );

                await channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });

                return interaction.editReply({ content: '✅ Helpdesk panel successfully deployed in this channel!', ephemeral: true });
            }

            if (subcommand === 'close') {
                if (!channel.name.startsWith('ticket-')) {
                    return interaction.editReply({
                        content: '❌ This command can only be executed inside an active `ticket-` channel.',
                        ephemeral: true
                    });
                }

                await interaction.editReply({ content: '🔒 Closing ticket in 5 seconds... Compiling chat logs...', ephemeral: false });

                const fetched = await channel.messages.fetch({ limit: 100 });
                const logs = fetched.reverse().map(m => {
                    const time = new Date(m.createdTimestamp).toLocaleString();
                    return `[${time}] ${m.author.tag}: ${m.content}`;
                }).join('\n');

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

                setTimeout(async () => {
                    await channel.delete('Ticket closed').catch(() => null);
                }, 5000);

                return;
            }

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
                        await channel.permissionOverwrites.edit(userOption.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                        return interaction.editReply({ content: `✅ Successfully added ${userOption} to this support ticket.` });
                    }
                    if (roleOption) {
                        await channel.permissionOverwrites.edit(roleOption.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
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
