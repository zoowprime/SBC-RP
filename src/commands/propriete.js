// src/commands/propriete.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const {
  listListings, addListing, removeListing,
  nextId, addOwned, findOwnedById, setOwned, removeOwnedById
} = require('../utils/properties');

// 💸 économie
const { getOrCreateAccount, updateAccount } = require('../economyData');

const COLORS = {
  primary: 0x9B59B6,      // violet SBC
  success: 0x57F287,      // green
  warning: 0xFEE75C,      // yellow
  danger:  0xED4245,      // red
  slate:   0x2B2D31       // slate bg
};

function isAgent(member) {
  const roleId  = process.env.IMMO_ROLE_ID;
  const staffId = process.env.STAFF_ROLE_ID;
  if (!member) return false;
  return (roleId && member.roles.cache.has(roleId)) || (staffId && member.roles.cache.has(staffId));
}

// 💸 crédite l'agent sur entreprise.banque
function creditAgentEnterprise(agentUserId, amount) {
  if (!agentUserId || !amount || amount <= 0) return null;
  const acc = getOrCreateAccount(agentUserId);
  acc.entreprise = acc.entreprise || { banque: 0, liquide: 0 };
  acc.entreprise.banque += amount;
  updateAccount(agentUserId, acc);
  return acc.entreprise.banque;
}

function buildListingEmbed(l) {
  const e = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`🏠 [${l.id}] ${l.name}`)
    .setDescription(
      `**Mode :** ${l.mode === 'location' ? 'Location' : 'Vente'}\n` +
      `**Prix :** ${Number(l.price).toLocaleString()} $`
    )
    .addFields({ name: 'Contact', value: `<@${l.contactId}>`, inline: true })
    .setFooter({ text: 'SBC Immobilier' })
    .setTimestamp();
  if (l.image) e.setImage(l.image);
  return e;
}

function buildOwnerDMEmbed({ property, mode }) {
  const rentLine = property?.rent?.active
    ? `**Loyer hebdo :** ${Number(property.rent.weekly).toLocaleString()} $\n` +
      `**Prochaine échéance :** <t:${Math.floor((property.rent.nextAt || Date.now())/1000)}:R>`
    : `**Statut :** Achat — aucun loyer.`;

  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅ ${mode === 'louer' ? 'Location' : 'Achat'} confirmé`)
    .setDescription(`Ta propriété est enregistrée. Conserve bien l’ID.`)
    .addFields(
      { name: 'ID propriété', value: `\`${property.id}\``, inline: true },
      { name: 'Nom', value: property.name, inline: true },
      { name: 'Résumé', value: rentLine }
    )
    .addFields({
      name: 'Commandes utiles',
      value:
        `• \`/stockage ouvrir propriete_id:${property.id}\`\n` +
        `• \`/stockage depot propriete_id:${property.id}\`\n` +
        `• \`/stockage retrait propriete_id:${property.id}\`\n` +
        `• \`/propriete acces action:add propriete_id:${property.id}\`\n` +
        `• \`/propriete nommer propriete_id:${property.id}\``
    })
    .setFooter({ text: 'SBC Immobilier — conserve bien cet ID !' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('propriete')
    .setDescription('Système immobilier')

    .addSubcommand(sc =>
      sc.setName('annonces')
        .setDescription('Voir les annonces')
    )

    .addSubcommand(sc =>
      sc.setName('publier')
        .setDescription('Publier une annonce (agent immo)')
        .addStringOption(o => o.setName('nom').setDescription('Nom de la propriété').setRequired(true))
        .addStringOption(o => o.setName('mode').setDescription('vente|location').setRequired(true))
        .addIntegerOption(o => o.setName('prix').setDescription('Prix vente / loyer hebdo').setRequired(true))
        .addUserOption(o => o.setName('contact').setDescription('Contact agence (tag)').setRequired(true))
        .addStringOption(o => o.setName('image').setDescription('URL image'))
    )

    .addSubcommand(sc =>
      sc.setName('acheter')
        .setDescription('Acheter depuis une annonce')
        .addStringOption(o => o.setName('annonce_id').setDescription('ID annonce').setRequired(true))
    )

    .addSubcommand(sc =>
      sc.setName('louer')
        .setDescription('Louer depuis une annonce')
        .addStringOption(o => o.setName('annonce_id').setDescription('ID annonce').setRequired(true))
    )

    .addSubcommand(sc =>
      sc.setName('nommer')
        .setDescription('Renommer votre propriété')
        .addStringOption(o => o.setName('propriete_id').setDescription('ID').setRequired(true))
        .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true))
    )

    .addSubcommand(sc =>
      sc.setName('acces')
        .setDescription('Gérer les accès (add/remove/list)')
        .addStringOption(o => o.setName('action').setDescription('add|remove|list').setRequired(true))
        .addStringOption(o => o.setName('propriete_id').setDescription('ID').setRequired(true))
        .addUserOption   (o => o.setName('joueur').setDescription('Joueur (pour add/remove)'))
        .addStringOption (o => o.setName('droits').setDescription('voir,depôt,retrait'))
    )

    // 🆕 suppression d’une propriété (Agent/Staff)
    .addSubcommand(sc =>
      sc.setName('supprimer')
        .setDescription('Supprimer définitivement une propriété (Agent/Staff).')
        .addStringOption(o => o.setName('propriete_id').setDescription('ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ───── ANNONCES (PUBLIC) ─────
    if (sub === 'annonces') {
      const list = listListings();
      if (!list.length) {
        return interaction.reply({
          embeds: [ new EmbedBuilder().setColor(COLORS.warning).setDescription('Aucune annonce pour le moment.') ]
        });
      }
      const embeds = list.slice(0, 10).map(buildListingEmbed);
      return interaction.reply({ embeds });
    }

    // ───── PUBLIER (AGENT/STAFF) ─────
    if (sub === 'publier') {
      if (!isAgent(interaction.member)) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('⛔ Réservé aux agents immobiliers / staff.')
        ]});
      }
      const id      = nextId('AN');
      const name    = interaction.options.getString('nom', true);
      const mode    = interaction.options.getString('mode', true);
      const price   = interaction.options.getInteger('prix', true);
      const image   = interaction.options.getString('image') || null;
      const contact = interaction.options.getUser('contact', true);

      addListing({ id, name, mode, price, image, contactId: contact.id });

      return interaction.reply({ embeds: [
        new EmbedBuilder()
          .setColor(COLORS.success)
          .setTitle('✅ Annonce publiée')
          .setDescription(
            `**[${id}] ${name}**\n` +
            `Mode: **${mode}** — Prix: **${price.toLocaleString()} $**\n` +
            `Contact: <@${contact.id}>`
          )
          .setImage(image || null)
      ]});
    }

    // ───── ACHETER / LOUER (PUBLIC + DM + 💸 crédit agent) ─────
    if (sub === 'acheter' || sub === 'louer') {
      const annId = interaction.options.getString('annonce_id', true);
      const list  = listListings();
      const ad    = list.find(a => a.id === annId);
      if (!ad) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('Annonce introuvable.')
        ]});
      }

      const pid = nextId('PR');
      const owned = {
        id: pid,
        ownerId: interaction.user.id,
        name: ad.name,
        access: [],
        storage: { items: [] },
        rent: {
          active: (sub === 'louer'),
          agencyId: ad.contactId,
          nextAt: Date.now() + 7 * 24 * 3600 * 1000,
          weekly: ad.price
        }
      };
      addOwned(owned);
      removeListing(annId);

      // 💸 créditer l’agent : prix (vente) ou 1er loyer (location)
      const credited = Number(ad.price) || 0;
      if (credited > 0) {
        creditAgentEnterprise(ad.contactId, credited);
      }

      // DM au joueur
      try {
        const dmEmbed = buildOwnerDMEmbed({ property: owned, mode: sub });
        await interaction.user.send({ embeds: [dmEmbed] });
      } catch {}

      // Confirmation publique
      const pub = new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(sub === 'louer' ? '📄 Location confirmée' : '🛒 Achat confirmé')
        .setDescription(
          `Propriété **${owned.name}** enregistrée.\n` +
          `**ID :** \`${owned.id}\` — (l’ID complet a été envoyé en MP)`
        )
        .addFields(
          { name: 'Montant versé à l’agent', value: `${credited.toLocaleString()} $`, inline: true },
          { name: 'Agent', value: `<@${ad.contactId}>`, inline: true }
        )
        .setFooter({ text: 'SBC Immobilier' })
        .setTimestamp();

      return interaction.reply({ embeds: [pub] });
    }

    // ───── RENOMMER (PROPRIO) ─────
    if (sub === 'nommer') {
      const id   = interaction.options.getString('propriete_id', true);
      const name = interaction.options.getString('nom', true);
      const p = findOwnedById(id);
      if (!p) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('Propriété introuvable.')
        ]});
      }
      if (p.ownerId !== interaction.user.id) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('⛔ Seul le propriétaire peut renommer.')
        ]});
      }
      p.name = name; setOwned(p);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(COLORS.success).setDescription(`✏️ Propriété renommée : **${name}**`)
      ]});
    }

    // ───── ACCÈS (PROPRIO) ─────
    if (sub === 'acces') {
      const action = interaction.options.getString('action', true);
      const id     = interaction.options.getString('propriete_id', true);
      const p = findOwnedById(id);
      if (!p) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('Propriété introuvable.')
        ]});
      }
      if (p.ownerId !== interaction.user.id) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('⛔ Seul le propriétaire peut gérer les accès.')
        ]});
      }

      if (action === 'list') {
        const lines = (p.access || []).map(a => `• <@${a.userId}> — droits: ${a.rights.join(', ')}`);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLORS.slate)
            .setTitle(`🔑 Accès — ${p.name}`)
            .setDescription(lines.length ? lines.join('\n') : '_Aucun invité._')
        ]});
      }

      const j = interaction.options.getUser('joueur');
      if (!j) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.warning).setDescription('Précise un joueur.')
        ]});
      }

      if (action === 'add') {
        const rightsStr = interaction.options.getString('droits') || 'voir,depôt,retrait';
        const rights = rightsStr.split(',').map(s => s.trim()).filter(Boolean);
        p.access = p.access || [];
        const ex = p.access.find(a => a.userId === j.id);
        if (ex) ex.rights = rights; else p.access.push({ userId: j.id, rights });
        setOwned(p);
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.success)
            .setDescription(`✅ Accès mis à jour pour <@${j.id}> (${rights.join(', ')}).`)
        ]});
      }

      if (action === 'remove') {
        p.access = (p.access || []).filter(a => a.userId !== j.id);
        setOwned(p);
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.success)
            .setDescription(`🗝️ Accès retiré pour <@${j.id}>.`)
        ]});
      }

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(COLORS.warning).setDescription('Action invalide. Utilise `add|remove|list`.')
      ]});
    }

    // ───── SUPPRIMER (AGENT/STAFF) ─────
    if (sub === 'supprimer') {
      if (!isAgent(interaction.member)) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('⛔ Réservé aux agents immobiliers / staff.')
        ]});
      }
      const id = interaction.options.getString('propriete_id', true);
      const p  = findOwnedById(id);
      if (!p) {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(COLORS.warning).setDescription('Propriété introuvable.')
        ]});
      }

      // suppression de la propriété (et stockage si séparé, cf utils)
      const ok = removeOwnedById(id);

      return interaction.reply({ embeds: [
        new EmbedBuilder()
          .setColor(ok ? COLORS.success : COLORS.danger)
          .setTitle(ok ? '🗑️ Propriété supprimée' : '❗ Échec de suppression')
          .setDescription(ok
            ? `La propriété **${p.name}** (\`${p.id}\`) a été supprimée ainsi que son stockage.`
            : `Impossible de supprimer l’ID \`${id}\`.`)
      ]});
    }
  }
};
