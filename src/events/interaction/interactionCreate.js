const { Events, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    name: Events.InteractionCreate,
    
    /**
     * Executes when an interaction is created.
     * @param {import('discord.js').Interaction} interaction 
     * @param {import('discord.js').Client} client 
     */
    async execute(interaction, client) {
        // ==========================================
        // 1. Handle Slash Commands
        // ==========================================
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`[WARNING] No command matching /${interaction.commandName} was found.`);
                return;
            }

            // Auto-defer unless the command handles its own deferral/modals
            if (!command.noDefer) {
                try {
                    await interaction.deferReply();
                } catch (err) {
                    console.error(`[ERROR] Failed to auto-defer command /${interaction.commandName}:`, err);
                    return;
                }
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`[ERROR] Error occurred executing command /${interaction.commandName}:`, error);

                const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage).catch(console.error);
                } else {
                    await interaction.reply(errorMessage).catch(console.error);
                }
            }
            return;
        }

        const { guild, member, user } = interaction;
        if (!guild) return;

        // ==========================================
        // 2. Handle Buttons
        // ==========================================
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // A. Reaction Roles Toggle Buttons (e.g. role_123456789)
            if (customId.startsWith('role_')) {
                const roleId = customId.split('_')[1];
                const role = guild.roles.cache.get(roleId);
                
                if (!role) {
                    return interaction.reply({ content: '❌ This role no longer exists in the server!', ephemeral: true });
                }

                try {
                    // Check if member already has the role
                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(role, 'Reaction Role: Button clicked');
                        return interaction.reply({ content: `✅ Successfully removed the role **${role.name}**!`, ephemeral: true });
                    } else {
                        await member.roles.add(role, 'Reaction Role: Button clicked');
                        return interaction.reply({ content: `✅ Successfully added the role **${role.name}**!`, ephemeral: true });
                    }
                } catch (err) {
                    console.error('[REACTION ROLE ERROR] Failed to toggle role:', err);
                    return interaction.reply({ 
                        content: '❌ Failed to toggle role. Verify my bot role has the "Manage Roles" permission and is higher than the target role.', 
                        ephemeral: true 
                    });
                }
            }

            // B. Tickets: Create Ticket Button
            if (customId === 'ticket_create') {
                await interaction.deferReply({ ephemeral: true }).catch(() => null);

                const channelName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

                try {
                    // Create private text channel
                    const ticketChannel = await guild.channels.create({
                        name: channelName,
                        type: 0, // GuildText
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.ViewChannel] // Hide for everyone
                            },
                            {
                                id: user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                            },
                            {
                                id: client.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
                            }
                        ]
                    });

                    const closeButton = new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('🔒 Close Ticket')
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder().addComponents(closeButton);

                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('🎟️ Support Ticket Created')
                        .setColor('#00FFCC')
                        .setDescription(
                            `Welcome to your ticket, ${user}!\n` +
                            `Please describe your inquiry, and our support team will assist you shortly.\n\n` +
                            `Click the button below to close this support ticket.`
                        )
                        .setTimestamp();

                    await ticketChannel.send({
                        content: `${user} | Support Staff`,
                        embeds: [welcomeEmbed],
                        components: [row]
                    });

                    await db.addTicket(guild.id, ticketChannel.id, channelName, user.id, user.tag).catch(() => null);

                    return interaction.editReply({ content: `✅ Ticket created successfully! Go to ${ticketChannel}.` });
                } catch (err) {
                    console.error('[TICKET ERROR] Failed to create channel:', err);
                    return interaction.editReply({ content: '❌ Failed to open a support ticket. Please check my permission settings.' });
                }
            }

            // C. Tickets: Close Ticket Button
            if (customId === 'ticket_close') {
                const channel = interaction.channel;
                if (!channel) return;

                await interaction.reply({ 
                    content: '🔒 Closing this ticket in 5 seconds... Generating transcript...', 
                    ephemeral: false 
                });

                try {
                    // Fetch last 100 messages for transcript
                    const messages = await channel.messages.fetch({ limit: 100 });
                    const transcript = messages.reverse().map(m => {
                        const date = new Date(m.createdTimestamp).toLocaleString();
                        return `[${date}] ${m.author.tag}: ${m.content}`;
                    }).join('\n');

                    // Find ticket owner by checking permissions (the non-bot override)
                    const ownerOverride = channel.permissionOverwrites.cache.find(o => o.type === 1 && o.id !== client.user.id);
                    
                    if (ownerOverride) {
                        const owner = await guild.members.fetch(ownerOverride.id).catch(() => null);
                        if (owner) {
                            const buffer = Buffer.from(transcript, 'utf-8');
                            const attachment = new AttachmentBuilder(buffer, { name: `${channel.name}-transcript.txt` });

                            await owner.send({
                                content: `🎟️ Your ticket **${channel.name}** in **${guild.name}** has been closed. Here is your conversation transcript:`,
                                files: [attachment]
                            }).catch(() => null);
                        }
                    }

                    await db.closeTicket(guild.id, channel.id).catch(() => null);

                    // Delete the channel after a 5 second delay
                    setTimeout(async () => {
                        await channel.delete('Ticket closed').catch(() => null);
                    }, 5000);

                } catch (err) {
                    console.error('[TICKET ERROR] Failed to close ticket:', err);
                }
            }

            // D. Giveaways: Join Button Click
            if (customId.startsWith('giveaway_join_')) {
                const giveawayId = customId.substring(14); // Extract ID after 'giveaway_join_'
                client.giveaways = client.giveaways || new Map();
                
                if (!client.giveaways.has(giveawayId)) {
                    return interaction.reply({ content: '❌ This giveaway is no longer active!', ephemeral: true });
                }
                
                const giveaway = client.giveaways.get(giveawayId);
                if (giveaway.entrants.has(user.id)) {
                    return interaction.reply({ content: 'ℹ️ You have already entered this giveaway!', ephemeral: true });
                }
                
                giveaway.entrants.add(user.id);
                return interaction.reply({ content: '🎉 You have successfully entered the giveaway! Good luck!', ephemeral: true });
            }

            // E. Events: RSVP Button Click
            if (customId.startsWith('event_rsvp_')) {
                const eventId = customId.substring(11);
                client.events = client.events || new Map();
                
                if (!client.events.has(eventId)) {
                    return interaction.reply({ content: '❌ This event is no longer active!', ephemeral: true });
                }
                
                const eventObj = client.events.get(eventId);
                if (eventObj.rsvps.has(user.id)) {
                    eventObj.rsvps.delete(user.id);
                    await interaction.reply({ content: 'ℹ️ Removed your RSVP for this event.', ephemeral: true });
                } else {
                    eventObj.rsvps.add(user.id);
                    await interaction.reply({ content: '✅ Successfully RSVP\'d to this event! See you there!', ephemeral: true });
                }

                // Update original embed
                const message = interaction.message;
                const embed = EmbedBuilder.from(message.embeds[0]);
                
                // Find and edit RSVP field
                const fieldIndex = embed.data.fields.findIndex(f => f.name.includes('RSVP'));
                if (fieldIndex !== -1) {
                    embed.data.fields[fieldIndex].value = `👥 **${eventObj.rsvps.size}** RSVPs\n${Array.from(eventObj.rsvps).slice(0, 10).map(id => `<@${id}>`).join(', ') || '*No one yet*'}`;
                }
                
                await message.edit({ embeds: [embed] });
                await db.updateEventRsvpCount(eventId, eventObj.rsvps.size).catch(() => null);
                return;
            }

            return;
        }

        // ==========================================
        // 3. Handle Modals
        // ==========================================
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            // A. Embed Builder Modal
            if (customId === 'embed_modal') {
                await interaction.deferReply({ ephemeral: true }).catch(() => null);

                const title = interaction.fields.getTextInputValue('title');
                const desc = interaction.fields.getTextInputValue('description');
                const color = interaction.fields.getTextInputValue('color') || '#00FFCC';
                const image = interaction.fields.getTextInputValue('image');
                const thumbnail = interaction.fields.getTextInputValue('thumbnail');

                try {
                    const embed = new EmbedBuilder()
                        .setDescription(desc || null)
                        .setColor(color)
                        .setTimestamp();

                    if (title) embed.setTitle(title);
                    if (image && image.startsWith('http')) embed.setImage(image);
                    if (thumbnail && thumbnail.startsWith('http')) embed.setThumbnail(thumbnail);

                    await interaction.channel.send({ embeds: [embed] });
                    return interaction.editReply({ content: '✅ Embed successfully sent!' });
                } catch (err) {
                    console.error('[EMBED BUILDER ERROR] Failed to construct embed:', err);
                    return interaction.editReply({ content: '❌ Failed to construct embed. Please verify image URLs are correct and color is a valid Hex code.' });
                }
            }

            // B. Custom Command Embed Builder Modal
            if (customId.startsWith('customcmd_modal_')) {
                await interaction.deferReply({ ephemeral: true }).catch(() => null);

                const triggerName = customId.split('customcmd_modal_')[1];
                const title = interaction.fields.getTextInputValue('title');
                const desc = interaction.fields.getTextInputValue('description');
                const color = interaction.fields.getTextInputValue('color') || '#00FFCC';
                const image = interaction.fields.getTextInputValue('image');
                const thumbnail = interaction.fields.getTextInputValue('thumbnail');

                try {
                    const embedData = {
                        title: title || null,
                        description: desc || null,
                        color: color,
                        image: (image && image.startsWith('http')) ? image : null,
                        thumbnail: (thumbnail && thumbnail.startsWith('http')) ? thumbnail : null
                    };

                    await db.addCustomCommand(guild.id, triggerName, null, true, embedData);
                    return interaction.editReply({ content: `✅ Embed Custom Command \`!${triggerName}\` successfully configured!` });
                } catch (err) {
                    console.error('[CUSTOMCMD BUILDER ERROR] Failed to save embed custom command:', err);
                    return interaction.editReply({ content: '❌ Failed to register the custom command.' });
                }
            }
        }
    }
};
