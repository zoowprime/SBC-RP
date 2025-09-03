// src/commands/propriete.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  listListings, addListing, removeListing,
  nextId, addOwned, findOwnedById, setOwned
} = require('../utils/properties');

const COLORS = {
  primary: 0x5865F2,      // indigo discord
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
    .setDescription(
      `Ta propriété est enregistrée.\n` +
      `Utilise les commandes ci-dessous pour la gérer.`
    )
    .addFields(
      { name: 'ID propriété', value: `\`${property.id}\``, inline: true },
      { name: 'Nom', value: property.name, inline: true },
      { name: 'Résumé', value: rentLine }
    )
    .addFields(
      {
        name: 'Commandes utiles',
        value:
          `• \`/stockage ouvrir propriete_id:${property.id}\` — voir le stockage\n` +
          `• \`/stockage depot propriete_id:${property.id}\` — déposer des items\n` +
          `• \`/stockage retrait propriete_id:${property.id}\` — retirer des items\n` +
          `• \`/propriete acces action:add propriete_id:${property.id}\` — gérer les accès\n` +
          `• \`/propriete nommer propriete_id:${property.id}\` — renommer`,
      }
    )
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

    // ───── PUBLIER (PRIVÉ AGENT) ─────
    if (sub === 'publier') {
      if (!isAgent(interaction.member)) {
        return interaction.reply({ ephemeral: true, embeds: [
          new EmbedBuilder().setColor(COLORS.danger).setDescription('⛔ Réservé aux agents.')
        ]});
      }
      const id      = nextId('AN');
      const name    = interaction.options.getString('nom');
      const mode    = interaction.options.getString('mode');
      const price   = interaction.options.getInteger('prix');
      const image   = interaction.options.getString('image') || null;
      const contact = interaction.options.getUser('contact');

      addListing({ id, name, mode, price, image, contactId: contact.id });

      return interaction.reply({ ephemeral: true, embeds: [
        new EmbedBuilder()
          .setColor(COLORS.success)
          .setTitle('✅ Annonce publiée')
          .setDescription(`**[${id}] ${name}**\nMode: **${mode}** — Prix: **${price.toLocaleString()} $**\nContact: <@${contact.id}>`)
          .setImage(image || null)
      ]});
    }

    // ───── ACHETER / LOUER (PUBLIC + DM) ─────
    if (sub === 'acheter' || sub === 'louer') {
      const annId = interaction.options.getString('annonce_id');
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

      // DM au joueur avec l’ID propriété
      try {
        const dmEmbed = buildOwnerDMEmbed({ property: owned, mode: sub });
        await interaction.user.send({ embeds: [dmEmbed] });
      } catch {
        // DM fermés → on informera dans le canal ci-dessous
      }

      // Confirmation publique (jolie)
      const pub = new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(sub === 'louer' ? '📄 Location confirmée' : '🛒 Achat confirmé')
        .setDescription(
          `Propriété **${owned.name}** enregistrée.\n` +
          `**ID :** \`${owned.id}\` — (l’ID complet a été envoyé en MP)`
        )
        .setFooter({ text: 'SBC Immobilier' })
        .setTimestamp();

      return interaction.reply({ embeds: [pub] });
    }

    // ───── RENOMMER (PUBLIC) ─────
    if (sub === 'nommer') {
      const id   = interaction.options.getString('propriete_id');
      const name = interaction.options.getString('nom');
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

    // ───── ACCÈS (PUBLIC) ─────
    if (sub === 'acces') {
      const action = interaction.options.getString('action');
      const id     = interaction.options.getString('propriete_id');
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
  }
};
