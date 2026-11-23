const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Game = require('../src/models/Game');
const Console = require('../src/models/Console');
const Accessory = require('../src/models/Accessory');

async function exportSnapshot() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  
  const consoles = await Console.find({}).lean();
  const games = await Game.find({}).lean();
  const accessories = await Accessory.find({}).lean();

  console.log(`Exporting: ${consoles.length} consoles, ${games.length} games, ${accessories.length} accessories`);

  const snapshot = {
    consoles,
    games,
    accessories
  };

  const outDir = path.join(__dirname, '../src/data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'db-snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`Saved snapshot to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  await mongoose.disconnect();
}

exportSnapshot().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
