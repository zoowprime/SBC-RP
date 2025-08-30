
// src/events/candidature.js
require('dotenv').config({ path: './id.env' });
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags
} = require('discord.js');

module.exports = (client) => {
  const CANDIDATURE_CHANNEL     = process.env.CANDIDATURE_CHANNEL;
  const CANDIDATURE_CATEGORY    = process.env.CANDIDATURE_OPEN_CATEGORY_ID;
  const STAFF_ROLE_ID           = process.env.STAFF_ROLE_ID;

  // 1️⃣ Au démarrage, poste le menu “Faire ma candidature” si pas déjà là
  client.once('ready', async () => {
    const launchCh = await client.channels.fetch(CANDIDATURE_CHANNEL).catch(() => null);
    if (!launchCh || launchCh.type !== ChannelType.GuildText) {
      return console.error('Salon candidature introuvable ou non textuel');
    }

    // Ne renvoie pas si on trouve déjà un embed de lancement
    const fetched = await launchCh.messages.fetch({ limit: 50 });
    if (fetched.some(m => m.embeds[0]?.title === '📢 Déposer une candidature')) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 Déposer une candidature')
      .setDescription(
        'Si vous souhaitez déposer votre candidature, ouvrez le menu déroulant et sélectionnez **Faire ma candidature**.\n' +
        'Le modèle de candidature vous sera directement fourni !'
      )
      .setColor(0x9B59B6);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('candidature_open')
      .setPlaceholder('Faire ma candidature')
      .addOptions([
        { label: 'Faire ma candidature', value: 'open' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await launchCh.send({ embeds: [embed], components: [row] });
  });

  // 2️⃣ Quand quelqu’un sélectionne “Faire ma candidature”
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'candidature_open') return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const user  = interaction.user;

      // Création du salon perso
      const candidateCh = await guild.channels.create({
        name: `candidature-${user.username}`,
        type: ChannelType.GuildText,
        parent: CANDIDATURE_CATEGORY,
        permissionOverwrites: [
          // bloque @everyone
          { id: guild.id,                   deny: ['ViewChannel'] },
          // autorise le candidat
          { id: user.id,                    allow: ['ViewChannel','SendMessages','ReadMessageHistory'] },
          // autorise le staff
          { id: STAFF_ROLE_ID,              allow: ['ViewChannel','ReadMessageHistory'] },
          // autorise le bot
          { id: client.user.id,             allow: ['ViewChannel','SendMessages','ReadMessageHistory'] }
        ]
      });

      // Embed + bouton “Supprimer” dans le nouveau salon
      const delBtn = new ButtonBuilder()
        .setCustomId('candidature_delete')
        .setLabel('Supprimer la candidature')
        .setStyle(ButtonStyle.Danger);
      const delRow = new ActionRowBuilder().addComponents(delBtn);

      const introEmbed = new EmbedBuilder()
        .setTitle('✏️ Modèle de candidature')
        .setDescription('Copiez ce formulaire, remplissez-le, puis un staff pourra supprimer ce salon une fois votre candidature traitée.')
        .setColor(0x9B59B6);

      await candidateCh.send({ embeds: [introEmbed], components: [delRow] });

      // Le formulaire à copier
      const model = [
        '**Prénom :**',
        '**Âge (15 ans min) :**',
        '**Experience RP (serveur, type de projet) :**',
        '**PSN :**',
        '**Disponibilité :**',
        '**Lundi =**',
        '**Mardi =**',
        '**Mercredi =**',
        '**Jeudi =**',
        '**Vendredi =**',
        '**Samedi =**',
        '**Dimanche =**',
        '',
        '**Nom :**',
        '**Prénom :**',
        '**Âge et date de naissance :**',
        '**Sexe :**',
        '**Taille (1m50‑2m) :**',
        '**Origine :**',
        '**Accent (oui/non) :**',
        '**Trait de caractère (3 minimum) :**',
        '**Projet (court, moyen, long – développer) :**',
        '',
        '`Nous vous demandons un Background réfléchi et cohérent avec le lore, pas de RP Rambo !`',
        '',
        '**Background (10 lignes minimum) :**'
      ].join('\n');

      await candidateCh.send({ content: model });
      await interaction.editReply({ content: `✅ Salon créé : ${candidateCh}` });
    } catch (err) {
      console.error('Erreur ouverture candidature :', err);
      await interaction.editReply({ content: '❌ Impossible de créer votre salon de candidature.' });
    }
  });

  // 3️⃣ Supprimer le salon candidature (seul le staff)
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'candidature_delete') return;
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission.', flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '🗑️ Le salon sera supprimé dans 5 secondes…', flags: MessageFlags.Ephemeral });
    setTimeout(() => interaction.channel.delete().catch(console.error), 5_000);
  });
};
