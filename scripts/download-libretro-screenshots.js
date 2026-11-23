const https = require('https');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');
const Console = require('../src/models/Console');

const OUT_DIR = path.join(__dirname, '../public/images/screenshots/real');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const repos = {
  'dendy-nes': [{ repo: 'Nintendo_-_Nintendo_Entertainment_System', sha: '330b8e113799073ded013a3186bb0f6f7f3c216a' }],
  'sega-master-system': [{ repo: 'Sega_-_Master_System_-_Mark_III', sha: '833f9171ece48fad5fa3698b9df697a6f64d7ade' }],
  'atari-2600': [{ repo: 'Atari_-_2600', sha: 'bd1ddd97cc7714947db928ea19532d348f33bba8' }],
  'sega-mega-drive': [{ repo: 'Sega_-_Mega_Drive_-_Genesis', sha: '5cb6e38020ef16c000c86f34f6b0ba51f922d176' }],
  'snes': [{ repo: 'Nintendo_-_Super_Nintendo_Entertainment_System', sha: '4a773640e2592d5d38d9055c5cf42157537994ea' }],
  'pc-engine': [
    { repo: 'NEC_-_PC_Engine_-_TurboGrafx_16', sha: '524aeee6ee9955080ffe4f0ca9525505f8ebec73' },
    { repo: 'NEC_-_PC_Engine_CD_-_TurboGrafx-CD', sha: 'cfcf7808d6f04c3fac4db46c1c693a7294dc7aed' }
  ],
  'playstation': [{ repo: 'Sony_-_PlayStation', sha: 'fadfefd5090473c9b1c05e9125f31ac37c4c75c9' }],
  'sega-saturn': [{ repo: 'Sega_-_Saturn', sha: '7135811aba7735535525f4c400edbb48e2bfb76a' }],
  'nintendo-64': [{ repo: 'Nintendo_-_Nintendo_64', sha: 'bf184e9d920d29e4f74d37415489071e004add93' }]
};

const TITLE_ALIASES = {
  'Castlevania 64': 'Castlevania (USA)',
  'Star Wars: Rogue Squadron': 'Star Wars - Rogue Squadron',
  'Einhänder': 'Einhaender',
  'UN Squadron': 'U.N. Squadron',
  'NHL Hockey \'94': 'NHL \'94',
  'Castlevania: Rondo of Blood': 'Akumajou Dracula X - Chi no Rondo',
  'Ys Book I & II': 'Ys I & II',
  'Galerians': 'Galerians (USA)'
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
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

function normalize(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMatch(gameTitle, snapEntries) {
  let searchTitle = TITLE_ALIASES[gameTitle] || gameTitle;
  const normTitle = normalize(searchTitle);
  const words = normTitle.split(' ').filter(w => w.length > 1 && !['the', 'of', 'in', 'and', 'a', 'to', 'for'].includes(w));

  // 1. Exact / prefix match
  for (const entry of snapEntries) {
    const fnNorm = normalize(entry.file.replace(/\.png$/i, ''));
    if (fnNorm.startsWith(normTitle)) return entry;
  }

  // 2. Contains all words
  let best = null;
  let bestScore = 0;
  for (const entry of snapEntries) {
    const fnNorm = normalize(entry.file.replace(/\.png$/i, ''));
    let matchedWords = 0;
    for (const w of words) {
      if (fnNorm.includes(w)) matchedWords++;
    }
    if (matchedWords === words.length && words.length > 0) {
      let score = 100;
      if (entry.file.includes('(USA)')) score += 30;
      if (entry.file.includes('(World)')) score += 20;
      if (entry.file.includes('(Europe)')) score += 15;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }
  return best;
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  console.log('Connected to MongoDB.');

  const consoles = await Console.find({});
  let downloadedCount = 0;
  let alreadyExistsCount = 0;

  for (const c of consoles) {
    const cfgs = repos[c.slug];
    if (!cfgs) continue;

    console.log(`\nFetching tree for ${c.name} (${c.slug})...`);
    const snapEntries = [];
    for (const cfg of cfgs) {
      const treeRes = await get('https://api.github.com/repos/libretro-thumbnails/' + cfg.repo + '/git/trees/' + cfg.sha);
      if (treeRes.status === 200) {
        const files = JSON.parse(treeRes.data).tree.map(t => ({ repo: cfg.repo, file: t.path }));
        snapEntries.push(...files);
      }
    }
    console.log(`Loaded ${snapEntries.length} snapshots for ${c.name}`);

    const games = await Game.find({ consoleId: c._id });
    const downloadQueue = [];

    for (const g of games) {
      const match = findBestMatch(g.title, snapEntries);
      if (match) {
        const destFile = path.join(OUT_DIR, `${g.slug}.png`);
        const url = `https://raw.githubusercontent.com/libretro-thumbnails/${match.repo}/master/Named_Snaps/${encodeURIComponent(match.file)}`;
        downloadQueue.push({ game: g, url, destFile, matchName: match.file });
      }
    }

    console.log(`Downloading ${downloadQueue.length} matched games for ${c.name}...`);

    // Process in batches of 15
    const BATCH_SIZE = 15;
    for (let i = 0; i < downloadQueue.length; i += BATCH_SIZE) {
      const batch = downloadQueue.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async item => {
        try {
          if (!fs.existsSync(item.destFile) || fs.statSync(item.destFile).size < 1000) {
            await downloadFile(item.url, item.destFile);
            downloadedCount++;
          } else {
            alreadyExistsCount++;
          }
          // Update game screenshots in Mongo
          await Game.updateOne(
            { _id: item.game._id },
            { $set: { screenshots: [`/images/screenshots/real/${item.game.slug}.png`] } }
          );
        } catch (e) {
          console.error(`Failed ${item.game.title} (${item.matchName}): ${e.message}`);
        }
      }));
      process.stdout.write(`Processed ${Math.min(i + BATCH_SIZE, downloadQueue.length)}/${downloadQueue.length}...\r`);
    }
    console.log(`Finished ${c.name}.`);
  }

  console.log(`\nAll done! Downloaded: ${downloadedCount}, Existed: ${alreadyExistsCount}`);
  await mongoose.disconnect();
}

run().catch(console.error);
