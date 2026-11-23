require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const https = require('https');
const got = require('got');
const config = require('../src/config');
require('../src/models/Console');
const Game = require('../src/models/Game');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'public', 'images', 'screenshots');

const CONSOLE_MAP = {
  'dendy-nes': 'dendy',
  'sega-mega-drive': 'genesis',
  'sega-master-system': 'sms',
  'atari-2600': '2600',
  'snes': 'snes',
  'pc-engine': 'pce',
  'playstation': 'psx',
  'sega-saturn': 'saturn',
  'nintendo-64': 'n64',
};

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('http')) url = 'https:' + url;
    https.get(url, { timeout: 15000, headers: { 'User-Agent': 'RetroPet/1.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isBadImage(path) {
  return /hack|mod|patch|proto|beta|unreleased|homebrew|translation/i.test(path);
}

async function getAllScreenshots(emuConsole, slug) {
  const url = `https://www.emu-land.net/consoles/${emuConsole}/roms/${slug}/`;
  try {
    const resp = await got(url, { timeout: 10000, headers: { 'User-Agent': 'RetroPet/1.0' } });
    const html = resp.body;

    const results = [];

    const ssLinks = html.matchAll(/<a[^>]+class="ss"[^>]+href="([^"]+)"[^>]*data-caption="([^"]*)"[^>]*>/g);
    for (const m of ssLinks) {
      results.push({ src: m[1], caption: m[2].trim() });
    }

    // Only use data-gallery if no ss links found
    if (results.length === 0) {
      const dg = html.match(/data-gallery="([^"]+)"/);
      if (dg) {
        const cleaned = dg[1].replace(/&quot;/g, '"').replace(/\\"/g, '"').replace(/\\\//g, '/');
        const gallery = JSON.parse(cleaned);
        if (gallery.list) {
          for (const item of gallery.list) {
            results.push({ src: item.src, caption: (item.caption || '').trim() });
          }
        }
      }
    }

    return results;
  } catch (e) {
    return [];
  }
}

function pickBest(screenshots) {
  let title = null, ingame = null, cleanFirst = null;

  for (const s of screenshots) {
    const cap = s.caption.toLowerCase();
    if (isBadImage(s.src)) continue;
    if (!cleanFirst) cleanFirst = s.src;
    if (cap === 'title' && !title) title = s.src;
    if ((cap === 'in game' || cap.includes('game') || cap === 'gameplay') && !ingame) ingame = s.src;
  }

  return title || ingame || cleanFirst;
}

async function slugVariants(game) {
  const parts = game.slug.split('-');
  const base = parts.slice(2).join('-');
  const titleSlug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [...new Set([
    base,
    base.replace(/\bii\b/g, '2').replace(/\biii\b/g, '3').replace(/\biv\b/g, '4'),
    base.replace(/-and-/g, '-'),
    titleSlug,
    titleSlug.replace(/\bii\b/g, '2').replace(/\biii\b/g, '3').replace(/\biv\b/g, '4'),
    titleSlug.replace(/^the-/, ''),
  ])];
}

async function tryFindOnLetterPage(emuConsole, letter, title) {
  for (let page = 1; page <= 20; page++) {
    const url = page === 1
      ? `https://www.emu-land.net/consoles/${emuConsole}/roms/${letter}`
      : `https://www.emu-land.net/consoles/${emuConsole}/roms/${letter}/${page}`;
    try {
      const resp = await got(url, { timeout: 8000, headers: { 'User-Agent': 'RetroPet/1.0' } });
      const html = resp.body;
      const matches = html.matchAll(/<h4[^>]*>\s*<a\s+href="([^"]+)">([^<]+)<\/a>/g);
      for (const m of matches) {
        if (m[2].trim().toLowerCase() === title.toLowerCase()) {
          return m[1].replace(/^\/consoles\/[^/]+\/roms\//, '').replace(/\/$/, '');
        }
      }
      const hasNext = html.includes(`/consoles/${emuConsole}/roms/${letter}/${page + 1}`);
      if (!hasNext) break;
    } catch (e) { break; }
  }
  return null;
}

function normKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(ii|iii|iv)\b/g, m => ({ii:'2',iii:'3',iv:'4'})[m]).replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const allGames = await Game.find({}).populate('consoleId').lean();
  const pending = allGames.filter(g => {
    if (!g.screenshots || g.screenshots.length === 0) return true;
    return g.screenshots.every(s => !s || s.includes('placeholder') || s.includes('.svg'));
  });

  // Also include games that have bad screenshots
  const allWithBad = allGames.filter(g => {
    if (g.screenshots && g.screenshots[0] && !g.screenshots[0].includes('placeholder') && !g.screenshots[0].includes('.svg')) {
      return true; // re-evaluate all downloaded screenshots
    }
    return false;
  });

  const toProcess = allGames; // process ALL games
  console.log(`Processing ${toProcess.length} games...`);

  let ok = 0, fail = 0, skip = 0;

  for (const game of toProcess) {
    const ec = CONSOLE_MAP[game.consoleId?.slug];
    if (!ec) { skip++; continue; }

    const slugs = await slugVariants(game);
    let bestImg = null;

    for (const s of slugs) {
      const shots = await getAllScreenshots(ec, s);
      if (shots.length > 0) { bestImg = pickBest(shots); if (bestImg) break; }
    }

    // Try letter page search
    if (!bestImg) {
      const letter = game.title[0].toLowerCase();
      if (/[a-z0-9]/.test(letter)) {
        const foundSlug = await tryFindOnLetterPage(ec, letter, game.title);
        if (foundSlug) {
          const shots = await getAllScreenshots(ec, foundSlug);
          if (shots.length > 0) bestImg = pickBest(shots);
        }
      }
    }

    if (bestImg) {
      const ext = path.extname(bestImg.split('?')[0]) || '.png';
      const filename = `${game.slug}${ext}`;
      const dest = path.join(SCREENSHOTS_DIR, filename);
      try {
        await downloadImage(bestImg, dest);
        await Game.updateOne({ _id: game._id }, { $set: { screenshots: [`/images/screenshots/${filename}`] } });
        process.stdout.write('+');
        ok++;
      } catch (e) {
        process.stdout.write('!');
        fail++;
      }
    } else {
      process.stdout.write('.');
      fail++;
    }
    await sleep(300);
  }

  console.log(`\nDone: ${ok} OK, ${fail} failed, ${skip} skipped (no emu-land mapping)`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
