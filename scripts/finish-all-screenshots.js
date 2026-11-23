const fs = require('fs');
const path = require('path');
const https = require('https');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');

const REAL_DIR = path.join(__dirname, '../public/images/screenshots/real');
const SNAPS_DIR = path.join(__dirname, '../public/images/screenshots');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => resolve());
    }).on('error', reject);
  });
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  console.log('Connected to MongoDB.');

  // 1. Battle Ace
  const baDest = path.join(REAL_DIR, 'pc-engine-battle-ace.png');
  const baSrc = path.join(SNAPS_DIR, 'pc-engine-battle-ace.png');
  if (fs.existsSync(baSrc)) {
    fs.copyFileSync(baSrc, baDest);
    await Game.updateOne({ slug: 'pc-engine-battle-ace' }, { $set: { screenshots: ['/images/screenshots/real/pc-engine-battle-ace.png'] } });
    console.log('[OK] pc-engine-battle-ace copied from authentic snap');
  }

  // 2. Grandia
  // Grandia exists on PS1 in libretro
  const grandiaUrl = 'https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Snaps/' + encodeURIComponent('Grandia (USA).png');
  const grandiaDest = path.join(REAL_DIR, 'sega-saturn-grandia.png');
  try {
    await downloadFile(grandiaUrl, grandiaDest);
    await Game.updateOne({ slug: 'sega-saturn-grandia' }, { $set: { screenshots: ['/images/screenshots/real/sega-saturn-grandia.png'] } });
    console.log('[OK] sega-saturn-grandia downloaded');
  } catch(e) { console.error('Grandia:', e.message); }

  // 3. Cotton 100%
  const cottonDest = path.join(REAL_DIR, 'pc-engine-cotton-100.png');
  if (fs.existsSync(cottonDest)) {
    await Game.updateOne({ slug: 'pc-engine-cotton-100' }, { $set: { screenshots: ['/images/screenshots/real/pc-engine-cotton-100.png'] } });
    console.log('[OK] pc-engine-cotton-100 updated');
  }

  // 4. Victorious Nine
  const vicDest = path.join(REAL_DIR, 'pc-engine-victorious-nine.png');
  if (fs.existsSync(vicDest)) {
    await Game.updateOne({ slug: 'pc-engine-victorious-nine' }, { $set: { screenshots: ['/images/screenshots/real/pc-engine-victorious-nine.png'] } });
    console.log('[OK] pc-engine-victorious-nine updated');
  }

  // 5. Sakura Wars
  const sakuraDest = path.join(REAL_DIR, 'sega-saturn-sakura-wars.png');
  if (fs.existsSync(sakuraDest)) {
    await Game.updateOne({ slug: 'sega-saturn-sakura-wars' }, { $set: { screenshots: ['/images/screenshots/real/sega-saturn-sakura-wars.png'] } });
    console.log('[OK] sega-saturn-sakura-wars updated');
  }

  // 6. Space Station Silicon Valley
  const sssvDest = path.join(REAL_DIR, 'nintendo-64-space-station-silicon-valley.png');
  if (fs.existsSync(sssvDest)) {
    await Game.updateOne({ slug: 'nintendo-64-space-station-silicon-valley' }, { $set: { screenshots: ['/images/screenshots/real/nintendo-64-space-station-silicon-valley.png'] } });
    console.log('[OK] nintendo-64-space-station-silicon-valley updated');
  }

  // Final check across ALL 568 games
  const allGames = await Game.find({});
  let svgCount = 0;
  let realCount = 0;
  const stillBad = [];
  for (const g of allGames) {
    if (!g.screenshots || !g.screenshots[0] || !g.screenshots[0].endsWith('.png')) {
      svgCount++;
      stillBad.push(g.slug);
    } else {
      realCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`FINAL RESULT:`);
  console.log(`Games with REAL PNG screenshots: ${realCount} / ${allGames.length}`);
  console.log(`Games with SVG: ${svgCount}`);
  if (stillBad.length) console.log('Still bad:', stillBad);
  console.log(`========================================`);

  await mongoose.disconnect();
}

run().catch(console.error);
