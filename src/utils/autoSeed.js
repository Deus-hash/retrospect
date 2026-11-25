const fs = require('fs');
const path = require('path');
const Console = require('../models/Console');
const Game = require('../models/Game');
const Accessory = require('../models/Accessory');
const consolesSeed = require('../seeds/consoles.seed');

async function syncConsoleControlsHelp() {
  for (const c of consolesSeed) {
    if (c && c.slug && c.controlsHelp) {
      await Console.updateOne(
        { slug: c.slug, controlsHelp: { $ne: c.controlsHelp } },
        { $set: { controlsHelp: c.controlsHelp } }
      );
    }
  }
}

async function syncMissingGamesFromSnapshot() {
  const snapshotPath = path.join(__dirname, '../data/db-snapshot.json');
  if (!fs.existsSync(snapshotPath)) return;
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (!snapshot.games || !snapshot.games.length) return;

  const snapConsoleSlugById = new Map((snapshot.consoles || []).map(c => [String(c._id), c.slug]));
  const dbConsoles = await Console.find({}, '_id slug').lean();
  const dbConsoleIdBySlug = new Map(dbConsoles.map(c => [c.slug, c._id]));
  const existingSlugs = new Set((await Game.find({}, 'slug').lean()).map(g => g.slug));

  const toInsert = [];
  for (const g of snapshot.games) {
    if (!g || !g.slug || existingSlugs.has(g.slug)) continue;
    const cSlug = snapConsoleSlugById.get(String(g.consoleId));
    const targetConsoleId = cSlug ? dbConsoleIdBySlug.get(cSlug) : g.consoleId;
    if (!targetConsoleId) continue;
    const { _id, ...rest } = g;
    toInsert.push({ ...rest, consoleId: targetConsoleId });
  }
  if (toInsert.length > 0) {
    await Game.insertMany(toInsert);
    console.log(`AutoSeed: Synced ${toInsert.length} new game(s) from snapshot.`);
  }
}

async function autoSeed() {
  try {
    const gameCount = await Game.countDocuments();
    if (gameCount > 0) {
      await syncConsoleControlsHelp();
      await syncMissingGamesFromSnapshot();
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
