const fs = require('fs');
const path = require('path');
const Console = require('../models/Console');
const Game = require('../models/Game');
const Accessory = require('../models/Accessory');

async function autoSeed() {
  try {
    const gameCount = await Game.countDocuments();
    if (gameCount > 0) {
      return; // Already seeded
    }

    const snapshotPath = path.join(__dirname, '../data/db-snapshot.json');
    if (!fs.existsSync(snapshotPath)) {
      console.warn('AutoSeed: db-snapshot.json not found, skipping.');
      return;
    }

    console.log('AutoSeed: Empty database detected! Initializing Retrospect library from snapshot...');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

    if (snapshot.consoles && snapshot.consoles.length) {
      await Console.insertMany(snapshot.consoles);
      console.log(`AutoSeed: Inserted ${snapshot.consoles.length} consoles.`);
    }

    if (snapshot.accessories && snapshot.accessories.length) {
      await Accessory.insertMany(snapshot.accessories);
      console.log(`AutoSeed: Inserted ${snapshot.accessories.length} accessories.`);
    }

    if (snapshot.games && snapshot.games.length) {
      await Game.insertMany(snapshot.games);
      console.log(`AutoSeed: Inserted ${snapshot.games.length} games.`);
    }

    console.log('AutoSeed: Successfully restored all data!');
  } catch (err) {
    console.error('AutoSeed Error:', err.message);
  }
}

module.exports = autoSeed;
