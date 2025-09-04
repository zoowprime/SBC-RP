// src/commands/propriete.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { listListings, addListing, removeListing, nextId, addOwned, findOwnedById, setOwned } = require('../utils/properties');
const { listAccessibleProps } = require('../utils/props-access');
const { sendPropertyPicker } = require('../ui/pickers');

function isAgent(member) {
  const roleId = process.env.IMMO_ROLE_ID;
  const staffId = process.env.STAFF_ROLE_ID;
  if (!member) return false;
  return (roleId && member.roles.cache.has(roleId)) || (staffId && member.roles.cache.has(staffId));
}
const COLOR = 0x5865F2;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('propriete')
    .setDescription('Système immobilier')
    .addSubcommand(sc => sc.setName('annonces').setDescription('Voir les annonces'))
    .addSubcommand(sc => sc.setName('publier')
      .setDescription('Publier une annonce (agent immo)')
      .addStringOption(o=>o.setName('nom').setDescription('Nom de la propriété').setRequired(true))
      .addStringOption(o=>o.setName('mode').setDescription('vente|location').setRequired(true))
      .addIntegerOption(o=>o.setName('prix').setDescription('Prix vente/loyer').setRequired(true))
      .addUserOption(o=>o.setName('contact').setDescription('Contact agence (tag)').setRequired(true))
      .addStringOption(o=>o.setName('image').setDescription('URL image'))
    )
    .addSubcommand(sc => sc.setName('acheter')
      .setDescription('Acheter depuis une annonce')
      .addStringOption(o=>o.setName('annonce_id').setDescription('ID annonce').setRequired(true)))
    .addSubcommand(sc => sc.setName('louer')
      .setDescription('Louer depuis une annonce')
      .addStringOption(o=>o.setName('annonce_id').setDescription('ID annonce').setRequired(true)))
    .addSubcommand(sc => sc.setName('nommer')
      .setDescription('Renommer votre propriété')
      .addStringOption(o=>o.setName('propriete_id').setDescription('ID').setRequired(true))
      .addStringOption(o=>o.setName('nom').setDescription('Nouveau nom').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('acces')
      .setDescription('Gérer les accès (add/remove/list)')
      .addStringOption(o=>o.setName('action').setDescription('add|remove|list').setRequired(true))
      .addStringOption(o=>o.setName('propriete_id').setDescription('ID').setRequired(true))
      .addUserOption(o=>o.setName('joueur').setDescription('Joueur (pour add/remove)'))
      .addStringOption(o=>o.setName('droits').setDescription('voir,depôt,retrait'))
    )
    .addSubcommand(sc => sc.setName('acces-panel').setDescription('Gérer les accès via panneau (sans ID)')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'annonces') {
      const list = listListings();
      if (!list.length) return interaction.reply({ content: 'Aucune annonce pour le moment.' });
      const embeds = list.slice(0,10).map(l=>{
        const e = new EmbedBuilder().setColor(COLOR).setTitle(`[${l.id}] ${l.name}`)
          .setDescription(`Mode: **${l.mode}** — Prix: **${l.price.toLocaleString()} $**\nContact: <@${l.contactId}>`).setTimestamp();
        if (l.image) e.setImage(l.image); return e;
      });
      return interaction.reply({ embeds });
    }

    if (sub === 'publier') {
      if (!isAgent(interaction.member)) return interaction.reply({ content: '⛔ Réservé aux agents.' });
      const id = nextId('AN');
      const name = interaction.options.getString('nom');
      const mode = interaction.options.getString('mode');
      const price = interaction.options.getInteger('prix');
      const image = interaction.options.getString('image') || null;
      const contact = interaction.options.getUser('contact');
      addListing({ id, name, mode, price, image, contactId: contact.id });
      return interaction.reply({ content: `✅ Annonce publiée: **${id}** (${name})` });
    }

    if (sub === 'acheter' || sub === 'louer') {
      const annId = interaction.options.getString('annonce_id');
      const list = listListings();
      const ad = list.find(a => a.id === annId);
      if (!ad) return interaction.reply({ content: 'Annonce introuvable.' });

      const pid = nextId('PR');
      const owned = {
        id: pid, ownerId: interaction.user.id, name: ad.name,
        access: [], storage: { items: [] },
        rent: { active: (sub==='louer'), agencyId: ad.contactId, nextAt: Date.now() + 7*24*3600*1000, weekly: ad.price }
      };
      addOwned(owned);
      removeListing(annId);

      // MP l’ID au joueur
      try { await interaction.user.send(`🏠 **${sub==='acheter'?'Achat':'Location'}** confirmée: **${pid}** (${ad.name}). Garde cet ID.`); } catch {}
      return interaction.reply({ content: `🏠 ${sub==='acheter'?'Achat':'Location'} confirmée: **${pid}** (${ad.name}).` });
    }

    if (sub === 'nommer') {
      const id = interaction.options.getString('propriete_id');
      const name = interaction.options.getString('nom');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.' });
      if (p.ownerId !== interaction.user.id) return interaction.reply({ content: '⛔ Seul le propriétaire peut renommer.' });
      p.name = name; setOwned(p);
      return interaction.reply({ content: `✏️ Propriété renommée: **${name}**` });
    }

    if (sub === 'acces') {
      const action = interaction.options.getString('action');
      const id = interaction.options.getString('propriete_id');
      const p = findOwnedById(id);
      if (!p) return interaction.reply({ content: 'Propriété introuvable.' });
      if (p.ownerId !== interaction.user.id) return interaction.reply({ content: '⛔ Seul le propriétaire peut gérer les accès.' });

      if (action === 'list') {
        const lines = (p.access||[]).map(a => `• <@${a.userId}> — droits: ${a.rights.join(', ')}`);
        return interaction.reply({ content: lines.length? lines.join('\n') : 'Aucun invité.' });
      }
      const j = interaction.options.getUser('joueur');
      if (!j) return interaction.reply({ content: 'Spécifie un joueur.' });

      if (action === 'add') {
        const rightsStr = interaction.options.getString('droits') || 'voir,depôt,retrait';
        const rights = rightsStr.split(',').map(s=>s.trim()).filter(Boolean);
        p.access = p.access || [];
        const ex = p.access.find(a => a.userId === j.id);
        if (ex) ex.rights = rights; else p.access.push({ userId: j.id, rights });
        setOwned(p);
        return interaction.reply({ content: `✅ Accès mis à jour pour <@${j.id}> (${rights.join(', ')}).` });
      }
      if (action === 'remove') {
        p.access = (p.access||[]).filter(a => a.userId !== j.id);
        setOwned(p);
        return interaction.reply({ content: `🗝️ Accès retiré pour <@${j.id}>.` });
      }
      return interaction.reply({ content: 'Action invalide (add|remove|list).' });
    }

    if (sub === 'acces-panel') {
      const uid = interaction.user.id;
      const own = (listAccessibleProps(uid, null) || []).filter(p => p.ownerId === uid);
      if (!own.length) return interaction.reply({ content:'Tu ne possèdes aucune propriété.', ephemeral:true });
      return sendPropertyPicker(interaction, own.map(p=>({id:p.id,name:p.name,ptype:p.ptype||null})), 'PROP_PICK:propriete_access_panel', 'Choisis ta propriété', true);
    }
  },

  // hook panel (picker)
  async panelFromPicker(interaction, propId) {
    const p = findOwnedById(propId);
    if (!p) return interaction.update({ content:'Propriété introuvable.', components:[], embeds:[] });
    if (interaction.user.id !== p.ownerId) return interaction.update({ content:'Seul le propriétaire peut gérer les accès.', components:[], embeds:[] });

    const row1 = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(`ACC_USER:${p.id}`).setPlaceholder('Choisis un joueur').setMinValues(1).setMaxValues(1)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`ACC_RIGHTS:${p.id}`).setPlaceholder('Choisis les droits').setMinValues(1).setMaxValues(3)
        .addOptions({label:'voir',value:'voir'},{label:'depôt',value:'depôt'},{label:'retrait',value:'retrait'})
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ACC_APPLY:${p.id}`).setStyle(ButtonStyle.Success).setLabel('✅ Appliquer'),
      new ButtonBuilder().setCustomId(`ACC_REMOVE:${p.id}`).setStyle(ButtonStyle.Danger).setLabel('🗝️ Retirer accès')
    );

    await interaction.update({
      embeds:[{ color:COLOR, title:`🔐 Accès — ${p.name}`, description:'Sélectionne un **joueur** puis les **droits**, puis clique sur **Appliquer** (ou **Retirer accès**).' }],
      components:[row1,row2,row3]
    });
  }
};
