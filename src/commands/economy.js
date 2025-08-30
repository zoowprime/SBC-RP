// src/commands/economy.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

require('dotenv').config({ path: './id.env' });
const {
  STAFF_ROLE_ID,
  BANQUIER_ROLE_ID,
} = process.env;

const {
  getUser, setUser, totals,
  accountKeyFromChoice, fieldFromChoice,
  debit, credit, VIOLET, fmt,
  canManage, isBankerOrStaff,
  buildAccountEmbed, logEconomy,
} = require('../economy');

const ACCOUNTS = [
  { name: 'courant',    value: 'courant' },
  { name: 'entreprise', value: 'entreprise' },
];
const FIELDS = [
  { name: 'banque',  value: 'banque' },
  { name: 'liquide', value: 'liquide' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Économie SBC — comptes & transactions')

    // ===== Joueurs =====
    .addSubcommand(sc =>
      sc.setName('afficher-compte')
        .setDescription('Affiche votre compte (ou celui d’un autre).')
        .addUserOption(o => o.setName('target').setDescription('Joueur à afficher').setRequired(false))
    )
    .addSubcommand(sc =>
      sc.setName('payer')
        .setDescription('Payer un joueur.')
        .addStringOption(o => o.setName('source').setDescription('Compte source').addChoices(...ACCOUNTS).setRequired(true))
        .addStringOption(o => o.setName('vers').setDescription('Compte destinataire').addChoices(...ACCOUNTS).setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Destinataire').setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à payer').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('retirer-argent')
        .setDescription('Retirer de la banque vers le liquide.')
        .addStringOption(o => o.setName('compte').setDescription('Compte à débiter').addChoices(...ACCOUNTS).setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à retirer').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('deposer-argent')
        .setDescription('Déposer du liquide vers la banque.')
        .addStringOption(o => o.setName('compte').setDescription('Compte à créditer').addChoices(...ACCOUNTS).setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à déposer').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('voler-argent')
        .setDescription('Voler la moitié du liquide courant de la cible.')
        .addUserOption(o => o.setName('target').setDescription('Victime').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('calculer-taxe')
        .setDescription('Calcule une taxe sur un montant.')
        .addIntegerOption(o => o.setName('montant').setDescription('Montant brut').setMinValue(1).setRequired(true))
        .addNumberOption(o => o.setName('taux').setDescription('Taux % (ex: 15)').setMinValue(0).setRequired(true))
    )

    // ===== Staff =====
    .addSubcommand(sc =>
      sc.setName('supprimer-argent')
        .setDescription('STAFF: remet à 0 un compte (courant OU entreprise).')
        .addStringOption(o => o.setName('compte').setDescription('Compte à reset').addChoices(...ACCOUNTS).setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('giveargent')
        .setDescription('STAFF: donne de l’argent dans un champ de banque.')
        .addStringOption(o => o.setName('champ').setDescription('courant.banque ou entreprise.banque').addChoices(
          { name: 'courant.banque', value: 'courant.banque' },
          { name: 'entreprise.banque', value: 'entreprise.banque' },
        ).setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant').setMinValue(1).setRequired(true))
    )

    // ===== Banquier/Staff =====
    .addSubcommand(sc =>
      sc.setName('geler-compte')
        .setDescription('BANQUIER/STAFF: gèle les comptes (seul le liquide du courant reste utilisable).')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('degeler-compte')
        .setDescription('BANQUIER/STAFF: dégèle les comptes.')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('recuperer-argent')
        .setDescription('BANQUIER/STAFF: saisit un montant sur un compte (puise banque+liquide).')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
        .addStringOption(o => o.setName('compte').setDescription('Compte cible').addChoices(...ACCOUNTS).setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à saisir').setMinValue(1).setRequired(true))
    )
    .setDMPermission(false),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const meId    = interaction.user.id;

    // Helpers d’autorisations
    const requireStaff = () => {
      if (interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) return true;
      interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }).catch(() => {});
      return false;
    };
    const requireBankerOrStaff = () => {
      if (isBankerOrStaff(interaction)) return true;
      interaction.reply({ content: '❌ Réservé aux banquiers/staff.', ephemeral: true }).catch(() => {});
      return false;
    };

    // ───────────────────────────────────────────────────────────────────────────
    if (sub === 'afficher-compte') {
      const target = interaction.options.getUser('target') || interaction.user;
      const data   = getUser(guildId, target.id);

      const embedData = buildAccountEmbed({ user: target.id, tag: target.tag, data });
      const embed = new EmbedBuilder(embedData);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'payer') {
      const sourceChoice = interaction.options.getString('source'); // courant | entreprise
      const destChoice   = interaction.options.getString('vers');   // courant | entreprise
      const target       = interaction.options.getUser('target');
      const amount       = interaction.options.getInteger('montant');

      if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });

      if (target.id === meId) return interaction.reply({ content: '❌ Impossible de vous payer vous-même.', ephemeral: true });

      const srcKey  = accountKeyFromChoice(sourceChoice);
      const dstKey  = accountKeyFromChoice(destChoice);

      // Charger données des deux
      let meData    = getUser(guildId, meId);
      const youData = getUser(guildId, target.id);

      // Règles de gel :
      // - Si je suis gelé: je ne peux payer QUE depuis "courant" liquide (aucun accès banque ni entreprise).
      if (meData.frozen) {
        if (srcKey !== 'current') {
          return interaction.reply({ content: '🧊 Compte gelé : vous ne pouvez payer que depuis le **liquide du compte courant**.', ephemeral: true });
        }
      }

      // Débit côté émetteur
      const debitOpts = meData.frozen
        ? { bankFirst: true, liquidOnly: true }   // gelé → uniquement liquide courant
        : { bankFirst: true, liquidOnly: false }; // normal → banque puis liquide

      const result = setUser(guildId, meId, (u) => {
        meData = u; // mut
      });

      const resDeb = debit(meData, srcKey, amount, debitOpts);
      if (!resDeb.ok) {
        return interaction.reply({ content: `❌ Fonds insuffisants pour payer **${fmt(amount)}**.`, ephemeral: true });
      }
      // Crédit côté destinataire → en **banque** du compte choisi
      credit(youData, dstKey, 'bank', amount);

      // Sauvegarder destination
      setUser(guildId, target.id, (u) => {
        u.frozen  = youData.frozen;
        u.current = youData.current;
        u.business= youData.business;
      });
      // Sauvegarder source (déjà muté) :
      setUser(guildId, meId, (u) => {
        u.frozen  = meData.frozen;
        u.current = meData.current;
        u.business= meData.business;
      });

      await logEconomy(client, `💸 **PAYEMENT** ${interaction.user.tag} → ${target.tag} : ${fmt(amount)} (${sourceChoice} → ${destChoice})`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('💸 Paiement effectué')
        .setDescription(`Vous avez payé **${fmt(amount)}** à **${target.tag}**.\nCrédité sur: **${destChoice}.banque**`)
        .addFields(
          { name: 'Débité depuis', value: `${sourceChoice} (banque→liquide)`, inline: true },
          { name: 'Pris en banque', value: `🏦 ${fmt(resDeb.takenBank)}`, inline: true },
          { name: 'Pris en liquide', value: `💵 ${fmt(resDeb.takenLiquid)}`, inline: true },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'retirer-argent') {
      const comp   = interaction.options.getString('compte'); // courant | entreprise
      const amount = interaction.options.getInteger('montant');
      if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });

      let meData = getUser(guildId, meId);
      if (meData.frozen) {
        // gelé → pas de retrait banque
        return interaction.reply({ content: '🧊 Compte gelé : vous ne pouvez **pas** retirer depuis la banque.', ephemeral: true });
      }

      const key = accountKeyFromChoice(comp);
      const res = setUser(guildId, meId, (u) => { meData = u; });

      const deb = debit(meData, key, amount, { bankFirst: true, liquidOnly: false });
      if (!deb.ok) {
        return interaction.reply({ content: '❌ Fonds insuffisants en banque.', ephemeral: true });
      }
      // tout ce qui a été pris (banque puis liquide) est censé venir de banque ; mais on veut "banque → liquide",
      // donc on re-crédite tout en liquide :
      meData[key].liquid += (deb.takenBank + deb.takenLiquid);

      // save
      setUser(guildId, meId, (u) => {
        u.frozen  = meData.frozen;
        u.current = meData.current;
        u.business= meData.business;
      });

      await logEconomy(client, `🏧 **RETRAIT** ${interaction.user.tag} : ${fmt(amount)} depuis ${comp}.banque`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🏧 Retrait effectué')
        .setDescription(`Transféré **${fmt(amount)}** de 🏦 banque → 💵 liquide (${comp}).`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'deposer-argent') {
      const comp   = interaction.options.getString('compte');
      const amount = interaction.options.getInteger('montant');
      if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });

      let meData = getUser(guildId, meId);
      if (meData.frozen) {
        // gelé → pas de dépôt banque
        return interaction.reply({ content: '🧊 Compte gelé : vous ne pouvez **pas** déposer en banque.', ephemeral: true });
      }

      const key = accountKeyFromChoice(comp);

      // débiter depuis liquide UNIQUEMENT
      const res = setUser(guildId, meId, (u) => { meData = u; });
      const deb = debit(meData, key, amount, { bankFirst: false, liquidOnly: true });
      if (!deb.ok) return interaction.reply({ content: '❌ Pas assez de liquide.', ephemeral: true });

      meData[key].bank += amount;

      // save
      setUser(guildId, meId, (u) => {
        u.frozen  = meData.frozen;
        u.current = meData.current;
        u.business= meData.business;
      });

      await logEconomy(client, `🏦 **DEPOT** ${interaction.user.tag} : ${fmt(amount)} vers ${comp}.banque`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🏦 Dépôt effectué')
        .setDescription(`Transféré **${fmt(amount)}** de 💵 liquide → 🏦 banque (${comp}).`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'voler-argent') {
      const target = interaction.options.getUser('target');
      if (target.id === meId) return interaction.reply({ content: '❌ Tu ne peux pas te voler toi-même.', ephemeral: true });

      const victim = getUser(guildId, target.id);
      const loot = Math.floor(victim.current.liquid / 2);
      if (loot <= 0) return interaction.reply({ content: '😶 La cible n’a rien à voler en liquide…', ephemeral: true });

      // transfert liquide courant → courant
      setUser(guildId, target.id, (u) => { u.current.liquid -= loot; });
      setUser(guildId, meId,     (u) => { u.current.liquid += loot;  });

      await logEconomy(client, `🕵️ **VOL** ${interaction.user.tag} a volé ${fmt(loot)} à ${target.tag} (liquide courant).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🕵️ Vol réussi')
        .setDescription(`Tu as volé **${fmt(loot)}** à **${target.tag}** (💵 courant).`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'calculer-taxe') {
      const amount = interaction.options.getInteger('montant');
      const taux   = interaction.options.getNumber('taux');
      const taxe   = Math.floor(amount * (taux / 100));
      const net    = amount - taxe;

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🧾 Calcul de taxe')
        .addFields(
          { name: 'Montant brut', value: `**${fmt(amount)}**`, inline: true },
          { name: 'Taux',         value: `**${taux}%**`, inline: true },
          { name: 'Taxe',         value: `**${fmt(taxe)}**`, inline: true },
          { name: 'Net',          value: `**${fmt(net)}**`, inline: true },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // STAFF
    if (sub === 'supprimer-argent') {
      if (!requireStaff()) return;
      const target = interaction.options.getUser('target');
      const comp   = interaction.options.getString('compte');
      const key    = accountKeyFromChoice(comp);

      setUser(guildId, target.id, (u) => {
        u[key].bank = 0;
        u[key].liquid = 0;
      });

      await logEconomy(client, `🧹 **RESET** ${target.tag} → ${comp} remis à 0 par ${interaction.user.tag}.`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🧹 Compte remis à zéro')
        .setDescription(`Le compte **${comp}** de **${target.tag}** a été vidé (banque & liquide).`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'giveargent') {
      if (!requireStaff()) return;
      const target = interaction.options.getUser('target');
      const champ  = interaction.options.getString('champ'); // "courant.banque" | "entreprise.banque"
      const amount = interaction.options.getInteger('montant');

      const [accChoice, fieldChoice] = champ.split('.');
      const key   = accountKeyFromChoice(accChoice);
      const field = fieldFromChoice(fieldChoice);

      if (field !== 'bank') {
        // sécurité : on limite au champ banque comme demandé
        return interaction.reply({ content: '❌ Cette commande crédite uniquement la **banque**.', ephemeral: true });
      }

      setUser(guildId, target.id, (u) => {
        u[key][field] += amount;
      });

      await logEconomy(client, `➕ **GIVE** ${fmt(amount)} sur ${champ} de ${target.tag} (par ${interaction.user.tag}).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('➕ Crédit effectué')
        .setDescription(`Ajouté **${fmt(amount)}** sur **${champ}** de **${target.tag}**.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // BANQUIER / STAFF
    if (sub === 'geler-compte') {
      if (!requireBankerOrStaff()) return;
      const target = interaction.options.getUser('target');

      setUser(guildId, target.id, (u) => { u.frozen = true; });

      await logEconomy(client, `🧊 **GELE** comptes de ${target.tag} (par ${interaction.user.tag}).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🧊 Comptes gelés')
        .setDescription(`Les comptes de **${target.tag}** sont gelés.\nSeul le **liquide du compte courant** reste utilisable.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'degeler-compte') {
      if (!requireBankerOrStaff()) return;
      const target = interaction.options.getUser('target');

      setUser(guildId, target.id, (u) => { u.frozen = false; });

      await logEconomy(client, `🔥 **DEGELE** comptes de ${target.tag} (par ${interaction.user.tag}).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🔥 Comptes dégélés')
        .setDescription(`Les comptes de **${target.tag}** sont de nouveau actifs.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'recuperer-argent') {
      if (!requireBankerOrStaff()) return;
      const target = interaction.options.getUser('target');
      const comp   = interaction.options.getString('compte');
      const amount = interaction.options.getInteger('montant');

      const key = accountKeyFromChoice(comp);
      let tData = getUser(guildId, target.id);

      // on saisit via banque puis liquide (puise sur les deux)
      const resDeb = debit(tData, key, amount, { bankFirst: true, liquidOnly: false });
      if (!resDeb.ok) {
        // on prend tout ce qu'il a (saisie totale) si inférieur ?
        // Spécification: "ça saisit le montant tant que le total a la somme saisie" → si insuffisant, on refuse.
        return interaction.reply({ content: '❌ Fonds insuffisants sur ce compte pour saisir ce montant.', ephemeral: true });
      }

      // save
      setUser(guildId, target.id, (u) => {
        u.frozen  = tData.frozen;
        u.current = tData.current;
        u.business= tData.business;
      });

      await logEconomy(client, `⚖️ **SAISIE** ${fmt(amount)} sur ${comp} de ${target.tag} (par ${interaction.user.tag}).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('⚖️ Saisie effectuée')
        .setDescription(`Prélevé **${fmt(amount)}** sur **${comp}** de **${target.tag}** (🏦 ${fmt(resDeb.takenBank)} + 💵 ${fmt(resDeb.takenLiquid)}).`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
