const https = require('https');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');
const Console = require('../src/models/Console');

const OUT_DIR = path.join(__dirname, '../public/images/screenshots/real');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const REPO_MAP = {
  'playstation': 'Sony_-_PlayStation',
  'sega-saturn': 'Sega_-_Saturn',
  'nintendo-64': 'Nintendo_-_Nintendo_64',
  'dendy-nes': 'Nintendo_-_Nintendo_Entertainment_System',
  'sega-master-system': 'Sega_-_Master_System_-_Mark_III',
  'atari-2600': 'Atari_-_2600',
  'sega-mega-drive': 'Sega_-_Mega_Drive_-_Genesis',
  'snes': 'Nintendo_-_Super_Nintendo_Entertainment_System',
  'pc-engine': 'NEC_-_PC_Engine_-_TurboGrafx_16'
};

const TITLE_OVERRIDES = {
  'Castlevania 64': 'Castlevania (USA)',
  'Star Wars: Rogue Squadron': 'Star Wars - Rogue Squadron (USA)',
  'Einhänder': 'Einhaender (USA)',
  'UN Squadron': 'U.N. Squadron (USA)',
  'NHL Hockey \'94': 'NHL \'94 (USA, Europe)',
  'Castlevania: Rondo of Blood': 'Akumajou Dracula X - Chi no Rondo (Japan)',
  'Ys Book I & II': 'Ys I & II (USA)',
  'Galerians': 'Galerians (USA) (Disc 1)',
  'Takatron 2084': 'Takatron (USA)',
  'Tetrade': 'Tetrade (USA)',
  'Twintris 64': 'Twintris 64 (USA)',
  'Pong 64': 'Pong (USA)'
};

function checkRawUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      resolve(res.statusCode === 200 ? url : null);
    });
    req.on('error', () => resolve(null));
    req.setTimeout(4000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

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

function generateCandidateNames(title) {
  if (TITLE_OVERRIDES[title]) {
    const ov = TITLE_OVERRIDES[title];
    return [
      `${ov}.png`,
      `${ov} (USA).png`,
      `${ov} (World).png`,
      `${ov} (Europe).png`
    ];
  }

  const cleanTitle = title.trim();
  const withDash = cleanTitle.replace(/: /g, ' - ').replace(/:/g, ' - ');
  const baseVariants = Array.from(new Set([cleanTitle, withDash]));
  
  const regions = [
    '(USA)',
    '(USA, Europe)',
    '(World)',
    '(Europe)',
    '(Japan)',
    '(USA) (Disc 1)',
    '(Europe) (Disc 1)',
    '(USA) (v1.0)',
    '(USA) (v1.1)',
    '(USA) (v1.2)',
    '(USA) (En,Fr,De)',
    '(USA) (Aftermarket)',
    '(USA) (Unl)',
    '(World) (Aftermarket) (Homebrew)',
    '(World) (Unl)',
    '(USA) (Homebrew)'
  ];
  
  const candidates = [];
  for (const b of baseVariants) {
    for (const r of regions) {
      candidates.push(`${b} ${r}.png`);
    }
    candidates.push(`${b}.png`);
  }
  return candidates;
}

async function findAndDownloadForGame(game, repo) {
  const destFile = path.join(OUT_DIR, `${game.slug}.png`);
  if (fs.existsSync(destFile) && fs.statSync(destFile).size > 1000) {
    await Game.updateOne(
      { _id: game._id },
      { $set: { screenshots: [`/images/screenshots/real/${game.slug}.png`] } }
    );
    return true;
  }

  const candidates = generateCandidateNames(game.title);
  const urls = candidates.map(cand => 
    `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Snaps/${encodeURIComponent(cand)}`
  );

  // Check all candidate URLs in parallel batches of 6
  let foundUrl = null;
  for (let i = 0; i < urls.length; i += 6) {
    const chunk = urls.slice(i, i + 6);
    const results = await Promise.all(chunk.map(checkRawUrl));
    const hit = results.find(r => r !== null);
    if (hit) {
      foundUrl = hit;
      break;
    }
  }

  if (foundUrl) {
    try {
      await downloadFile(foundUrl, destFile);
      await Game.updateOne(
        { _id: game._id },
        { $set: { screenshots: [`/images/screenshots/real/${game.slug}.png`] } }
      );
      return true;
    } catch (e) {
      console.error(`Download error for ${game.title}: ${e.message}`);
    }
  }
  return false;
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  console.log('Connected to MongoDB.');

  const consoles = await Console.find({});
  for (const c of consoles) {
    const repo = REPO_MAP[c.slug];
    if (!repo) continue;
    const games = await Game.find({ consoleId: c._id });
    console.log(`\nProcessing ${c.name} (${games.length} games)...`);

    let matched = 0;
    const failed = [];

    // Process games with concurrency 5
    const CONCURRENCY = 5;
    for (let i = 0; i < games.length; i += CONCURRENCY) {
      const slice = games.slice(i, i + CONCURRENCY);
      await Promise.all(slice.map(async g => {
        const ok = await findAndDownloadForGame(g, repo);
        if (ok) matched++;
        else failed.push(g.title);
      }));
      process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY, games.length)}/${games.length} (matched ${matched})...\r`);
    }

    console.log(`\n${c.name}: Matched & downloaded ${matched}/${games.length}`);
    if (failed.length) console.log(`Unmatched (${failed.length}):`, failed.join(', '));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
