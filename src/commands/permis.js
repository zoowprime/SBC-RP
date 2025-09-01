// src/commands/permis.js
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });
const fs = require('fs');
const path = require('path');

const { renderIdCard } = require('../idcard/renderer');
const { DIR, sanitize, getLicense, setLicense, deleteLicense, nextNumber } = require('../licenses/service');

const {
  STAFF_ROLE_ID,
  POLICE_ROLE_ID,
  AUTO_ECOLE_ROLE_ID,
} = process.env;

const TPL = {
  auto: path.resolve('src/licenses/template_auto.json'),
  moto: path.resolve('src/licenses/template_moto.json'),
  arme: path.resolve('src/licenses/template_arme.json'),
};

function isStaff(m)  { return !!m?.roles?.cache?.has(STAFF_ROLE_ID); }
function isPolice(m) { return !!m?.roles?.cache?.has(POLICE_ROLE_ID); }
function isAE(m)     { return !!m?.roles?.cache?.has(AUTO_ECOLE_ROLE_ID); }

function canDeliver(type, m) {
  if (isStaff(m)) return true;
  if (type === 'arme') return isPolice(m);
  return isAE(m); // auto/moto
}
function canSuspend(type, m) {
  // Police (et Staff) peut suspendre tous les permis
  return isStaff(m) || isPolice(m);
}
function canDelete(type, m) {
  // on restreint la suppression : Staff pour tout ; Police uniquement pour "arme"
  if (isStaff(m)) return true;
  if (type === 'arme' && isPolice(m)) return true;
  return false;
}
function canEditAny(type, m) {
  // pour maj/set-photo sur n'importe qui
  if (isStaff(m)) return true;
  if (type === 'arme') return isPolice(m);
  return isAE(m);
}

function outPath(gid, uid, type) {
  return path.join(DIR, 'cards', `${gid}_${uid}_${type}.png`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permis')
    .setDescription('Gestion des permis (voiture, moto, armes) — rendus image.')

    // /permis delivrer
    .addSubcommand(sc =>
      sc.setName('delivrer')
        .setDescription('Délivrer ou mettre à jour un permis.')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
        .addStringOption(o => o.setName('nom').setDescription('NOM').setRequired(true))
        .addStringOption(o => o.setName('prenom').setDescription('Prénom').setRequired(true))
        .addStringOption(o => o.setName('naissance').setDescription('Date de naissance (JJ/MM/AAAA)').setRequired(true))
        .addStringOption(o => o.setName('lieu').setDescription('Lieu de naissance').setRequired(true))
        .addStringOption(o => o.setName('adresse').setDescription('Adresse RP'))
        .addStringOption(o => o.setName('signature').setDescription('Signature'))
        .addAttachmentOption(o => o.setName('photo').setDescription('Photo visage (image)'))
    )

    // /permis afficher
    .addSubcommand(sc =>
      sc.setName('afficher')
        .setDescription('Afficher un permis.')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addUserOption(o => o.setName('target').setDescription('Joueur'))
    )

    // /permis set-photo (⚠ required avant optional)
    .addSubcommand(sc =>
      sc.setName('set-photo')
        .setDescription('Changer la photo du permis.')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addAttachmentOption(o => o.setName('photo').setDescription('Image').setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Joueur (si staff/autorité)'))
    )

    // /permis maj
    .addSubcommand(sc =>
      sc.setName('maj')
        .setDescription('Mettre à jour adresse/signature du permis (proprio ou autorité).')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addStringOption(o => o.setName('adresse').setDescription('Adresse RP'))
        .addStringOption(o => o.setName('signature').setDescription('Signature'))
    )

    // /permis retirer
    .addSubcommand(sc =>
      sc.setName('retirer')
        .setDescription('Suspendre un permis.')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )

    // /permis restaurer
    .addSubcommand(sc =>
      sc.setName('restaurer')
        .setDescription('Restaurer un permis suspendu.')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )

    // /permis supprimer
    .addSubcommand(sc =>
      sc.setName('supprimer')
        .setDescription('Supprimer définitivement un permis.')
        .addStringOption(o => o.setName('type').setDescription('Type de permis').setRequired(true)
          .addChoices({ name: 'Voiture', value: 'auto' }, { name: 'Moto', value: 'moto' }, { name: 'Armes', value: 'arme' }))
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )

    .setDMPermission(false),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const type  = interaction.options.getString('type', true); // auto|moto|arme
    const gid   = interaction.guildId;

    // sécu output dir
    const outDir = path.join(DIR, 'cards'); try { fs.mkdirSync(outDir, { recursive: true }); } catch {}

    // helpers de rendu
    async function renderAndReply(targetUser, data, verbText) {
      const buf = await renderIdCard({
        templatePath: TPL[type],
        data,
        outputPath: outPath(gid, targetUser.id, type)
      }).catch(() => null);

      if (!buf) return interaction.reply({ content: '❗ Génération impossible (fond manquant ?).' });
      const file = new AttachmentBuilder(buf, { name: `PERMIS_${type}_${targetUser.username}.png` });
      return interaction.reply({ content: `${verbText} ${targetUser}`, files: [file], allowedMentions: { parse: [] } });
    }

    // ───────────────────────────── delivrer
    if (sub === 'delivrer') {
      if (!canDeliver(type, interaction.member)) {
        return interaction.reply({ content: '❌ Vous n’avez pas l’autorisation de délivrer ce permis.' });
      }
      const target = interaction.options.getUser('target', true);
      const nom    = sanitize(interaction.options.getString('nom', true)).toUpperCase();
      const prenom = sanitize(interaction.options.getString('prenom', true));
      const dob    = sanitize(interaction.options.getString('naissance', true));
      const pob    = sanitize(interaction.options.getString('lieu', true));
      const addr   = sanitize(interaction.options.getString('adresse') || '');
      const sign   = sanitize(interaction.options.getString('signature') || '');
      const att    = interaction.options.getAttachment('photo');

      const lic = setLicense(gid, target.id, type, (L) => {
        L.rpName    = `${nom} ${prenom}`;
        L.dob       = dob;
        L.pob       = pob;
        L.address   = addr;
        L.signature = sign;
        L.idNumber  = L.idNumber || nextNumber(type);
        L.status    = 'valid';
        if (att?.url) L.photoUrl = att.url;
        if (!L.photoUrl) L.photoUrl = target.displayAvatarURL({ extension: 'png', size: 512 });
      });

      return renderAndReply(target, lic, '🪪 Permis délivré pour');
    }

    // ───────────────────────────── afficher
    if (sub === 'afficher') {
      const target = interaction.options.getUser('target') || interaction.user;
      const lic = getLicense(gid, target.id, type);
      if (!lic) return interaction.reply({ content: `❌ Aucun permis **${type}** pour ${target}.` });
      return renderAndReply(target, lic, '🪪 Permis');
    }

    // ───────────────────────────── set-photo
    if (sub === 'set-photo') {
      const att    = interaction.options.getAttachment('photo', true);
      const target = interaction.options.getUser('target') || interaction.user;

      const isOwner = target.id === interaction.user.id;
      if (!isOwner && !canEditAny(type, interaction.member)) {
        return interaction.reply({ content: '❌ Vous ne pouvez changer que votre propre photo (ou être Staff/autorité).' });
      }
      const exists = getLicense(gid, target.id, type);
      if (!exists) return interaction.reply({ content: `❌ Aucun permis **${type}** pour ${target}.` });

      const lic = setLicense(gid, target.id, type, (L) => { L.photoUrl = att.url; });
      return renderAndReply(target, lic, '🖼️ Photo mise à jour pour');
    }

    // ───────────────────────────── maj
    if (sub === 'maj') {
      const target = interaction.user; // proprio
      const exists = getLicense(gid, target.id, type);
      if (!exists) return interaction.reply({ content: `❌ Aucun permis **${type}** trouvé.` });

      const addr = interaction.options.getString('adresse');
      const sign = interaction.options.getString('signature');

      const canAny = canEditAny(type, interaction.member);
      // si ce n’est pas Staff/autorité, MAJ seulement sa propre carte (c’est déjà le cas)
      const lic = setLicense(gid, target.id, type, (L) => {
        if (addr !== null) L.address   = sanitize(addr);
        if (sign !== null) L.signature = sanitize(sign);
      });

      return renderAndReply(target, lic, canAny ? '✅ Mis à jour (autorité)' : '✅ Mis à jour');
    }

    // ───────────────────────────── retirer (suspendre)
    if (sub === 'retirer') {
      if (!canSuspend(type, interaction.member)) {
        return interaction.reply({ content: '❌ Seule la Police (ou Staff) peut suspendre un permis.' });
      }
      const target = interaction.options.getUser('target', true);
      const exists = getLicense(gid, target.id, type);
      if (!exists) return interaction.reply({ content: `❌ Aucun permis **${type}** pour ${target}.` });

      const lic = setLicense(gid, target.id, type, (L) => { L.status = 'suspended'; });
      return renderAndReply(target, lic, '⚖️ Permis suspendu pour');
    }

    // ───────────────────────────── restaurer
    if (sub === 'restaurer') {
      if (!canSuspend(type, interaction.member)) {
        return interaction.reply({ content: '❌ Seule la Police (ou Staff) peut restaurer un permis.' });
      }
      const target = interaction.options.getUser('target', true);
      const exists = getLicense(gid, target.id, type);
      if (!exists) return interaction.reply({ content: `❌ Aucun permis **${type}** pour ${target}.` });

      const lic = setLicense(gid, target.id, type, (L) => { L.status = 'valid'; });
      return renderAndReply(target, lic, '✅ Permis restauré pour');
    }

    // ───────────────────────────── supprimer
    if (sub === 'supprimer') {
      if (!canDelete(type, interaction.member)) {
        return interaction.reply({ content: '❌ Suppression réservée au Staff (Police autorisée pour ARME).' });
      }
      const target = interaction.options.getUser('target', true);
      const exists = getLicense(gid, target.id, type);
      if (!exists) return interaction.reply({ content: `❌ Aucun permis **${type}** pour ${target}.` });

      const ok = deleteLicense(gid, target.id, type);
      try {
        const f = outPath(gid, target.id, type);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
      return interaction.reply({ content: ok ? `🗑️ Permis **${type}** supprimé pour ${target}.` : `❗ Échec de la suppression.` });
    }
  }
};
