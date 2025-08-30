// src/commands/inventaire.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });

const {
  BLACK, CAT_CHOICES, validCategory, sanitize,
  getInv, setInv, buildInventoryEmbed, isStaff, logInventory,
} = require('../inventory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('Inventaire persistant (Voitures, Armes, Permis)')

    // 1) Afficher
    .addSubcommand(sc =>
      sc.setName('afficher')
        .setDescription('Afficher un inventaire.')
        .addUserOption(o => o.setName('target').setDescription('Joueur à afficher').setRequired(false))
    )

    // 2) Ajouter (self)
    .addSubcommand(sc =>
      sc.setName('ajouter')
        .setDescription('Ajouter un item à votre inventaire.')
        .addStringOption(o =>
          o.setName('categorie')
           .setDescription('Catégorie')
           .addChoices(
             { name: 'Voitures', value: 'voitures' },
             { name: 'Armes',    value: 'armes'    },
             { name: 'Permis',   value: 'permis'   },
           )
           .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('item')
           .setDescription("Nom de l'item")
           .setRequired(true)
        )
    )

    // 3) Retirer (self)
    .addSubcommand(sc =>
      sc.setName('retirer')
        .setDescription('Retirer un item de votre inventaire (nom exact).')
        .addStringOption(o =>
          o.setName('categorie')
           .setDescription('Catégorie')
           .addChoices(
             { name: 'Voitures', value: 'voitures' },
             { name: 'Armes',    value: 'armes'    },
             { name: 'Permis',   value: 'permis'   },
           )
           .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('item')
           .setDescription("Nom exact à retirer")
           .setRequired(true)
        )
    )

    // 4) Supprimer (staff) — reset total
    .addSubcommand(sc =>
      sc.setName('supprimer')
        .setDescription("STAFF : réinitialiser totalement l'inventaire d'un joueur.")
        .addUserOption(o => o.setName('target').setDescription('Joueur visé').setRequired(true))
    )

    // 5) Voler
    .addSubcommand(sc =>
      sc.setName('voler')
        .setDescription("Voler un item dans l'inventaire d'un joueur.")
        .addUserOption(o => o.setName('target').setDescription('Victime').setRequired(true))
        .addStringOption(o =>
          o.setName('categorie')
           .setDescription('Catégorie de l’item à voler')
           .addChoices(
             { name: 'Voitures', value: 'voitures' },
             { name: 'Armes',    value: 'armes'    },
             { name: 'Permis',   value: 'permis'   },
           )
           .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('item')
           .setDescription("Nom exact à voler")
           .setRequired(true)
        )
    )
    .setDMPermission(false),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const guildId= interaction.guildId;
    const me     = interaction.user;

    // 1) Afficher
    if (sub === 'afficher') {
      const target = interaction.options.getUser('target') || me;
      const inv    = getInv(guildId, target.id);

      const embed = new EmbedBuilder(buildInventoryEmbed({ tag: target.tag, inv }))
        .setTitle(`🗃️ Inventaire de ${target.tag}`) // réassure le titre
        .setColor(BLACK)
        .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }));

      return interaction.reply({ embeds: [embed] });
    }

    // 2) Ajouter
    if (sub === 'ajouter') {
      const key  = interaction.options.getString('categorie', true);
      const meta = validCategory(key);
      if (!meta) return interaction.reply({ content: '❌ Catégorie invalide.' });

      const item = sanitize(interaction.options.getString('item', true));
      if (!item) return interaction.reply({ content: '❌ Nom invalide.' });

      let added = false;
      const inv = setInv(guildId, me.id, (u) => {
        if (!u[key].includes(item)) {
          u[key].push(item);
          added = true;
        }
      });

      if (!added) {
        return interaction.reply({ content: `ℹ️ L’item **${item}** est déjà présent dans **${meta.label}**.` });
      }

      await logInventory(client, `➕ ${interaction.user.tag} a ajouté **${item}** dans ${meta.label}.`);

      const embed = new EmbedBuilder()
        .setColor(BLACK)
        .setTitle(`${meta.emoji} Ajout à l’inventaire`)
        .setDescription(`**${item}** ajouté dans **${meta.label}**.`)
        .setFooter({ text: 'SBC Inventaire' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3) Retirer
    if (sub === 'retirer') {
      const key  = interaction.options.getString('categorie', true);
      const meta = validCategory(key);
      if (!meta) return interaction.reply({ content: '❌ Catégorie invalide.' });

      const item = sanitize(interaction.options.getString('item', true));
      if (!item) return interaction.reply({ content: '❌ Nom invalide.' });

      let removed = false;
      const inv = setInv(guildId, me.id, (u) => {
        const idx = u[key].indexOf(item);
        if (idx !== -1) {
          u[key].splice(idx, 1);
          removed = true;
        }
      });

      if (!removed) {
        return interaction.reply({ content: `❌ **${item}** n’a pas été trouvé dans **${meta.label}** (nom exact requis).` });
      }

      await logInventory(client, `➖ ${interaction.user.tag} a retiré **${item}** de ${meta.label}.`);

      const embed = new EmbedBuilder()
        .setColor(BLACK)
        .setTitle(`🗑️ Retrait d’inventaire`)
        .setDescription(`**${item}** retiré de **${meta.label}**.`)
        .setFooter({ text: 'SBC Inventaire' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 4) Supprimer (reset total) — STAFF
    if (sub === 'supprimer') {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: '❌ Réservé au staff.' });
      }
      const target = interaction.options.getUser('target', true);

      setInv(guildId, target.id, (u) => {
        u.voitures = [];
        u.armes    = [];
        u.permis   = [];
      });

      await logInventory(client, `🧹 Reset total de l’inventaire de ${target.tag} par ${interaction.user.tag}.`);

      const embed = new EmbedBuilder()
        .setColor(BLACK)
        .setTitle(`🧹 Inventaire réinitialisé`)
        .setDescription(`L’inventaire de **${target.tag}** a été **entièrement** supprimé.`)
        .setFooter({ text: 'SBC Inventaire • STAFF' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 5) Voler
    if (sub === 'voler') {
      const target = interaction.options.getUser('target', true);
      if (target.id === me.id) return interaction.reply({ content: '❌ Tu ne peux pas te voler toi-même.' });

      const key  = interaction.options.getString('categorie', true);
      const meta = validCategory(key);
      if (!meta) return interaction.reply({ content: '❌ Catégorie invalide.' });

      const item = sanitize(interaction.options.getString('item', true));
      if (!item) return interaction.reply({ content: '❌ Nom invalide.' });

      let ok = false;
      // Retire chez la victime…
      const victimInv = getInv(guildId, target.id);
      if (!victimInv[key].includes(item)) {
        return interaction.reply({ content: `❌ **${item}** n’est pas présent dans **${meta.label}** de ${target.tag}.` });
      }
      setInv(guildId, target.id, (u) => {
        const idx = u[key].indexOf(item);
        if (idx !== -1) {
          u[key].splice(idx, 1);
          ok = true;
        }
      });
      if (!ok) {
        return interaction.reply({ content: `❌ Impossible de voler **${item}** (race condition). Réessaie.` });
      }
      // … et ajoute au voleur
      setInv(guildId, me.id, (u) => {
        if (!u[key].includes(item)) u[key].push(item);
      });

      await logInventory(client, `🕵️ ${interaction.user.tag} a volé **${item}** à ${target.tag} (cat: ${meta.label}).`);

      const embed = new EmbedBuilder()
        .setColor(BLACK)
        .setTitle(`🕵️ Vol d’inventaire`)
        .setDescription(`Tu as volé **${item}** à **${target.tag}**.\nAjouté à ta catégorie **${meta.label}**.`)
        .setFooter({ text: 'SBC Inventaire' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};
