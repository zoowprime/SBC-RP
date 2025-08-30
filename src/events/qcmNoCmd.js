// src/events/qcmNoCmd.js (ESM)
// Requiert: discord.js v14, ESM actif (package.json: "type": "module")

import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  ComponentType,
} from 'discord.js';

// ✅ Charge le JSON de façon compatible (sans import assertions)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const QUESTIONS = require('../data/qcmQuestions.json');

// 🎨 Couleur violet
const VIOLET = 0x9b59b6;

export const name = 'ready';
export const once = true;

export async function execute(client) {
  // 1) Poster le panneau de lancement une seule fois
  const chId = process.env.QCM_LANCEMENT_CHANNEL;
  if (!chId) return console.error('QCM_LANCEMENT_CHANNEL non défini');

  const ch = await client.channels.fetch(chId).catch(() => null);
  if (!ch || !ch.isTextBased()) return console.error('Salon QCM non trouvé');

  const msgs = await ch.messages.fetch({ limit: 50 }).catch(() => null);
  const already = msgs?.some(
    (m) => m.components.length && m.components[0]?.components?.[0]?.customId === 'qcm_launcher'
  );

  if (!already) {
    const embed = new EmbedBuilder()
      .setTitle('Bonjour !')
      .setDescription(
        `Vous êtes dans le salon pour faire votre QCM. Avant toute chose, vous devez connaître ces salons :\n` +
        `<#${process.env.SALON_1_REGLES}>\n` +
        `<#${process.env.SALON_2_LORE}>\n\n` +
        `Une fois cela fait, ouvrez le menu déroulant ci-dessous et sélectionnez **Débuter le QCM**.`
      )
      .setColor(VIOLET);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('qcm_launcher')
        .setPlaceholder('Débuter le QCM')
        .addOptions([{ label: 'Débuter le QCM', value: 'launch' }])
    );

    await ch.send({ embeds: [embed], components: [row] });
  }

  // 2) Gestion des interactions
  client.on('interactionCreate', async (interaction) => {
    // 2.1 — Menu de lancement
    if (interaction.isStringSelectMenu() && interaction.customId === 'qcm_launcher') {
      const member = interaction.member;

      try {
        if (process.env.QCM_EN_COURS_ROLE_ID) {
          await member.roles.add(process.env.QCM_EN_COURS_ROLE_ID).catch(() => {});
        }
        if (process.env.QCM_A_FAIRE_ROLE_ID) {
          await member.roles.remove(process.env.QCM_A_FAIRE_ROLE_ID).catch(() => {});
        }
        await interaction.reply({
          content: '✅ Vous avez reçu le rôle **QCM EN COURS** ! Création du salon…',
          ephemeral: true
        });
      } catch {
        return interaction
          .reply({ content: '❗ Impossible de préparer votre QCM (permissions ?).', ephemeral: true })
          .catch(() => {});
      }

      // création du salon
      let channel;
      try {
        channel = await interaction.guild.channels.create({
          name: `qcm-${member.user.username}`,
          type: ChannelType.GuildText,
          parent: process.env.QCM_START_CATEGORY_ID,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            {
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            },
            {
              id: process.env.STAFF_ROLE_ID,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
            }
          ]
        });
      } catch {
        return interaction
          .followUp({ content: '❗ Impossible de créer le salon du QCM (permissions ?).', ephemeral: true })
          .catch(() => {});
      }

      // menu Oui/Non
      const startEmbed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('Souhaitez-vous lancer le QCM ?')
        .setDescription('Sélectionnez **Oui** pour démarrer, **Non** pour annuler.');

      const startRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`qcm_start_${member.id}`)
          .setPlaceholder('Votre choix…')
          .addOptions([{ label: 'Oui', value: 'yes' }, { label: 'Non', value: 'no' }])
      );

      await channel.send({ embeds: [startEmbed], components: [startRow] });
      return;
    }

    // 2.2 — Oui/Non
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('qcm_start_')) {
      const userId = interaction.customId.split('_')[2];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Ce menu n’est pas pour vous.', ephemeral: true });
      }

      const choice = interaction.values[0];
      const channel = interaction.channel;

      // Annulation
      if (choice === 'no') {
        await interaction
          .update({
            embeds: [
              new EmbedBuilder().setColor(VIOLET).setTitle('QCM annulé').setDescription('Vous avez annulé le QCM.')
            ],
            components: []
          })
          .catch(() => {});
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member) {
          if (process.env.QCM_EN_COURS_ROLE_ID)
            await member.roles.remove(process.env.QCM_EN_COURS_ROLE_ID).catch(() => {});
          if (process.env.QCM_A_FAIRE_ROLE_ID)
            await member.roles.add(process.env.QCM_A_FAIRE_ROLE_ID).catch(() => {});
        }
        return setTimeout(() => channel?.delete().catch(() => {}), 10_000);
      }

      // Lancement
      await interaction.update({ content: '🎬 Le QCM démarre…', embeds: [], components: [] }).catch(() => {});
      channel.qcmScore = 0;

      const pool = QUESTIONS.slice().sort(() => 0.5 - Math.random()).slice(0, 30);

      for (let i = 0; i < pool.length; i++) {
        const q = pool[i];
        const qEmbed = new EmbedBuilder().setColor(VIOLET).setTitle(`Question ${i + 1}`).setDescription(q.question);
        const qRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`qcm_q_${userId}_${i}`)
            .setPlaceholder('Votre réponse…')
            .addOptions(q.choices.map((c, idx) => ({ label: c, value: `${idx}` })))
        );

        const qMsg = await channel.send({ embeds: [qEmbed], components: [qRow] });

        const collected = await qMsg
          .awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 120_000 })
          .catch(() => null);

        if (collected && collected.user.id === userId && q.choices[+collected.values[0]] === q.answer) {
          channel.qcmScore++;
        }

        await qMsg.edit({ components: [] }).catch(() => {});
      }

      const passed = channel.qcmScore >= 20;
      const endEmbed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('QCM terminé')
        .setDescription(
          `Vous avez obtenu **${channel.qcmScore} / 30** réponses correctes.\n` +
            (passed
              ? '🎉 Bravo, vous avez réussi ! Cliquez sur le bouton pour terminer.'
              : '❌ Vous n’avez pas atteint 20 bonnes réponses. Vous pourrez réessayer dans 24h.')
        );

      const endRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`qcm_finish_${userId}`).setLabel('Terminer le QCM').setStyle(ButtonStyle.Primary)
      );

      await channel.send({ embeds: [endEmbed], components: [endRow] });
      return;
    }

    // 2.3 — Terminer → archive + bouton supprimer
    if (interaction.isButton() && interaction.customId.startsWith('qcm_finish_')) {
      const userId = interaction.customId.split('_')[2];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Ce bouton n’est pas pour vous.', ephemeral: true });
      }

      const channel = interaction.channel;
      const score = channel?.qcmScore ?? 0;
      const passed = score >= 20;

      await interaction.deferUpdate().catch(() => {});

      let permsIssue = false;
      try {
        const member = await interaction.guild.members.fetch(userId);
        if (process.env.QCM_EN_COURS_ROLE_ID)
          await member.roles.remove(process.env.QCM_EN_COURS_ROLE_ID).catch(() => {});
        if (passed && process.env.CITIZEN_ROLE_ID) {
          await member.roles.add(process.env.CITIZEN_ROLE_ID).catch(() => {
            permsIssue = true;
          });
        } else if (!passed && process.env.QCM_A_FAIRE_ROLE_ID) {
          await member.roles.add(process.env.QCM_A_FAIRE_ROLE_ID).catch(() => {
            permsIssue = true;
          });
        }
      } catch {
        permsIssue = true;
      }

      try {
        if (process.env.QCM_END_CATEGORY_ID)
          await channel.setParent(process.env.QCM_END_CATEGORY_ID).catch(() => {
            permsIssue = true;
          });
      } catch {
        permsIssue = true;
      }

      const archiveText = `✅ <@${userId}> a fait **${score} / 30** au QCM, salon archivé.`;
      const deleteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`qcm_delete_${userId}`).setLabel('Supprimer le salon').setStyle(ButtonStyle.Danger)
      );

      try {
        await interaction.message.edit({ content: archiveText, embeds: [], components: [deleteRow] });
      } catch {
        await channel.send({ content: archiveText, components: [deleteRow] }).catch(() => {});
      }

      if (permsIssue)
        await channel.send('⚠️ Certaines actions n’ont pas pu être appliquées (permissions/hiérarchie de rôles ?).').catch(() => {});
      return;
    }

    // 2.4 — Bouton supprimer (staff only)
    if (interaction.isButton() && interaction.customId.startsWith('qcm_delete_')) {
      const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);
      if (!isStaff) {
        return interaction.reply({ content: '❌ Seul le staff peut supprimer ce salon.', ephemeral: true });
      }

      await interaction.deferUpdate().catch(() => {});
      const channel = interaction.channel;
      try {
        await channel.send('🗑️ Suppression du salon dans 3 secondes…').catch(() => {});
        setTimeout(() => channel.delete().catch(() => {}), 3000);
      } catch {
        await channel.send('❗ Impossible de supprimer le salon (permissions ?).').catch(() => {});
      }
      return;
    }
  });
}
