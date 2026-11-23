const https = require('https');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');
const Console = require('../src/models/Console');

const REPO_MAP = {
  'dendy-nes': 'Nintendo_-_Nintendo_Entertainment_System',
  'sega-mega-drive': 'Sega_-_Mega_Drive_-_Genesis',
  'snes': 'Nintendo_-_Super_Nintendo_Entertainment_System',
  'sega-master-system': 'Sega_-_Master_System_-_Mark_III',
  'atari-2600': 'Atari_-_2600',
  'pc-engine': 'NEC_-_PC_Engine_-_TurboGrafx_16',
  'nintendo-64': 'Nintendo_-_Nintendo_64',
  'playstation': 'Sony_-_PlayStation',
  'sega-saturn': 'Sega_-_Saturn'
};

function check(repo, filename) {
  return new Promise((resolve) => {
    const url = 'https://raw.githubusercontent.com/libretro-thumbnails/' + repo + '/master/Named_Snaps/' + encodeURIComponent(filename);
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      resolve(res.statusCode === 200 ? { url, filename } : null);
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function probe() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const consoles = await Console.find({}).lean();
  const cMap = {};
  consoles.forEach(c => cMap[c._id.toString()] = c.slug);
  
  const games = await Game.find({}).lean();
  const targetGames = games.filter(g => (g.screenshots || []).some(s => s && s.startsWith('/images/games/')));
  console.log('Target games:', targetGames.length);
  
  const hits = [];
  const misses = [];

  for (const g of targetGames) {
    const cSlug = cMap[g.consoleId.toString()];
    const repo = REPO_MAP[cSlug];
    const base = g.title.replace(/[\\/:*?"<>|]/g, '').trim();
    const noParen = base.split('(')[0].trim();
    const candidates = [
      base + '.png',
      base + ' (USA).png',
      base + ' (World).png',
      base + ' (Europe).png',
      base + ' (PD).png',
      base + ' (Unl).png',
      noParen + '.png',
      noParen + ' (USA).png',
      noParen + ' (World).png',
      noParen + ' (Europe).png'
    ];
    let found = null;
    for (const cand of candidates) {
      found = await check(repo, cand);
      if (found) {
        hits.push({ slug: g.slug, repo, filename: found.filename, url: found.url });
        console.log('[HIT]', g.slug, '=>', found.filename);
        break;
      }
    }
    if (!found) {
      misses.push({ slug: g.slug, title: g.title, cSlug, repo, romPath: g.romPath, romFile: g.romFile });
    }
  }

  console.log(`\nResults: ${hits.length} hits, ${misses.length} misses`);
  console.log('Misses:');
  misses.forEach(m => console.log('  -', m.cSlug, '|', m.slug, '|', m.title, '| rom:', m.romFile || m.romPath));

  await mongoose.disconnect();
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
