const { AttachmentBuilder } = require('discord.js');
const { generateCard }      = require('../utils/welcomeCard');
require('dotenv').config({ path: './id.env' });

module.exports = (client) => {
const WELCOME\_CHAN = process.env.WELCOME\_CHANNEL\_ID;
const FAREWELL\_CHAN = process.env.FAREWELL\_CHANNEL\_ID || WELCOME\_CHAN;
const ROLE\_ON\_JOIN  = process.env.WELCOME\_ROLE\_ID;

client.on('guildMemberAdd', async member => {
try {
// 1) Rôle d’accueil
if (ROLE\_ON\_JOIN) {
const r = member.guild.roles.cache.get(ROLE\_ON\_JOIN);
if (r) await member.roles.add(r);
}

```
  // 2) Message Discord avant l’image
  const welcomeMsg = 
    `Bienvenue sur **South Belleshore Crimes RP**, ${member} ! ` + 
    `N'hésite pas à prendre connaissance des différents salons à ta disposition !`;
  const channel = member.guild.channels.cache.get(WELCOME_CHAN);
  if (!channel?.isTextBased()) return;
  await channel.send({ content: welcomeMsg });

  // 3) Génération + envoi de la carte
  const buffer = await generateCard({
    username:    member.user.username,
    avatarURL:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
    memberCount: member.guild.memberCount,
    isWelcome:   true
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
  await channel.send({ files: [attachment] });
} catch (err) {
  console.error('Erreur guildMemberAdd:', err);
}
```

});

client.on('guildMemberRemove', async member => {
try {
// 1) Message Discord avant l’image
const byeMsg =
`**Au revoir…**\n` +
`${member.user.username} nous a quittés. ` +
`On espère te revoir bientôt !`;
const channel = member.guild.channels.cache.get(FAREWELL\_CHAN);
if (!channel?.isTextBased()) return;
await channel.send({ content: byeMsg });

```
  // 2) Génération + envoi de la carte
  const buffer = await generateCard({
    username:    member.user.username,
    avatarURL:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
    memberCount: member.guild.memberCount - 1,
    isWelcome:   false
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'farewell.png' });
  await channel.send({ files: [attachment] });
} catch (err) {
  console.error('Erreur guildMemberRemove:', err);
}
```

});
};
