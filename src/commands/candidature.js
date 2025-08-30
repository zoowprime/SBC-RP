
// src/commands/candidature.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('candidature')
    .setDescription('Annonce le résultat d’une candidature')
    .addStringOption(opt =>
      opt
        .setName('resultat')
        .setDescription('Choisissez Validé ou Refusé')
        .setRequired(true)
        .addChoices(
          { name: 'Validé', value: 'validé' },
          { name: 'Refusé', value: 'refusé' }
        )
    )
    .addUserOption(opt =>
      opt
        .setName('candidat')
        .setDescription('La personne dont on annonce le résultat')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('raison')
        .setDescription('Raison de la décision')
        .setRequired(true)
    ),

  async execute(interaction) {
    const STAFF_ROLE_ID    = process.env.STAFF_ROLE_ID;
    const ORAL_A_FAIRE     = process.env.QCM_A_FAIRE_ROLE_ID;
    const WELCOME_ROLE_ID  = process.env.WELCOME_ROLE_ID;

    // Vérification permission staff
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Vous n'avez pas la permission d'utiliser cette commande.",
        ephemeral: true
      });
    }

    const resultat = interaction.options.getString('resultat');
    const user     = interaction.options.getUser('candidat');
    const reason   = interaction.options.getString('raison');

    // Construction de l'embed
    const embed = new EmbedBuilder()
      .setTitle('Résultat de la candidature')
      .setColor(0x7C4DFF)
      .setDescription(`La candidature de ${user} a été **${resultat}**.`)
      .addFields({ name: 'Raison', value: reason });

    // Si Validé, ajouter le rôle ORAL_A_FAIRE et retirer le rôle de bienvenue
    if (resultat === 'validé' && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(user.id);
        if (QCM_A_FAIRE_ROLE_ID) {
          await member.roles.add(QCM_A_FAIRE_ROLE_ID);
        }
        if (WELCOME_ROLE_ID) {
          await member.roles.remove(WELCOME_ROLE_ID);
        }
      } catch (err) {
        console.error('Erreur lors de la modification des rôles :', err);
        // On continue malgré l’erreur
      }
    }

    // Envoi de l’embed visible par tous
    await interaction.reply({ embeds: [embed] });
  }
};
