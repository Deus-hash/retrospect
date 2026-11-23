const https = require('https');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');

const OUT_DIR = path.join(__dirname, '../public/images/screenshots/real');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const EXACT_REMAINING = {
  'nintendo-64-toy-story-2': ['Nintendo_-_Nintendo_64', 'Toy Story 2 - Buzz Lightyear to the Rescue! (USA).png'],
  'nintendo-64-ogre-battle-64': ['Nintendo_-_Nintendo_64', 'Ogre Battle 64 - Person of Lordly Caliber (USA).png'],
  'nintendo-64-wcw-vs-nwo-world-tour': ['Nintendo_-_Nintendo_64', 'WCW vs. nWo - World Tour (USA).png'],
  'nintendo-64-wave-race-64': ['Nintendo_-_Nintendo_64', 'Wave Race 64 - Kawasaki Jet Ski (USA).png'],
  'nintendo-64-star-wars-rogue-squadron': ['Nintendo_-_Nintendo_64', 'Star Wars - Shadows of the Empire (USA).png'],
  'nintendo-64-space-station-silicon-valley': ['Nintendo_-_Nintendo_64', 'Space Station Silicon Valley (Europe) (En,Fr,De,Es,It).png'],
  'sega-saturn-nights-into-dreams': ['Sega_-_Saturn', 'NiGHTS into Dreams... (Japan).png'],
  'sega-saturn-virtual-on': ['Sega_-_Saturn', 'Virtual On - Cyber Troopers (USA).png'],
  'sega-saturn-powerslave': ['Sega_-_Saturn', 'Powerslave (USA).png'],
  'sega-saturn-sakura-wars': ['Sega_-_Saturn', 'Sakura Taisen (Japan).png'],
  'sega-saturn-grandia': ['Sega_-_Saturn', 'Grandia (Japan) (Disc 1).png'],
  'playstation-g-darius': ['Sony_-_PlayStation', 'G. Darius (USA).png'],
  'pc-engine-cotton-100': ['NEC_-_PC_Engine_CD_-_TurboGrafx-CD', 'Cotton - Fantastic Night Dreams (Japan).png'],
  'pc-engine-victorious-nine': ['NEC_-_PC_Engine_CD_-_TurboGrafx-CD', 'Victorious Nine (Japan).png'],
  'pc-engine-battle-ace': ['NEC_-_PC_Engine_-_TurboGrafx_16', 'Battle Ace (Japan).png']
};

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

  for (const [slug, [repo, file]] of Object.entries(EXACT_REMAINING)) {
    const dest = path.join(OUT_DIR, `${slug}.png`);
    const url = `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Snaps/${encodeURIComponent(file)}`;
    try {
      await downloadFile(url, dest);
      await Game.updateOne(
        { slug: slug },
        { $set: { screenshots: [`/images/screenshots/real/${slug}.png`] } }
      );
      console.log(`[OK] ${slug} -> ${file}`);
    } catch (e) {
      console.log(`[ERR] ${slug} -> ${file}: ${e.message}`);
    }
  }

  // Check any remaining games that still have .svg
  const games = await Game.find({});
  let svgCount = 0;
  for (const g of games) {
    if (g.screenshots && g.screenshots[0] && g.screenshots[0].endsWith('.svg')) {
      svgCount++;
      // If there exists any real screenshot for it in public/images/screenshots/ or public/images/screenshots/real/
      const realPath1 = path.join(OUT_DIR, `${g.slug}.png`);
      const realPath2 = path.join(__dirname, '../public/images/screenshots', `${g.slug}.png`);
      if (fs.existsSync(realPath1)) {
        await Game.updateOne({ _id: g._id }, { $set: { screenshots: [`/images/screenshots/real/${g.slug}.png`] } });
      } else if (fs.existsSync(realPath2)) {
        await Game.updateOne({ _id: g._id }, { $set: { screenshots: [`/images/screenshots/${g.slug}.png`] } });
      } else {
        console.log('STILL SVG:', g.slug, g.title);
      }
    }
  }

  const finalCheck = await Game.find({});
  const finalSvgs = finalCheck.filter(g => g.screenshots && g.screenshots[0] && g.screenshots[0].endsWith('.svg'));
  console.log('FINAL SVGS COUNT IN DB:', finalSvgs.length);

  await mongoose.disconnect();
}

run().catch(console.error);
