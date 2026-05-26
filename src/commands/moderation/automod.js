const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure the server AutoModeration settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand: toggle
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable specific AutoMod modules.')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('The AutoMod module to configure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Anti-Spam Filter', value: 'spam' },
                            { name: 'Block Links Filter', value: 'links' },
                            { name: 'Excessive Caps Filter', value: 'caps' },
                            { name: 'Discord Invite Filter', value: 'invites' }
                        ))
                .addBooleanOption(opt =>
                    opt.setName('enable')
                        .setDescription('Toggle ON or OFF')
                        .setRequired(true)))
        
        // Subcommand: blocklist
        .addSubcommand(sub =>
            sub.setName('blocklist')
                .setDescription('Manage the custom blocked words and regex patterns.')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add Word/Pattern', value: 'add' },
                            { name: 'Remove Word/Pattern', value: 'remove' },
                            { name: 'List Blocked Patterns', value: 'list' }
                        ))
                .addStringOption(opt =>
                    opt.setName('pattern')
                        .setDescription('The word or regex (e.g. /badword.*/) to manage')
                        .setRequired(false)))
        
        // Subcommand: whitelist
        .addSubcommand(sub =>
            sub.setName('whitelist')
                .setDescription('Configure whitelisted channels or roles that bypass AutoMod.')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add Whitelist Exemption', value: 'add' },
                            { name: 'Remove Whitelist Exemption', value: 'remove' },
                            { name: 'List Whitelist Exemptions', value: 'list' }
                        ))
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to exempt')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to exempt')
                        .setRequired(false)))
        
        // Subcommand: punishments
        .addSubcommand(sub =>
            sub.setName('punishments')
                .setDescription('Manage automated punishment escalation rules for warning thresholds.')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add / Update Rule', value: 'add' },
                            { name: 'Remove Rule', value: 'remove' },
                            { name: 'List All Rules', value: 'list' }
                        ))
                .addIntegerOption(opt =>
                    opt.setName('threshold')
                        .setDescription('Warning count that triggers this rule (required for add/remove)')
                        .setMinValue(1)
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('punishment')
                        .setDescription('Punishment type (required for add)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Timeout/Mute', value: 'TIMEOUT' },
                            { name: 'Kick from Guild', value: 'KICK' },
                            { name: 'Ban from Guild', value: 'BAN' }
                        ))
                .addIntegerOption(opt =>
                    opt.setName('duration')
                        .setDescription('Timeout duration in minutes (only for Timeout punishment)')
                        .setMinValue(1)
                        .setRequired(false))),

    /**
     * Executes the automod command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {
        const { guild, options, user } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();

        try {
            // ------------------------------------------
            // A. Subcommand: toggle
            // ------------------------------------------
            if (subcommand === 'toggle') {
                const moduleName = options.getString('module');
                const enable = options.getBoolean('enable');

                const updates = {};
                if (moduleName === 'spam') updates.automodSpam = enable;
                if (moduleName === 'links') updates.automodLinks = enable;
                if (moduleName === 'caps') updates.automodCaps = enable;
                if (moduleName === 'invites') updates.automodInvites = enable;

                await db.updateGuildConfig(guild.id, updates);

                const moduleLabels = { spam: 'Anti-Spam Filter', links: 'Block Links Filter', caps: 'Excessive Caps Filter', invites: 'Discord Invite Filter' };
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ AutoMod Settings Updated')
                    .setColor('#00FFCC')
                    .setDescription(`Successfully ${enable ? 'enabled ✅' : 'disabled ❌'} the **${moduleLabels[moduleName]}** module.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // ------------------------------------------
            // B. Subcommand: blocklist
            // ------------------------------------------
            if (subcommand === 'blocklist') {
                const action = options.getString('action');
                const pattern = options.getString('pattern');

                if (action !== 'list' && !pattern) {
                    return interaction.editReply({ content: '❌ You must specify a `pattern` to add or remove!', ephemeral: true });
                }

                if (action === 'add') {
                    const success = await db.addBlockedWord(guild.id, pattern);
                    if (!success) {
                        return interaction.editReply({ content: `❌ The pattern \`${pattern}\` is already in the blocklist.`, ephemeral: true });
                    }
                    return interaction.editReply({ content: `✅ Successfully added \`${pattern}\` to the custom blocklist.` });
                }

                if (action === 'remove') {
                    const success = await db.removeBlockedWord(guild.id, pattern);
                    if (!success) {
                        return interaction.editReply({ content: `❌ The pattern \`${pattern}\` was not found in the blocklist.`, ephemeral: true });
                    }
                    return interaction.editReply({ content: `✅ Successfully removed \`${pattern}\` from the custom blocklist.` });
                }

                if (action === 'list') {
                    const words = await db.getBlockedWords(guild.id);
                    if (words.length === 0) {
                        return interaction.editReply({ content: '📜 The custom blocklist is currently empty.' });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('📜 Custom Blocklist Patterns')
                        .setColor('#00FFCC')
                        .setDescription(words.map((w, idx) => `${idx + 1}. \`${w}\``).join('\n'))
                        .setTimestamp();
                    
                    return interaction.editReply({ embeds: [embed] });
                }
            }

            // ------------------------------------------
            // C. Subcommand: whitelist
            // ------------------------------------------
            if (subcommand === 'whitelist') {
                const action = options.getString('action');
                const channelOption = options.getChannel('channel');
                const roleOption = options.getRole('role');

                if (action !== 'list' && !channelOption && !roleOption) {
                    return interaction.editReply({ content: '❌ You must specify either a `channel` or a `role` to whitelist/remove!', ephemeral: true });
                }

                if (action === 'add') {
                    if (channelOption) {
                        await db.addExemption(guild.id, 'CHANNEL', channelOption.id);
                        return interaction.editReply({ content: `✅ Successfully whitelisted channel ${channelOption} from AutoMod.` });
                    }
                    if (roleOption) {
                        await db.addExemption(guild.id, 'ROLE', roleOption.id);
                        return interaction.editReply({ content: `✅ Successfully whitelisted role **${roleOption.name}** from AutoMod.` });
                    }
                }

                if (action === 'remove') {
                    if (channelOption) {
                        const success = await db.removeExemption(guild.id, 'CHANNEL', channelOption.id);
                        return interaction.editReply({
                            content: success ? `✅ Successfully removed channel ${channelOption} from whitelist.` : `❌ Channel ${channelOption} is not whitelisted.`,
                            ephemeral: !success
                        });
                    }
                    if (roleOption) {
                        const success = await db.removeExemption(guild.id, 'ROLE', roleOption.id);
                        return interaction.editReply({
                            content: success ? `✅ Successfully removed role **${roleOption.name}** from whitelist.` : `❌ Role **${roleOption.name}** is not whitelisted.`,
                            ephemeral: !success
                        });
                    }
                }

                if (action === 'list') {
                    const exemptions = await db.getExemptions(guild.id);
                    if (exemptions.length === 0) {
                        return interaction.editReply({ content: '📜 There are currently no AutoMod whitelists configured.' });
                    }

                    const formatted = exemptions.map((ex, idx) => {
                        return `${idx + 1}. **${ex.type}**: ${ex.type === 'CHANNEL' ? `<#${ex.targetId}>` : `<@&${ex.targetId}>`}`;
                    }).join('\n');

                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ AutoMod Whitelist Exemptions')
                        .setColor('#00FFCC')
                        .setDescription(formatted)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }
            }

            // ------------------------------------------
            // D. Subcommand: punishments
            // ------------------------------------------
            if (subcommand === 'punishments') {
                const action = options.getString('action');
                const threshold = options.getInteger('threshold');
                const punishment = options.getString('punishment');
                const duration = options.getInteger('duration') || 60;

                if (action === 'list') {
                    const rules = await db.getPunishmentRules(guild.id);

                    if (rules.length === 0) {
                        return interaction.editReply({ content: '📜 No punishment escalation rules are configured for this server.', ephemeral: true });
                    }

                    const punishmentLabels = { TIMEOUT: '🤐 Timeout', KICK: '👢 Kick', BAN: '🔨 Ban' };
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 Punishment Escalation Rules')
                        .setColor('#00FFCC')
                        .setDescription(rules.map(r => {
                            const label = punishmentLabels[r.punishmentType] || r.punishmentType;
                            const dur = r.punishmentType === 'TIMEOUT' ? ` (${Math.round(r.durationMs / 60000)} mins)` : '';
                            return `• **${r.warnThreshold} warns** → ${label}${dur}`;
                        }).join('\n'))
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                if (action === 'remove') {
                    if (!threshold) {
                        return interaction.editReply({ content: '❌ You must specify a `threshold` to remove.', ephemeral: true });
                    }
                    const success = await db.removePunishmentRule(guild.id, threshold);
                    if (!success) {
                        return interaction.editReply({ content: `❌ No rule found for **${threshold} warnings**.`, ephemeral: true });
                    }
                    return interaction.editReply({ content: `✅ Removed punishment rule for **${threshold} warnings**.` });
                }

                if (action === 'add') {
                    if (!threshold || !punishment) {
                        return interaction.editReply({ content: '❌ You must specify both `threshold` and `punishment` to add a rule.', ephemeral: true });
                    }

                    const durationMs = duration * 60 * 1000;
                    await db.addPunishmentRule(guild.id, threshold, punishment, durationMs);

                    const punishmentLabels = { TIMEOUT: `Timeout (${duration} mins)`, KICK: 'Kick', BAN: 'Ban' };
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 Punishment Rule Added')
                        .setColor('#00FFCC')
                        .setDescription(`Escalation rule configured successfully.`)
                        .addFields(
                            { name: 'Warn Threshold', value: `**${threshold}** warnings`, inline: true },
                            { name: 'Punishment', value: `**${punishmentLabels[punishment]}**`, inline: true }
                        )
                        .setFooter({ text: 'Use /automod punishments action:list to view all rules.' })
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }
            }

        } catch (err) {
            console.error('[ERROR] /automod execution failed:', err);
            const errMsg = { content: '❌ An error occurred while modifying AutoMod settings.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp(errMsg).catch(() => {});
            } else {
                return interaction.editReply(errMsg).catch(() => {});
            }
        }
    }
};
