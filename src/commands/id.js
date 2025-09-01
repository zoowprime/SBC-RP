const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
require('dotenv').config({ path: './id.env' });
const path = require('path');

const { renderIdCard } = require('../idcard/renderer');
const { getCard, setCard, nextIdNumber, sanitize, DIR } = require('../idcard/service');

const { STAFF_ROLE_ID, POLICE_ROLE_ID } = process.env;
const TEMPLATE_PATH = path.resolve('src/idcard/template.json');

function isPoliceOrStaff(member) {
  return member?.roles?.cache?.has(POLICE_ROLE_ID) || member?.roles?.cache?.has(STAFF_ROLE_ID);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('id')
    .setDescription('Gestion des cartes d’identité RP (image).')

    .addSubcommand(sc =>
      sc.setName('delivrer')
        .setDescription('SAPD/Staff : créer ou mettre à jour la carte d’un joueur.')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
        .addStringOption(o => o.setName('nom').setDescription('NOM').setRequired(true))
        .addStringOption(o => o.setName('prenom').setDescription('Prénom').setRequired(true))
        .addStringOption(o => o.setName('naissance').setDescription('Date de naissance (JJ/MM/AAAA)').setRequired(true))
        .addStringOption(o => o.setName('lieu').setDescription('Lieu de naissance').setRequired(true))
        .addStringOption(o => o.setName('taille').setDescription('Taille, ex: 182 cm').setRequired(true))
        .addStringOption(o => o.setName('adresse').setDescription('Adresse RP').setRequired(false))
        .addStringOption(o => o.setName('signature').setDescription('Signature').setRequired(false))
        .addAttachmentOption(o => o.setName('photo').setDescription('Photo visage (image)').setRequired(false))
    )

    .addSubcommand(sc =>
      sc.setName('afficher')
        .setDescription('Afficher la carte (image).')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(false))
    )

    .addSubcommand(sc =>
      sc.setName('set-photo')
        .setDescription('Changer la photo (proprio ou Staff/SAPD).')
        .addUserOption(o => o.setName('target').setDescription('Joueur (si staff)').setRequired(false))
        .addAttachmentOption(o => o.setName('photo').setDescription('Image').setRequired(true))
    )

    .addSubcommand(sc =>
      sc.setName('maj')
        .setDescription('Mettre à jour adresse/signature.')
        .addStringOption(o => o.setName('adresse').setDescription('Adresse RP').setRequired(false))
        .addStringOption(o => o.setName('signature').setDescription('Signature').setRequired(false))
    )

    .addSubcommand(sc =>
      sc.setName('retirer')
        .setDescription('SAPD/Staff : suspendre la carte.')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )

    .addSubcommand(sc =>
      sc.setName('restaurer')
        .setDescription('SAPD/Staff : restaurer la carte.')
        .addUserOption(o => o.setName('target').setDescription('Joueur').setRequired(true))
    )
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ─────────────────────────────── /id delivrer
    if (sub === 'delivrer') {
      if (!isPoliceOrStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Réservé SAPD/Staff.' });
      }
      const target = interaction.options.getUser('target', true);
      const nom    = sanitize(interaction.options.getString('nom', true)).toUpperCase();
      const prenom = sanitize(interaction.options.getString('prenom', true));
      const dob    = sanitize(interaction.options.getString('naissance', true));
      const pob    = sanitize(interaction.options.getString('lieu', true));
      const height = sanitize(interaction.options.getString('taille', true));
      const addr   = sanitize(interaction.options.getString('adresse') || '');
      const sign   = sanitize(interaction.options.getString('signature') || '');
      const att    = interaction.options.getAttachment('photo');

      const card = setCard(guildId, target.id, (c) => {
        c.rpName   = `${nom} ${prenom}`;
        c.dob      = dob;
        c.pob      = pob;
        c.height   = height;
        c.address  = addr;
        c.signature= sign;
        c.idNumber = c.idNumber || nextIdNumber(guildId);
        c.status   = 'valid';
        if (att?.url) c.photoUrl = att.url;
        // fallback si pas de photo fournie : avatar Discord (PNG)
        if (!c.photoUrl) c.photoUrl = target.displayAvatarURL({ extension: 'png', size: 512 });
      });

      // Rendu + envoi
      const buf = await renderIdCard({
        templatePath: TEMPLATE_PATH,
        data: card,
        outputPath: path.join(DIR, 'cards', `${guildId}_${target.id}.png`)
      }).catch(() => null);

      if (!buf) return interaction.reply({ content: '❗ Impossible de générer la carte (fond manquant ?).' });

      const file = new AttachmentBuilder(buf, { name: `ID_${target.username}.png` });
      return interaction.reply({ content: `🪪 Carte d’identité de ${target}`, files: [file], allowedMentions: { parse: [] } });
    }

    // ─────────────────────────────── /id afficher
    if (sub === 'afficher') {
      const target = interaction.options.getUser('target') || interaction.user;
      const card = getCard(guildId, target.id);
      if (!card) return interaction.reply({ content: `❌ Aucune carte pour ${target}.` });

      const buf = await renderIdCard({
        templatePath: TEMPLATE_PATH,
        data: card,
        outputPath: path.join(DIR, 'cards', `${guildId}_${target.id}.png`)
      }).catch(() => null);

      if (!buf) return interaction.reply({ content: '❗ Génération impossible (fond manquant ?).' });

      const file = new AttachmentBuilder(buf, { name: `ID_${target.username}.png` });
      return interaction.reply({ content: `🪪 Carte d’identité de ${target}`, files: [file], allowedMentions: { parse: [] } });
    }

    // ─────────────────────────────── /id set-photo
    if (sub === 'set-photo') {
      const att = interaction.options.getAttachment('photo', true);
      const chosen = interaction.options.getUser('target') || interaction.user;

      const isOwner = chosen.id === interaction.user.id;
      if (!isOwner && !isPoliceOrStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Tu ne peux changer que **ta** photo.' });
      }

      const existing = getCard(guildId, chosen.id);
      if (!existing) return interaction.reply({ content: `❌ Aucune carte pour ${chosen}.` });

      const card = setCard(guildId, chosen.id, (c) => { c.photoUrl = att.url; });

      const buf = await renderIdCard({
        templatePath: TEMPLATE_PATH,
        data: card,
        outputPath: path.join(DIR, 'cards', `${guildId}_${chosen.id}.png`)
      }).catch(() => null);

      if (!buf) return interaction.reply({ content: '❗ Génération impossible.' });
      const file = new AttachmentBuilder(buf, { name: `ID_${chosen.username}.png` });
      return interaction.reply({ content: `🖼️ Photo mise à jour pour ${chosen}`, files: [file], allowedMentions: { parse: [] } });
    }

    // ─────────────────────────────── /id maj
    if (sub === 'maj') {
      const card = getCard(guildId, interaction.user.id);
      if (!card) return interaction.reply({ content: '❌ Aucune carte à mettre à jour.' });

      const addr = interaction.options.getString('adresse');
      const sign = interaction.options.getString('signature');

      const updated = setCard(guildId, interaction.user.id, (c) => {
        if (addr !== null) c.address   = sanitize(addr);
        if (sign !== null) c.signature = sanitize(sign);
      });

      const buf = await renderIdCard({
        templatePath: TEMPLATE_PATH,
        data: updated,
        outputPath: path.join(DIR, 'cards', `${guildId}_${interaction.user.id}.png`)
      }).catch(() => null);

      if (!buf) return interaction.reply({ content: '✅ Mis à jour.' });
      const file = new AttachmentBuilder(buf, { name: `ID_${interaction.user.username}.png` });
      return interaction.reply({ content: '✅ Mis à jour.', files: [file] });
    }

    // ─────────────────────────────── /id retirer & /id restaurer
    if (sub === 'retirer' || sub === 'restaurer') {
      if (!isPoliceOrStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Réservé SAPD/Staff.' });
      }
      const target = interaction.options.getUser('target', true);
      const exists = getCard(guildId, target.id);
      if (!exists) return interaction.reply({ content: `❌ Aucune carte pour ${target}.` });

      const status = (sub === 'retirer') ? 'suspended' : 'valid';
      const updated = setCard(guildId, target.id, (c) => { c.status = status; });

      const buf = await renderIdCard({
        templatePath: TEMPLATE_PATH,
        data: updated,
        outputPath: path.join(DIR, 'cards', `${guildId}_${target.id}.png`)
      }).catch(() => null);

      const file = buf ? [new AttachmentBuilder(buf, { name: `ID_${target.username}.png` })] : [];
      const verb = (sub === 'retirer') ? 'suspendue' : 'restaurée';
      return interaction.reply({ content: `⚖️ Carte ${verb} pour ${target}.`, files: file });
    }
  }
};
