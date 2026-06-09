const {
 SlashCommandBuilder,
 ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
 ActionRowBuilder, ButtonBuilder, ButtonStyle,
 ModalBuilder, TextInputBuilder, TextInputStyle,
 ComponentType, MessageFlags
} = require('discord.js');
const { EMOJIS } = require('../../utils/emojis');
const db = require('../../utils/db');

module.exports = {
 noDefer: true,
 data: new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Initiate a bilateral trade — exchange items and coins with another member.')
  .addUserOption(opt =>
   opt.setName('user')
    .setDescription('The member to trade with')
    .setRequired(true)),

 async execute(interaction) {
  const { guild, user, options } = interaction;
  if (!guild) return;

  const targetUser = options.getUser('user');

  if (targetUser.id === user.id) {
   return interaction.reply({ content: 'You cannot trade with yourself!', ephemeral: true });
  }
  if (targetUser.bot) {
   return interaction.reply({ content: 'You cannot trade with bot accounts!', ephemeral: true });
  }

  const state = {
   sender: { id: user.id, coins: 0, items: [], confirmed: false },
   receiver: { id: targetUser.id, coins: 0, items: [], confirmed: false }
  };

  function buildTradePanel(expired = false) {
   const senderItems = state.sender.items.length ? state.sender.items.map(i => `**${i}**`).join(', ') : '—';
   const receiverItems = state.receiver.items.length ? state.receiver.items.map(i => `**${i}**`).join(', ') : '—';
   const senderStatus = state.sender.confirmed ? 'Confirmed' : 'Pending';
   const receiverStatus = state.receiver.confirmed ? 'Confirmed' : 'Pending';

   const container = new ContainerBuilder()
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`## Trade Session\n<@${user.id}>  <@${targetUser.id}>`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**<@${user.id}>'s Offer** — ${senderStatus}\n` +
      `${EMOJIS.coin} **${state.sender.coins.toLocaleString()}** coins\n` +
      `Items: ${senderItems}`
     )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      `**<@${targetUser.id}>'s Offer** — ${receiverStatus}\n` +
      `${EMOJIS.coin} **${state.receiver.coins.toLocaleString()}** coins\n` +
      `Items: ${receiverItems}`
     )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

   if (!expired) {
    container.addActionRowComponents(
     new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trade_add_coins').setLabel('Add Coins').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('trade_add_item').setLabel('Add Item').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('trade_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('trade_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
     )
    );
   }

   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     expired
      ? '-# Trade session expired.'
      : '-# Both parties must confirm to execute • Max 5 items per side • Expires in 2 minutes'
    )
   );

   return container;
  }

  const sent = await interaction.reply({
   flags: MessageFlags.IsComponentsV2,
   components: [buildTradePanel()],
   fetchReply: true
  });

  const collector = sent.createMessageComponentCollector({
   componentType: ComponentType.Button,
   time: 120000
  });

  collector.on('collect', async (i) => {
   if (i.user.id !== user.id && i.user.id !== targetUser.id) {
    return i.reply({ content: 'This trade session does not involve you.', ephemeral: true });
   }

   const party = i.user.id === user.id ? state.sender : state.receiver;
   const otherParty = i.user.id === user.id ? state.receiver : state.sender;

   if (i.customId === 'trade_cancel') {
    collector.stop('cancelled');
    return i.update({
     flags: MessageFlags.IsComponentsV2,
     components: [
      new ContainerBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `## Trade Cancelled\n<@${i.user.id}> has cancelled this trade session.`
        )
       )
     ]
    });
   }

   if (i.customId === 'trade_confirm') {
    party.confirmed = true;

    if (!state.sender.confirmed || !state.receiver.confirmed) {
     return i.update({ flags: MessageFlags.IsComponentsV2, components: [buildTradePanel()] });
    }

    // Both confirmed — validate then execute
    collector.stop('completed');

    const [senderProfile, receiverProfile, senderInv, receiverInv] = await Promise.all([
     db.getProfile(guild.id, user.id),
     db.getProfile(guild.id, targetUser.id),
     db.getInventory(guild.id, user.id),
     db.getInventory(guild.id, targetUser.id)
    ]);

    if (senderProfile.coins < state.sender.coins) {
     return i.update({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
         `## Trade Failed\n<@${user.id}> no longer has enough coins to fulfil their offer.`
        ))
      ]
     });
    }
    if (receiverProfile.coins < state.receiver.coins) {
     return i.update({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
         `## Trade Failed\n<@${targetUser.id}> no longer has enough coins to fulfil their offer.`
        ))
      ]
     });
    }
    for (const item of state.sender.items) {
     if (!senderInv.includes(item)) {
      return i.update({
       flags: MessageFlags.IsComponentsV2,
       components: [
         new ContainerBuilder()
         .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `## Trade Failed\n<@${user.id}> no longer has **${item}** in their inventory.`
         ))
       ]
      });
     }
    }
    for (const item of state.receiver.items) {
     if (!receiverInv.includes(item)) {
      return i.update({
       flags: MessageFlags.IsComponentsV2,
       components: [
         new ContainerBuilder()
         .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `## Trade Failed\n<@${targetUser.id}> no longer has **${item}** in their inventory.`
         ))
       ]
      });
     }
    }

    // Execute coin transfers
    if (state.sender.coins > 0) {
     await db.updateCoins(guild.id, user.id, -state.sender.coins);
     await db.updateCoins(guild.id, targetUser.id, state.sender.coins);
    }
    if (state.receiver.coins > 0) {
     await db.updateCoins(guild.id, targetUser.id, -state.receiver.coins);
     await db.updateCoins(guild.id, user.id, state.receiver.coins);
    }

    // Execute item transfers
    for (const item of state.sender.items) {
     await db.giftItem(guild.id, user.id, targetUser.id, item);
    }
    for (const item of state.receiver.items) {
     await db.giftItem(guild.id, targetUser.id, user.id, item);
    }

    const senderGave = [
     ...(state.sender.coins > 0 ? [`${EMOJIS.coin} ${state.sender.coins.toLocaleString()} coins`] : []),
     ...state.sender.items.map(it => `**${it}**`)
    ];
    const receiverGave = [
     ...(state.receiver.coins > 0 ? [`${EMOJIS.coin} ${state.receiver.coins.toLocaleString()} coins`] : []),
     ...state.receiver.items.map(it => `**${it}**`)
    ];

    return i.update({
     flags: MessageFlags.IsComponentsV2,
     components: [
      new ContainerBuilder()
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Trade Executed`)
       )
       .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
         `**<@${user.id}> gave:** ${senderGave.length ? senderGave.join(', ') : '—'}\n` +
         `**<@${targetUser.id}> gave:** ${receiverGave.length ? receiverGave.join(', ') : '—'}`
        )
       )
       .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# All transfers settled and recorded in the database')
       )
     ]
    });
   }

   if (i.customId === 'trade_add_coins') {
    const modal = new ModalBuilder()
     .setCustomId(`trade_coins_${i.user.id}_${Date.now()}`)
     .setTitle('Set Coin Offer')
     .addComponents(
      new ActionRowBuilder().addComponents(
       new TextInputBuilder()
        .setCustomId('coin_amount')
        .setLabel('How many coins do you want to offer?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 500')
        .setRequired(true)
      )
     );

    await i.showModal(modal);

    const modalSubmit = await i.awaitModalSubmit({
     time: 60000,
     filter: m => m.user.id === i.user.id && m.customId.startsWith(`trade_coins_${i.user.id}`)
    }).catch(() => null);
    if (!modalSubmit) return;

    const amount = parseInt(modalSubmit.fields.getTextInputValue('coin_amount'), 10);
    if (isNaN(amount) || amount < 0) {
     return modalSubmit.reply({ content: 'Enter a valid non-negative integer.', ephemeral: true });
    }

    if (amount > 0) {
     const profile = await db.getProfile(guild.id, i.user.id);
     if (profile.coins < amount) {
      return modalSubmit.reply({
       content: `Insufficient balance. You only have ${EMOJIS.coin} **${profile.coins.toLocaleString()}** coins.`,
       ephemeral: true
      });
     }
    }

    party.coins = amount;
    party.confirmed = false;
    otherParty.confirmed = false;

    return modalSubmit.update({ flags: MessageFlags.IsComponentsV2, components: [buildTradePanel()] });
   }

   if (i.customId === 'trade_add_item') {
    const modal = new ModalBuilder()
     .setCustomId(`trade_item_${i.user.id}_${Date.now()}`)
     .setTitle('Add Item to Offer')
     .addComponents(
      new ActionRowBuilder().addComponents(
       new TextInputBuilder()
        .setCustomId('item_name')
        .setLabel('Item name (exact, from your inventory)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Fishing Pole')
        .setRequired(true)
      )
     );

    await i.showModal(modal);

    const modalSubmit = await i.awaitModalSubmit({
     time: 60000,
     filter: m => m.user.id === i.user.id && m.customId.startsWith(`trade_item_${i.user.id}`)
    }).catch(() => null);
    if (!modalSubmit) return;

    const itemName = modalSubmit.fields.getTextInputValue('item_name').trim();
    const inventory = await db.getInventory(guild.id, i.user.id);
    const match = inventory.find(it => it.toLowerCase() === itemName.toLowerCase());

    if (!match) {
     return modalSubmit.reply({ content: `You don't have **${itemName}** in your inventory.`, ephemeral: true });
    }
    if (party.items.map(it => it.toLowerCase()).includes(match.toLowerCase())) {
     return modalSubmit.reply({ content: `**${match}** is already in your offer.`, ephemeral: true });
    }
    if (party.items.length >= 5) {
     return modalSubmit.reply({ content: 'Maximum 5 items per trade offer.', ephemeral: true });
    }

    party.items.push(match);
    party.confirmed = false;
    otherParty.confirmed = false;

    return modalSubmit.update({ flags: MessageFlags.IsComponentsV2, components: [buildTradePanel()] });
   }
  });

  collector.on('end', async (_, reason) => {
   if (reason === 'time') {
    await interaction.editReply({
     flags: MessageFlags.IsComponentsV2,
     components: [buildTradePanel(true)]
    }).catch(() => {});
   }
  });
 }
};
