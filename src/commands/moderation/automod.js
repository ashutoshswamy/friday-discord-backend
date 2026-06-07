const {
    SlashCommandBuilder, PermissionFlagsBits, ChannelType,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

const MODULE_LABELS = { spam: 'Anti-Spam Filter', links: 'Block Links Filter', caps: 'Excessive Caps Filter', invites: 'Discord Invite Filter' };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure the server AutoModeration settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable specific AutoMod modules.')
                .addStringOption(opt =>
                    opt.setName('module').setDescription('The AutoMod module to configure').setRequired(true)
                        .addChoices(
                            { name: 'Anti-Spam Filter', value: 'spam' },
                            { name: 'Block Links Filter', value: 'links' },
                            { name: 'Excessive Caps Filter', value: 'caps' },
                            { name: 'Discord Invite Filter', value: 'invites' }
                        ))
                .addBooleanOption(opt =>
                    opt.setName('enable').setDescription('Toggle ON or OFF').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('blocklist')
                .setDescription('Manage the custom blocked words and regex patterns.')
                .addStringOption(opt =>
                    opt.setName('action').setDescription('Action to perform').setRequired(true)
                        .addChoices(
                            { name: 'Add Word/Pattern', value: 'add' },
                            { name: 'Remove Word/Pattern', value: 'remove' },
                            { name: 'List Blocked Patterns', value: 'list' }
                        ))
                .addStringOption(opt =>
                    opt.setName('pattern').setDescription('The word or regex (e.g. /badword.*/) to manage').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('whitelist')
                .setDescription('Configure whitelisted channels or roles that bypass AutoMod.')
                .addStringOption(opt =>
                    opt.setName('action').setDescription('Action to perform').setRequired(true)
                        .addChoices(
                            { name: 'Add Whitelist Exemption', value: 'add' },
                            { name: 'Remove Whitelist Exemption', value: 'remove' },
                            { name: 'List Whitelist Exemptions', value: 'list' }
                        ))
                .addChannelOption(opt =>
                    opt.setName('channel').setDescription('Channel to exempt').addChannelTypes(ChannelType.GuildText).setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to exempt').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('optout')
                .setDescription('Opt a channel out of a specific AutoMod filter without fully whitelisting it.')
                .addStringOption(opt =>
                    opt.setName('action').setDescription('Action to perform').setRequired(true)
                        .addChoices(
                            { name: 'Add Opt-Out', value: 'add' },
                            { name: 'Remove Opt-Out', value: 'remove' },
                            { name: 'List Opt-Outs', value: 'list' }
                        ))
                .addStringOption(opt =>
                    opt.setName('filter').setDescription('The AutoMod filter to opt out of').setRequired(false)
                        .addChoices(
                            { name: 'Anti-Spam Filter', value: 'spam' },
                            { name: 'Block Links Filter', value: 'links' },
                            { name: 'Excessive Caps Filter', value: 'caps' },
                            { name: 'Discord Invite Filter', value: 'invites' }
                        ))
                .addChannelOption(opt =>
                    opt.setName('channel').setDescription('Channel to opt out').addChannelTypes(ChannelType.GuildText).setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('punishments')
                .setDescription('Manage automated punishment escalation rules for warning thresholds.')
                .addStringOption(opt =>
                    opt.setName('action').setDescription('Action to perform').setRequired(true)
                        .addChoices(
                            { name: 'Add / Update Rule', value: 'add' },
                            { name: 'Remove Rule', value: 'remove' },
                            { name: 'List All Rules', value: 'list' }
                        ))
                .addIntegerOption(opt =>
                    opt.setName('threshold').setDescription('Warning count that triggers this rule (required for add/remove)').setMinValue(1).setRequired(false))
                .addStringOption(opt =>
                    opt.setName('punishment').setDescription('Punishment type (required for add)').setRequired(false)
                        .addChoices(
                            { name: 'Timeout/Mute', value: 'TIMEOUT' },
                            { name: 'Kick from Guild', value: 'KICK' },
                            { name: 'Ban from Guild', value: 'BAN' }
                        ))
                .addIntegerOption(opt =>
                    opt.setName('duration').setDescription('Timeout duration in minutes (only for Timeout punishment)').setMinValue(1).setRequired(false))),

    async execute(interaction) {
        const { guild, options } = interaction;
        if (!guild) return;

        const subcommand = options.getSubcommand();

        try {
            if (subcommand === 'toggle') {
                const moduleName = options.getString('module');
                const enable = options.getBoolean('enable');

                const updates = {};
                if (moduleName === 'spam') updates.automodSpam = enable;
                if (moduleName === 'links') updates.automodLinks = enable;
                if (moduleName === 'caps') updates.automodCaps = enable;
                if (moduleName === 'invites') updates.automodInvites = enable;

                await db.updateGuildConfig(guild.id, updates);

                const container = new ContainerBuilder()
                    .setAccentColor(0x00FFCC)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## 🛡️ AutoMod Settings Updated\nSuccessfully ${enable ? 'enabled ✅' : 'disabled ❌'} the **${MODULE_LABELS[moduleName]}** module.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (subcommand === 'blocklist') {
                const action = options.getString('action');
                const pattern = options.getString('pattern');

                if (action !== 'list' && !pattern) {
                    return interaction.editReply({ content: '❌ You must specify a `pattern` to add or remove!', ephemeral: true });
                }

                if (action === 'add') {
                    const success = await db.addBlockedWord(guild.id, pattern);
                    if (!success) return interaction.editReply({ content: `❌ The pattern \`${pattern}\` is already in the blocklist.`, ephemeral: true });
                    return interaction.editReply({ content: `✅ Successfully added \`${pattern}\` to the custom blocklist.` });
                }

                if (action === 'remove') {
                    const success = await db.removeBlockedWord(guild.id, pattern);
                    if (!success) return interaction.editReply({ content: `❌ The pattern \`${pattern}\` was not found in the blocklist.`, ephemeral: true });
                    return interaction.editReply({ content: `✅ Successfully removed \`${pattern}\` from the custom blocklist.` });
                }

                if (action === 'list') {
                    const words = await db.getBlockedWords(guild.id);
                    if (words.length === 0) return interaction.editReply({ content: '📜 The custom blocklist is currently empty.' });

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00FFCC)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 📜 Custom Blocklist Patterns`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(words.map((w, idx) => `${idx + 1}. \`${w}\``).join('\n'))
                        );

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
                }
            }

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
                        return interaction.editReply({ content: success ? `✅ Successfully removed channel ${channelOption} from whitelist.` : `❌ Channel ${channelOption} is not whitelisted.`, ephemeral: !success });
                    }
                    if (roleOption) {
                        const success = await db.removeExemption(guild.id, 'ROLE', roleOption.id);
                        return interaction.editReply({ content: success ? `✅ Successfully removed role **${roleOption.name}** from whitelist.` : `❌ Role **${roleOption.name}** is not whitelisted.`, ephemeral: !success });
                    }
                }

                if (action === 'list') {
                    const exemptions = await db.getExemptions(guild.id);
                    if (exemptions.length === 0) return interaction.editReply({ content: '📜 There are currently no AutoMod whitelists configured.' });

                    const formatted = exemptions.map((ex, idx) =>
                        `${idx + 1}. **${ex.type}**: ${ex.type === 'CHANNEL' ? `<#${ex.targetId}>` : `<@&${ex.targetId}>`}`
                    ).join('\n');

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00FFCC)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 🛡️ AutoMod Whitelist Exemptions`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(formatted));

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
                }
            }

            if (subcommand === 'optout') {
                const action = options.getString('action');
                const filter = options.getString('filter');
                const channelOption = options.getChannel('channel');

                if (action === 'list') {
                    const optOuts = await db.getFilterOptOuts(guild.id);
                    if (optOuts.length === 0) return interaction.editReply({ content: '📜 No per-filter channel opt-outs are configured for this server.' });

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00FFCC)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 🛡️ AutoMod Channel Opt-Outs`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                optOuts.map((o, idx) => `${idx + 1}. **${MODULE_LABELS[o.filter] || o.filter}** → <#${o.channelId}>`).join('\n')
                            )
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# These channels skip only their specified filter — other AutoMod rules still apply.`)
                        );

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
                }

                if (!filter || !channelOption) {
                    return interaction.editReply({ content: '❌ You must specify both a `filter` and a `channel` for add/remove.', ephemeral: true });
                }

                if (action === 'add') {
                    const success = await db.addFilterOptOut(guild.id, filter, channelOption.id);
                    if (!success) return interaction.editReply({ content: `❌ Failed to add opt-out. It may already exist.`, ephemeral: true });

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00FFCC)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ✅ Filter Opt-Out Added\n${channelOption} will now bypass the **${MODULE_LABELS[filter]}**.\nAll other AutoMod filters still apply in that channel.`
                            )
                        );

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
                }

                if (action === 'remove') {
                    const success = await db.removeFilterOptOut(guild.id, filter, channelOption.id);
                    if (!success) return interaction.editReply({ content: `❌ No opt-out found for ${channelOption} on the **${MODULE_LABELS[filter]}**.`, ephemeral: true });
                    return interaction.editReply({ content: `✅ Removed opt-out — ${channelOption} is now subject to the **${MODULE_LABELS[filter]}** again.` });
                }
            }

            if (subcommand === 'punishments') {
                const action = options.getString('action');
                const threshold = options.getInteger('threshold');
                const punishment = options.getString('punishment');
                const duration = options.getInteger('duration') || 60;

                if (action === 'list') {
                    const rules = await db.getPunishmentRules(guild.id);
                    if (rules.length === 0) return interaction.editReply({ content: '📜 No punishment escalation rules are configured for this server.', ephemeral: true });

                    const punishmentLabels = { TIMEOUT: '🤐 Timeout', KICK: '👢 Kick', BAN: '🔨 Ban' };
                    const rulesText = rules.map(r => {
                        const label = punishmentLabels[r.punishmentType] || r.punishmentType;
                        const dur = r.punishmentType === 'TIMEOUT' ? ` (${Math.round(r.durationMs / 60000)} mins)` : '';
                        return `• **${r.warnThreshold} warns** → ${label}${dur}`;
                    }).join('\n');

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00FFCC)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 🔨 Punishment Escalation Rules`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(rulesText));

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
                }

                if (action === 'remove') {
                    if (!threshold) return interaction.editReply({ content: '❌ You must specify a `threshold` to remove.', ephemeral: true });
                    const success = await db.removePunishmentRule(guild.id, threshold);
                    if (!success) return interaction.editReply({ content: `❌ No rule found for **${threshold} warnings**.`, ephemeral: true });
                    return interaction.editReply({ content: `✅ Removed punishment rule for **${threshold} warnings**.` });
                }

                if (action === 'add') {
                    if (!threshold || !punishment) return interaction.editReply({ content: '❌ You must specify both `threshold` and `punishment` to add a rule.', ephemeral: true });

                    const durationMs = duration * 60 * 1000;
                    await db.addPunishmentRule(guild.id, threshold, punishment, durationMs);

                    const punishmentLabels = { TIMEOUT: `Timeout (${duration} mins)`, KICK: 'Kick', BAN: 'Ban' };

                    const container = new ContainerBuilder()
                        .setAccentColor(0x00FFCC)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 🔨 Punishment Rule Added\nEscalation rule configured successfully.`)
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Warn Threshold:** **${threshold}** warnings\n` +
                                `**Punishment:** **${punishmentLabels[punishment]}**`
                            )
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Use /automod punishments action:list to view all rules.`)
                        );

                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
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
