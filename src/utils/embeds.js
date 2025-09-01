
const { EmbedBuilder } = require('discord.js');

function vehicleToEmbed(v) {
  const e = new EmbedBuilder()
    .setTitle(`[${v.id}] ${v.marque} ${v.modele} — ${v.prix.toLocaleString()} $`)
    .setDescription(`catégorie: **${v.categorie}** | état: **${v.etat}** | stock: **${v.stock}**`)
    .addFields(
      v.perfs ? [
        { name: '0–100', value: v.perfs['0_100'] ? `${v.perfs['0_100']} s` : 'n/a', inline: true },
        { name: 'Vmax', value: v.perfs.vmax ? `${v.perfs.vmax} km/h` : 'n/a', inline: true },
        { name: 'Transmission', value: v.perfs.transmission || 'n/a', inline: true },
      ] : []
    )
    .setFooter({ text: v.tags && v.tags.length ? `tags: ${v.tags.join(', ')}` : 'SBC Concess' })
    .setTimestamp(new Date(v.date_publication || Date.now()));
  if (v.images && v.images.length) e.setImage(v.images[0]);
  return e;
}

module.exports = { vehicleToEmbed };
