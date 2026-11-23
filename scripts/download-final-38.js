const https = require('https');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');

const OUT_DIR = path.join(__dirname, '../public/images/screenshots/real');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const EXACT_MAP = {
  'pc-engine-cotton-100': ['NEC_-_PC_Engine_CD_-_TurboGrafx-CD', 'Cotton - Fantastic Night Dreams (Japan).png'],
  'pc-engine-victorious-nine': ['NEC_-_PC_Engine_CD_-_TurboGrafx-CD', 'Victorious Nine (Japan).png'],
  'pc-engine-battle-ace': ['NEC_-_PC_Engine_-_TurboGrafx_16', 'Battle Ace (Japan).png'],
  'playstation-gran-turismo-2': ['Sony_-_PlayStation', 'Gran Turismo 2 (USA) (Arcade Mode).png'],
  'playstation-resident-evil-3': ['Sony_-_PlayStation', 'Resident Evil 3 - Nemesis (USA).png'],
  'playstation-legend-of-dragoon': ['Sony_-_PlayStation', 'Legend of Dragoon, The (USA) (Disc 1).png'],
  'playstation-lunar-silver-star-story': ['Sony_-_PlayStation', 'Lunar - Silver Star Story Complete (USA) (Disc 1).png'],
  'playstation-lunar-2-eternal-blue': ['Sony_-_PlayStation', 'Lunar 2 - Eternal Blue Complete (USA) (Disc 1).png'],
  'playstation-star-ocean-second-story': ['Sony_-_PlayStation', 'Star Ocean - The Second Story (USA) (Disc 1).png'],
  'playstation-g-darius': ['Sony_-_PlayStation', 'G Darius (USA).png'],
  'playstation-soul-reaver': ['Sony_-_PlayStation', 'Legacy of Kain - Soul Reaver (USA).png'],
  'playstation-legacy-of-kain': ['Sony_-_PlayStation', 'Blood Omen - Legacy of Kain (USA).png'],
  'playstation-crash-team-racing': ['Sony_-_PlayStation', 'CTR - Crash Team Racing (USA).png'],
  'playstation-ridge-racer-type-4': ['Sony_-_PlayStation', 'R4 - Ridge Racer Type 4 (USA).png'],
  'playstation-tenchu': ['Sony_-_PlayStation', 'Tenchu - Stealth Assassins (USA).png'],
  'sega-saturn-nights-into-dreams': ['Sega_-_Saturn', 'NiGHTS Into Dreams... (USA).png'],
  'sega-saturn-x-men-vs-street-fighter': ['Sega_-_Saturn', 'X-Men vs. Street Fighter (Japan).png'],
  'sega-saturn-galerians': ['Sony_-_PlayStation', 'Galerians (USA) (Disc 1).png'],
  'sega-saturn-virtual-on': ['Sega_-_Saturn', 'Cyber Troopers Virtual-On (USA).png'],
  'sega-saturn-powerslave': ['Sega_-_Saturn', 'PowerSlave (USA).png'],
  'sega-saturn-legend-of-oasis': ['Sega_-_Saturn', 'Legend of Oasis, The (USA).png'],
  'sega-saturn-sakura-wars': ['Sega_-_Saturn', 'Sakura Taisen (Japan).png'],
  'sega-saturn-grandia': ['Sega_-_Saturn', 'Grandia (Japan) (Disc 1).png'],
  'sega-saturn-vandal-hearts': ['Sony_-_PlayStation', 'Vandal Hearts (USA).png'],
  'nintendo-64-the-legend-of-zelda-ocarina-of-time': ['Nintendo_-_Nintendo_64', 'Legend of Zelda, The - Ocarina of Time (USA).png'],
  'nintendo-64-pok-mon-stadium': ['Nintendo_-_Nintendo_64', 'Pokemon Stadium (USA).png'],
  'nintendo-64-pok-mon-snap': ['Nintendo_-_Nintendo_64', 'Pokemon Snap (USA).png'],
  'nintendo-64-yoshi-s-story': ['Nintendo_-_Nintendo_64', 'Yoshi\'s Story (USA) (En,Ja).png'],
  'nintendo-64-wave-race-64': ['Nintendo_-_Nintendo_64', 'Wave Race 64 (USA) (Rev A).png'],
  'nintendo-64-1080-snowboarding': ['Nintendo_-_Nintendo_64', '1080 Snowboarding (Japan, USA) (En,Ja).png'],
  'nintendo-64-star-wars-rogue-squadron': ['Nintendo_-_Nintendo_64', 'Star Wars - Rogue Squadron (USA) (Rev A).png'],
  'nintendo-64-mystical-ninja': ['Nintendo_-_Nintendo_64', 'Mystical Ninja Starring Goemon (USA).png'],
  'nintendo-64-ogre-battle-64': ['Nintendo_-_Nintendo_64', 'Ogre Battle 64 - Person of Lordly Caliber (USA) (Rev A).png'],
  'nintendo-64-nba-hang-time': ['Nintendo_-_Nintendo_64', 'NBA Hangtime (USA).png'],
  'nintendo-64-wcw-vs-nwo-world-tour': ['Nintendo_-_Nintendo_64', 'WCW vs. nWo - World Tour (USA) (Rev A).png'],
  'nintendo-64-rayman-2': ['Nintendo_-_Nintendo_64', 'Rayman 2 - The Great Escape (USA) (En,Fr,De,Es,It).png'],
  'nintendo-64-space-station-silicon-valley': ['Nintendo_-_Nintendo_64', 'Space Station Silicon Valley (USA) (Rev A).png'],
  'nintendo-64-toy-story-2': ['Nintendo_-_Nintendo_64', 'Toy Story 2 (USA).png']
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

  let downloaded = 0;
  for (const [slug, [repo, filename]] of Object.entries(EXACT_MAP)) {
    const dest = path.join(OUT_DIR, `${slug}.png`);
    const url = `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Snaps/${encodeURIComponent(filename)}`;
    try {
      await downloadFile(url, dest);
      await Game.updateOne(
        { slug: slug },
        { $set: { screenshots: [`/images/screenshots/real/${slug}.png`] } }
      );
      downloaded++;
      console.log(`[OK] ${slug} -> ${filename}`);
    } catch (e) {
      console.error(`[FAIL] ${slug}: ${e.message}`);
    }
  }

  console.log(`Downloaded ${downloaded}/${Object.keys(EXACT_MAP).length} remaining games!`);
  await mongoose.disconnect();
}

run().catch(console.error);
