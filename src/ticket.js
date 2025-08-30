// src/ticket.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
require('dotenv').config({ path: './id.env' });

const {
  OPEN_TICKET_CATEGORY_ID,
  CLOSED_TICKET_CATEGORY_ID,
  STAFF_ROLE_ID,
  ID_DU_CANAL_POUR_TICKET,
} = process.env;

// 🎨 Violet SBC
const VIOLET = 0x9B59B6;

// Mapping des raisons (label + value)
const reasons = [
  { label: "Demande particulière",    value: "demande_particuliere" },
  { label: "Création de projet",      value: "creation_projet" },
  { label: "Dépôt dossier illégal",   value: "depot_dossier" },
  { label: "Wipe / mort RP",          value: "wipe_mort_rp" },
  { label: "Demande scène staff",     value: "demande_scene_staff" },
  { label: "Problème groupe/joueur",  value: "probleme_groupe" },
  { label: "Question pertinente",     value: "question_pertinente" }
];

/**
 * Envoie le panel pour ouvrir un ticket dans le channel cible.
 * Ne renvoie rien si un panel "Ouvrir un Ticket" est déjà présent.
 */
async function sendTicketPanel(channel) {
  if (!channel?.isTextBased()) return;

  // 1️⃣ Évite les doublons (scan des 50 derniers messages)
  const fetched = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (fetched?.some(m => m.embeds[0]?.title === "Ouvrir un Ticket")) {
    return;
  }

  // 2️⃣ Envoi du panel
  const embed = new EmbedBuilder()
    .setTitle("Ouvrir un Ticket")
    .setDescription(
      "👋 **BONJOUR À TOUS** 👋\n" +
      "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n" +
      "Merci de **sélectionner une raison** correspondant à votre demande.\n" +
      "Tout ticket **inactif** pourra être **fermé** par le staff.\n" +
      "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬"
    )
    .setColor(VIOLET);

  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket_reason_select")
    .setPlaceholder("Choisissez une raison…")
    .addOptions(reasons);

  const row = new ActionRowBuilder().addComponents(select);

  await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
}

/**
 * Gère toutes les interactions du système de ticket
 */
async function handleTicketInteraction(interaction) {
  // 1️⃣ Sélection de la raison → création du salon
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_reason_select") {
    await interaction.deferReply({ ephemeral: true });

    const choice = interaction.values[0];
    const reason = reasons.find(r => r.value === choice)?.label || choice;

    try {
      const channel = await interaction.guild.channels.create({
        name: `${interaction.user.username}-${choice}`,
        type: ChannelType.GuildText,
        parent: OPEN_TICKET_CATEGORY_ID || null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny:  [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id,  allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: STAFF_ROLE_ID,        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        ],
      });

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Ticket – ${interaction.user.tag}`)
        .setDescription(
          `**Raison :** ${reason}\n\n` +
          "Un membre du **STAFF SBC** va vous prendre en charge au plus vite."
        )
        .setColor(VIOLET);

      const closeBtn = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Fermer le ticket")
        .setStyle(ButtonStyle.Secondary);

      await channel.send({
        embeds: [welcomeEmbed],
        components: [new ActionRowBuilder().addComponents(closeBtn)]
      });

      return interaction.editReply({
        content: `✅ Votre ticket a été créé : ${channel}`,
        ephemeral: true
      });
    } catch (err) {
      console.error("Erreur création ticket :", err);
      return interaction.editReply({
        content: "❌ Impossible de créer le ticket.",
        ephemeral: true
      });
    }
  }

  // 2️⃣ Bouton Fermer → déplacer en fermé + afficher Réouvrir/Supprimer
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Vous n'avez pas la permission.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      if (CLOSED_TICKET_CATEGORY_ID) {
        await interaction.channel.setParent(CLOSED_TICKET_CATEGORY_ID).catch(() => {});
      }

      const closedEmbed = new EmbedBuilder()
        .setTitle("Ticket fermé")
        .setDescription("Ce ticket est désormais fermé.")
        .setColor(VIOLET);

      const reopenBtn = new ButtonBuilder()
        .setCustomId("reopen_ticket")
        .setLabel("Réouvrir")
        .setStyle(ButtonStyle.Primary);
      const deleteBtn = new ButtonBuilder()
        .setCustomId("delete_ticket")
        .setLabel("Supprimer")
        .setStyle(ButtonStyle.Danger);

      await interaction.channel.send({
        embeds: [closedEmbed],
        components: [new ActionRowBuilder().addComponents(reopenBtn, deleteBtn)]
      });

      return interaction.editReply({ content: "🔒 Ticket fermé.", ephemeral: true });
    } catch (err) {
      console.error("Erreur fermeture ticket :", err);
      return interaction.editReply({
        content: "❌ Impossible de fermer le ticket.",
        ephemeral: true
      });
    }
  }

  // 3️⃣ Bouton Réouvrir → déplacer en ouvert + bouton Fermer
  if (interaction.isButton() && interaction.customId === "reopen_ticket") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Vous n'avez pas la permission.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      if (OPEN_TICKET_CATEGORY_ID) {
        await interaction.channel.setParent(OPEN_TICKET_CATEGORY_ID).catch(() => {});
      }

      const reopenEmbed = new EmbedBuilder()
        .setTitle("Ticket réouvert")
        .setDescription("Le ticket a été réouvert.")
        .setColor(VIOLET);

      const closeBtn = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Fermer le ticket")
        .setStyle(ButtonStyle.Secondary);

      await interaction.channel.send({
        embeds: [reopenEmbed],
        components: [new ActionRowBuilder().addComponents(closeBtn)]
      });

      return interaction.editReply({ content: "🔓 Ticket réouvert.", ephemeral: true });
    } catch (err) {
      console.error("Erreur réouverture ticket :", err);
      return interaction.editReply({
        content: "❌ Impossible de réouvrir le ticket.",
        ephemeral: true
      });
    }
  }

  // 4️⃣ Bouton Supprimer → supprime le canal
  if (interaction.isButton() && interaction.customId === "delete_ticket") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Vous n'avez pas la permission.",
        ephemeral: true
      });
    }

    await interaction.reply({ content: "🗑️ Suppression du ticket…", ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(console.error), 1500);
    return;
  }
}

/**
 * Helper: à appeler au ready pour poster le panel automatiquement
 */
async function initTicketPanel(client) {
  if (!ID_DU_CANAL_POUR_TICKET) return;
  try {
    const ch = await client.channels.fetch(ID_DU_CANAL_POUR_TICKET).catch(() => null);
    if (ch) await sendTicketPanel(ch);
  } catch (e) {
    console.warn('⚠️ initTicketPanel: impossible de poster le panel ticket:', e?.message);
  }
}

module.exports = {
  sendTicketPanel,
  handleTicketInteraction,
  initTicketPanel,
  VIOLET,
};
