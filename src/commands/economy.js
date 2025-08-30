// src/commands/economy.js
const {
  SlashCommandBuilder,
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
        .addStringOption(o => o.setName('source').setDescription('Compte source').addChoices(
          { name: 'courant', value: 'courant' },
          { name: 'entreprise', value: 'entreprise' },
        ).setRequired(true))
        .addStringOption(o => o.setName('vers').setDescription('Compte destinataire').addChoices(
          { name: 'courant', value: 'courant' },
          { name: 'entreprise', value: 'entreprise' },
        ).setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Destinataire').setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à payer').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('retirer-argent')
        .setDescription('Retirer de la banque vers le liquide.')
        .addStringOption(o => o.setName('compte').setDescription('Compte à débiter').addChoices(
          { name: 'courant', value: 'courant' },
          { name: 'entreprise', value: 'entreprise' },
        ).setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à retirer').setMinValue(1).setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('deposer-argent')
        .setDescription('Déposer du liquide vers la banque.')
        .addStringOption(o => o.setName('compte').setDescription('Compte à créditer').addChoices(
          { name: 'courant', value: 'courant' },
          { name: 'entreprise', value: 'entreprise' },
        ).setRequired(true))
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
        .addStringOption(o => o.setName('compte').setDescription('Compte à reset').addChoices(
          { name: 'courant', value: 'courant' },
          { name: 'entreprise', value: 'entreprise' },
        ).setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('giveargent')
        .setDescription('STAFF: donne de l’argent sur courant.banque ou entreprise.banque.')
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
        .addStringOption(o => o.setName('compte').setDescription('Compte cible').addChoices(
          { name: 'courant', value: 'courant' },
          { name: 'entreprise', value: 'entreprise' },
        ).setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Montant à saisir').setMinValue(1).setRequired(true))
    )
    .setDMPermission(false),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const meId    = interaction.user.id;

    const requireStaff = () => {
      if (interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) return true;
      interaction.reply({ content: '❌ Réservé au staff.' }).catch(() => {});
      return false;
    };
    const requireBankerOrStaff = () => {
      if (isBankerOrStaff(interaction)) return true;
      interaction.reply({ content: '❌ Réservé aux banquiers/staff.' }).catch(() => {});
      return false;
    };

    // ───────────────────────────────────────────────────────────────────────────
    if (sub === 'afficher-compte') {
      const target = interaction.options.getUser('target') || interaction.user;
      const data   = getUser(guildId, target.id);

      const embedData = buildAccountEmbed({ user: target.id, tag: target.tag, data });
      const embed = new EmbedBuilder(embedData);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'payer') {
      const sourceChoice = interaction.options.getString('source');
      const destChoice   = interaction.options.getString('vers');
      const target       = interaction.options.getUser('target');
      const amount       = interaction.options.getInteger('montant');

      if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.' });

      if (target.id === meId) return interaction.reply({ content: '❌ Impossible de vous payer vous-même.' });

      const srcKey  = accountKeyFromChoice(sourceChoice);
      const dstKey  = accountKeyFromChoice(destChoice);

      let meData    = getUser(guildId, meId);
      const youData = getUser(guildId, target.id);

      if (meData.frozen && srcKey !== 'current') {
        return interaction.reply({ content: '🧊 Compte gelé : vous ne pouvez payer que depuis le **liquide du compte courant**.' });
      }

      const debitOpts = meData.frozen
        ? { bankFirst: true, liquidOnly: true }
        : { bankFirst: true, liquidOnly: false };

      const resDeb = debit(meData, srcKey, amount, debitOpts);
      if (!resDeb.ok) return interaction.reply({ content: `❌ Fonds insuffisants pour payer **${fmt(amount)}**.` });

      credit(youData, dstKey, 'bank', amount);

      setUser(guildId, target.id, (u) => {
        u.frozen  = youData.frozen;
        u.current = youData.current;
        u.business= youData.business;
      });
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
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'retirer-argent') {
      const comp   = interaction.options.getString('compte');
      const amount = interaction.options.getInteger('montant');
      if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.' });

      let meData = getUser(guildId, meId);
      if (meData.frozen) {
        return interaction.reply({ content: '🧊 Compte gelé : vous ne pouvez **pas** retirer depuis la banque.' });
      }

      const key = accountKeyFromChoice(comp);
      const deb = debit(meData, key, amount, { bankFirst: true, liquidOnly: false });
      if (!deb.ok) return interaction.reply({ content: '❌ Fonds insuffisants en banque.' });

      meData[key].liquid += (deb.takenBank + deb.takenLiquid);

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
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'deposer-argent') {
      const comp   = interaction.options.getString('compte');
      const amount = interaction.options.getInteger('montant');
      if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.' });

      let meData = getUser(guildId, meId);
      if (meData.frozen) {
        return interaction.reply({ content: '🧊 Compte gelé : vous ne pouvez **pas** déposer en banque.' });
      }

      const key = accountKeyFromChoice(comp);
      const deb = debit(meData, key, amount, { bankFirst: false, liquidOnly: true });
      if (!deb.ok) return interaction.reply({ content: '❌ Pas assez de liquide.' });

      meData[key].bank += amount;

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
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'voler-argent') {
      const target = interaction.options.getUser('target');
      if (target.id === meId) return interaction.reply({ content: '❌ Tu ne peux pas te voler toi-même.' });

      const victim = getUser(guildId, target.id);
      const loot = Math.floor(victim.current.liquid / 2);
      if (loot <= 0) return interaction.reply({ content: '😶 La cible n’a rien à voler en liquide…' });

      setUser(guildId, target.id, (u) => { u.current.liquid -= loot; });
      setUser(guildId, meId,     (u) => { u.current.liquid += loot;  });

      await logEconomy(client, `🕵️ **VOL** ${interaction.user.tag} a volé ${fmt(loot)} à ${target.tag} (liquide courant).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('🕵️ Vol réussi')
        .setDescription(`Tu as volé **${fmt(loot)}** à **${target.tag}** (💵 courant).`);
      return interaction.reply({ embeds: [embed] });
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
      return interaction.reply({ embeds: [embed] });
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
      return interaction.reply({ embeds: [embed] });
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
        return interaction.reply({ content: '❌ Cette commande crédite uniquement la **banque**.' });
      }

      setUser(guildId, target.id, (u) => { u[key][field] += amount; });

      await logEconomy(client, `➕ **GIVE** ${fmt(amount)} sur ${champ} de ${target.tag} (par ${interaction.user.tag}).`);

      const embed = new EmbedBuilder()
        .setColor(VIOLET)
        .setTitle('➕ Crédit effectué')
        .setDescription(`Ajouté **${fmt(amount)}** sur **${champ}** de **${target.tag}**.`);
      return interaction.reply({ embeds: [embed] });
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
      return interaction.reply({ embeds: [embed] });
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
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'recuperer-argent') {
      if (!requireBankerOrStaff()) return;
      const target = interaction.options.getUser('target');
      const comp   = interaction.options.getString('compte');
      const amount = interaction.options.getInteger('montant');

      const key = accountKeyFromChoice(comp);
      let tData = getUser(guildId, target.id);

      const resDeb = debit(tData, key, amount, { bankFirst: true, liquidOnly: false });
      if (!resDeb.ok) {
        return interaction.reply({ content: '❌ Fonds insuffisants sur ce compte pour saisir ce montant.' });
      }

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
      return interaction.reply({ embeds: [embed] });
    }
  },
};
