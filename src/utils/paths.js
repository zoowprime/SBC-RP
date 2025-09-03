const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../assets/data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

module.exports = { dataDir };
