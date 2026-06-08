const {
  SlashCommandBuilder,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { EMOJIS } = require('../../utils/emojis');

function buildLobbyContainer(hostUser, targetUser, crew, buttons) {
  const crewList = crew.map((member, idx) => `• <@${member.id}>${idx === 0 ? ' (Host)' : ''}`).join('\n');

  return new ContainerBuilder()
    .setAccentColor(0xFF0055)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Cooperative Bank Heist Lobby\n` +
        ` <@${hostUser.id}> is planning a bank heist targeting <@${targetUser.id}>'s vault!\n\n` +
        `At least **1 accomplice** (2 crew total) required. Success scales with crew size.\n\n` +
        `**Heist Crew (${crew.length}):**\n${crewList}\n\n` +
        `*Click Join below — requires ${EMOJIS.coin} 100 coins in your wallet in case you get caught.*`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Lobby expires in 30 seconds`)
    )
    .addActionRowComponents(buttons);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bankrob')
    .setDescription('Organize a cooperative bank heist to swipe coins from another member\'s vault.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member whose bank vault you want to target')
        .setRequired(true)),

  async execute(interaction) {
    const { guild, user, options } = interaction;
    if (!guild) return;

    const targetUser = options.getUser('target');

    if (targetUser.id === user.id) {
      return interaction.editReply({ content: 'You cannot rob your own bank vault!', ephemeral: true });
    }

    if (targetUser.bot) {
      return interaction.editReply({ content: 'You cannot rob bot accounts!', ephemeral: true });
    }

    const cd = checkCooldown('bankrob', user.id, 120);
    if (cd.onCooldown) {
      return interaction.editReply({ content: `Bank heist is on cooldown. Try again in **${cd.remaining}s**.`, ephemeral: true });
    }

    try {
      const hostProfile = await db.getProfile(guild.id, user.id);
      const victimProfile = await db.getProfile(guild.id, targetUser.id);

      if (hostProfile.coins < 100) {
        return interaction.editReply({
          content: `You must possess at least ${EMOJIS.coin} **100** coins in your active wallet to fund and organize a heist crew!`,
          ephemeral: true
        });
      }

      const victimBankBalance = victimProfile.bank || 0;
      if (victimBankBalance < 200) {
        return interaction.editReply({
          content: `<@${targetUser.id}>'s bank vault is practically empty! They only have ${EMOJIS.coin} **${victimBankBalance.toLocaleString()}** coins in the bank. It isn't worth the massive risk.`,
          ephemeral: true
        });
      }

      const crew = [{ id: user.id, username: user.username, tag: user.tag }];
      let heistStarted = false;
      let heistCancelled = false;

      const joinButton = new ButtonBuilder()
        .setCustomId('heist_join')
        .setLabel('Join Heist Crew')
        .setStyle(ButtonStyle.Primary);

      const startButton = new ButtonBuilder()
        .setCustomId('heist_start')
        .setLabel('Start Robbery')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('heist_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(joinButton, startButton, cancelButton);

      const response = await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [buildLobbyContainer(user, targetUser, crew, row)]
      });

      const collector = response.createMessageComponentCollector({
        filter: i => i.guildId === guild.id,
        time: 30000
      });

      collector.on('collect', async i => {
        const clicker = i.user;

        if (i.customId === 'heist_join') {
          if (clicker.bot) return i.reply({ content: 'Bots cannot join heists.', ephemeral: true });
          if (clicker.id === targetUser.id) return i.reply({ content: 'You cannot join a robbery against your own vault!', ephemeral: true });
          if (crew.some(member => member.id === clicker.id)) {
            return i.reply({ content: 'You are already part of this heist crew!', ephemeral: true });
          }

          try {
            const clickerProfile = await db.getProfile(guild.id, clicker.id);
            if (clickerProfile.coins < 100) {
              return i.reply({
                content: `You need at least ${EMOJIS.coin} **100** coins in your active wallet to join this high-risk heist! (Current: ${EMOJIS.coin} ${clickerProfile.coins.toLocaleString()})`,
                ephemeral: true
              });
            }

            crew.push({ id: clicker.id, username: clicker.username, tag: clicker.tag });

            await i.update({
              flags: MessageFlags.IsComponentsV2,
              components: [buildLobbyContainer(user, targetUser, crew, row)]
            });
          } catch (err) {
            console.error('[HEIST JOIN ERROR]', err);
            await i.reply({ content: 'Failed to register you into the heist.', ephemeral: true });
          }
        }

        else if (i.customId === 'heist_start') {
          if (clicker.id !== user.id) {
            return i.reply({ content: 'Only the heist host can start the robbery!', ephemeral: true });
          }

          if (crew.length < 2) {
            return i.reply({
              content: 'You need at least **1 accomplice** (2 crew members total) to launch a cooperative bank robbery!',
              ephemeral: true
            });
          }

          heistStarted = true;
          collector.stop('start');
        }

        else if (i.customId === 'heist_cancel') {
          if (clicker.id !== user.id) {
            return i.reply({ content: 'Only the heist host can cancel the robbery!', ephemeral: true });
          }

          heistCancelled = true;
          collector.stop('cancel');
        }
      });

      collector.on('end', async (collected, reason) => {
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => null);

        if (heistCancelled || reason === 'cancel') {
          const cancelContainer = new ContainerBuilder()
            .setAccentColor(0x9CA3AF)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## Heist Aborted\n <@${user.id}> decided to call off the bank heist. The crew disbanded safely.`
              )
            );
          return interaction.followUp({ flags: MessageFlags.IsComponentsV2, components: [cancelContainer] });
        }

        const canExecute = crew.length >= 2;

        if (!heistStarted && reason === 'time' && !canExecute) {
          const failContainer = new ContainerBuilder()
            .setAccentColor(0x9CA3AF)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## Heist Aborted — No Accomplices\n Not enough accomplices joined the crew in time. The vault raid was called off.`
              )
            );
          return interaction.followUp({ flags: MessageFlags.IsComponentsV2, components: [failContainer] });
        }

        const crewSize = crew.length;
        let successChance = 0.35;
        if (crewSize === 3) successChance = 0.50;
        if (crewSize >= 4) successChance = 0.65;

        const isSuccess = Math.random() < successChance;

        const latestVictim = await db.getProfile(guild.id, targetUser.id);
        const latestVictimBank = latestVictim.bank || 0;

        if (isSuccess) {
          const pct = Math.floor(Math.random() * 31) + 20;
          let stolenAmount = Math.floor(latestVictimBank * (pct / 100));
          stolenAmount = Math.max(100, Math.min(stolenAmount, 15000));

          const splitAmount = Math.floor(stolenAmount / crewSize);

          await db.updateBank(guild.id, targetUser.id, -stolenAmount);
          for (const member of crew) {
            await db.updateCoins(guild.id, member.id, splitAmount);
          }

          const crewPings = crew.map(member => `<@${member.id}>`).join(', ');

          const successContainer = new ContainerBuilder()
            .setAccentColor(0x00FF66)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## VAULT BREACHED!\n **Heist Success!**\n\n` +
                `The crew infiltrated <@${targetUser.id}>'s bank vault and escaped with **${EMOJIS.coin} ${stolenAmount.toLocaleString()}** coins!`
              )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**Loot Split (${crewSize} crew members):**\nEach crew member receives ${EMOJIS.coin} **${splitAmount.toLocaleString()}** coins!\n\n` +
                `**Accomplices:** ${crewPings}\n\n` +
                `**Target Loss:** **-${stolenAmount.toLocaleString()}** bank coins\n` +
                `**Split Per Thief:** ${EMOJIS.coin} **+${splitAmount.toLocaleString()}** coins`
              )
            );

          return interaction.followUp({ flags: MessageFlags.IsComponentsV2, components: [successContainer] });

        } else {
          const fineList = [];
          let totalCompensation = 0;

          for (const member of crew) {
            const mProfile = await db.getProfile(guild.id, member.id);
            let fine = Math.floor(mProfile.coins * 0.10);
            fine = Math.max(100, Math.min(fine, 2000));

            await db.updateCoins(guild.id, member.id, -fine);
            totalCompensation += fine;

            fineList.push(`• <@${member.id}>: fined ${EMOJIS.coin} **${fine.toLocaleString()}** coins`);
          }

          await db.updateCoins(guild.id, targetUser.id, totalCompensation);

          const failContainer = new ContainerBuilder()
            .setAccentColor(0xFF3333)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## VAULT ALARMS TRIGGERED!\n **BUSTED!**\n\n` +
                `The crew triggered laser grids in <@${targetUser.id}>'s vault and were captured!\n` +
                `All fines paid directly to <@${targetUser.id}>'s wallet as compensation.`
              )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**Crew Fines:**\n${fineList.join('\n')}\n\n` +
                `**Total Compensated to Victim:** ${EMOJIS.coin} **+${totalCompensation.toLocaleString()}** coins`
              )
            );

          return interaction.followUp({ flags: MessageFlags.IsComponentsV2, components: [failContainer] });
        }
      });

    } catch (err) {
      console.error('[BANKROB ERROR]', err);
      const _errMsg = { content: 'Failed to initiate heist vault sensors. Please check project database config.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(_errMsg).catch(() => null);
      } else {
        await interaction.editReply(_errMsg).catch(() => null);
      }
    }
  }
};
