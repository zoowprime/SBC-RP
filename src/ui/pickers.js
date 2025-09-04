// src/ui/pickers.js
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const COLOR = 0x5865F2;

function sendPropertyPicker(interaction, props, customId, placeholder = 'Choisis une propriété', ephemeral = false) {
  if (!props.length) {
    const e = new EmbedBuilder().setColor(COLOR).setDescription('Tu n’as accès à **aucune propriété** pour cette action.');
    return interaction.reply({ embeds:[e], ephemeral:true });
  }
  const options = props.slice(0,25).map(p => ({
    label: p.name || p.id,
    value: p.id,
    description: p.ptype ? `Type: ${p.ptype}` : 'Propriété',
  }));
  const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options);
  const row = new ActionRowBuilder().addComponents(menu);
  const e = new EmbedBuilder().setColor(COLOR).setTitle('🏠 Sélection de propriété').setDescription('Sélectionne ci-dessous la propriété sur laquelle agir.');
  return interaction.reply({ embeds:[e], components:[row], ephemeral });
}

module.exports = { sendPropertyPicker };
