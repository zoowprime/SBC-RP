const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listListings, addListing, removeListing, nextId, addOwned, findOwnedById, setOwned } = require('../utils/properties');

function isAgent(member) {
  const roleId = process.env.IMMO_ROLE_ID;
  const staffId = process.env.STAFF_ROLE_ID;
  if (!member) return false;
  return (roleId && member.roles.cache.has(roleId)) || (staffId && member.roles.cache.has(staffId));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('propriete')
    .setDescription('Système immobilier')

    // Voir les annonces
    .addSubcommand(sc =>
      sc.setName('annonces')
        .setDescription('Voir les annonces')
    )

    // Publier une annonce
    .addSubcommand(sc =>
      sc.setName('publier')
        .setDescription('Publier une annonce (agent immo)')
        .addStringOption(o => o.setName('nom').setDescription('Nom de la propriété').setRequired(true))
        .addStringOption(o => o.setName('mode').setDescription('vente|location').setRequired(true))
        .addIntegerOption(o => o.setName('prix').setDescription('Prix vente/loyer').setRequired(true))
        .addUserOption(o => o.setName('contact').setDescription('Contact agence (tag)').setRequired(true))
        .addStringOption(o => o.setName('image').setDescription('URL image'))
    )

    // Acheter
    .addSubcommand(sc =>
      sc.setName('acheter')
        .setDescription('Acheter depuis une annonce')
        .addStringOption(o => o.setName('annonce_id').setDescription('ID annonce').setRequired(true))
    )

    // Louer
    .addSubcommand(sc =>
      sc.setName('louer')
        .setDescription('Louer depuis une annonce')
        .addStringOption(o => o.setName('annonce_id').setDescription('ID annonce').setRequired(true))
    )

    // Renommer une propriété
    .addSubcommand(sc =>
      sc.setName('nommer')
        .setDescription('Renommer votre propriété')
        .addStringOption(o => o.setName('propriete_id').setDescription('ID').setRequired(true))
        .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true))
    )

    // Gérer les accès
    .addSubcommand(sc =>
      sc.setName('acces')
        .setDescription('Gérer les accès (add/remove/list)')
        .addStringOption(o => o.setName('action').setDescription('add|remove|list').setRequired(true))
        .addStringOption(o => o.setName('propriete_id').setDescription('ID').setRequired(true))
        .addUserOption(o => o.setName('joueur').setDescription('Joueur (pour add/remove)'))
        .addStringOption(o => o.setName('droits').setDescription('voir,depôt,retrait'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ----- ANNONCES -----
    if (sub === 'annonces') {
      const list = listListings();
      if (!list.length) return interaction.reply({ content: 'Aucune annonce pour le moment.', ephemeral: true });
      const embeds = list.slice(0, 10).map(l => {
        const e = new EmbedBuilder()
          .setTitle(`[${l.id}] ${l.name}`)
          .setDescription(`Mode: **${l.mode}** — Prix: **${l.price.toLocaleString()} $**\nContact: <@${l.contactId}>`)
          .setColor(0x5865F2)
          .setTimestamp();
        if (l.image) e.setImage(l.image);
        return e;
      });
      return interaction.reply({ embeds, ephemeral: true });
    }

    // ----- PUBLIER -----
    if (sub === 'publier') {
      if (!isAgent(interaction.member)) return interaction.reply({ content: '⛔ Réservé aux agents.', ephemeral: true });
      const id = nextId('AN');
      const name = interaction.options.getString('nom');
      const mode = interaction.options.getString('mode');
      const price = interaction.options.getInteger('prix');
      const image = interaction.options.getString('image') || null;
      const contact = interaction.options.getUser('contact');
      addListing({ id, name, mode, price, image, contactId: contact.id });
      return interaction.reply({ content: `✅ Annonce publiée: **${id}** (${name})`, ephemeral: true });
    }

    // ----- ACHETER / LOUER -----
    if (sub === 'acheter' || sub === 'louer') {
      const annId = interaction.options.getString('annonce_id');
      const list = listListings();
      const ad = list.find(a => a.id === annId);
      if (!ad) return interaction.reply({ content: 'Annonce introuvable.', ephemeral: true });

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
      return interaction.reply({ content: `🏠 ${sub === 'acheter' ? 'Achat' : 'Location'} confirmée: **${pid}** (${ad.name}).`, ephemeral: true });
    }

    // ----- NOMMER -----
    if (sub === 'nommer') {
      const id = interaction.options.getString('propriete_id');
      const name = interaction.options.getString('nom');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (p.ownerId !== interaction.user.id) return interaction.reply({ content: '⛔ Seul le propriétaire peut renommer.', ephemeral: true });
      p.name = name; setOwned(p);
      return interaction.reply({ content: `✏️ Propriété renommée: **${name}**`, ephemeral: true });
    }

    // ----- ACCES -----
    if (sub === 'acces') {
      const action = interaction.options.getString('action');
      const id = interaction.options.getString('propriete_id');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.', ephemeral: true });
      if (p.ownerId !== interaction.user.id) return interaction.reply({ content: '⛔ Seul le propriétaire peut gérer les accès.', ephemeral: true });

      if (action === 'list') {
        const lines = (p.access || []).map(a => `• <@${a.userId}> — droits: ${a.rights.join(', ')}`);
        return interaction.reply({ content: lines.length ? lines.join('\n') : 'Aucun invité.', ephemeral: true });
      }

      const j = interaction.options.getUser('joueur');
      if (!j) return interaction.reply({ content: 'Spécifie un joueur.', ephemeral: true });

      if (action === 'add') {
        const rightsStr = interaction.options.getString('droits') || 'voir,depôt,retrait';
        const rights = rightsStr.split(',').map(s => s.trim()).filter(Boolean);
        p.access = p.access || [];
        const ex = p.access.find(a => a.userId === j.id);
        if (ex) ex.rights = rights;
        else p.access.push({ userId: j.id, rights });
        setOwned(p);
        return interaction.reply({ content: `✅ Accès mis à jour pour <@${j.id}> (${rights.join(', ')}).`, ephemeral: true });
      }

      if (action === 'remove') {
        p.access = (p.access || []).filter(a => a.userId !== j.id);
        setOwned(p);
        return interaction.reply({ content: `🗝️ Accès retiré pour <@${j.id}>.`, ephemeral: true });
      }

      return interaction.reply({ content: 'Action invalide (add|remove|list).', ephemeral: true });
    }
  }
};
