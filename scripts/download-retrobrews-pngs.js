const fs = require('fs');
const path = require('path');
const https = require('https');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');
const Console = require('../src/models/Console');

const BASE_DIR = path.resolve(__dirname, '..');
const REAL_DIR = path.join(BASE_DIR, 'public', 'images', 'screenshots', 'real');
if (!fs.existsSync(REAL_DIR)) fs.mkdirSync(REAL_DIR, { recursive: true });

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(true));
        });
      } else {
        file.close();
        fs.unlink(destPath, () => {});
        resolve(false);
      }
    }).on('error', () => {
      file.close();
      fs.unlink(destPath, () => {});
      resolve(false);
    });
  });
}

const REPO_FOR_CONSOLE = {
  'dendy-nes': 'nes-games',
  'sega-mega-drive': 'md-games',
  'snes': 'snes-games',
  'sega-master-system': 'sms-games',
  'atari-2600': 'atari2600-games'
};

async function main() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const consoles = await Console.find({}).lean();
  const cMap = {};
  consoles.forEach(c => cMap[c._id.toString()] = c.slug);

  const games = await Game.find({}).lean();
  const targetGames = games.filter(g => (g.screenshots || []).some(s => s && s.startsWith('/images/games/')));
  console.log(`Checking real screenshots from retrobrews for ${targetGames.length} games...`);

  let downloaded = 0;
  for (const g of targetGames) {
    const cSlug = cMap[g.consoleId.toString()];
    const repo = REPO_FOR_CONSOLE[cSlug];
    if (!repo) continue;

    // determine possible file base names
    const names = [];
    if (g.romFile) {
      names.push(path.basename(g.romFile, path.extname(g.romFile)));
    }
    if (g.romPath) {
      names.push(path.basename(g.romPath, path.extname(g.romPath)));
    }
    const clean = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    names.push(clean);
    names.push(g.slug.replace(/^[a-z0-9]+-/, ''));

    let ok = false;
    const destPath = path.join(REAL_DIR, `${g.slug}.png`);
    for (const name of names) {
      const url = `https://raw.githubusercontent.com/retrobrews/${repo}/master/${name}.png`;
      ok = await downloadFile(url, destPath);
      if (ok) {
        console.log(`[OK] ${g.slug} <= ${url}`);
        g.screenshots = [`/images/screenshots/real/${g.slug}.png`];
        await Game.updateOne({ _id: g._id }, { $set: { screenshots: g.screenshots } });
        downloaded++;
        break;
      }
    }
  }

  console.log(`Downloaded and updated ${downloaded} games from retrobrews.`);
  await mongoose.disconnect();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
