require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
require('../src/models/Console');
const Game = require('../src/models/Game');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'public', 'images', 'screenshots');
const MAX_SCREENSHOTS = 7;

const CONSOLE_COLORS = {
  'dendy-nes':         { bg: '#e53935', fg: '#ffffff' },
  'sega-mega-drive':   { bg: '#2196f3', fg: '#ffffff' },
  'sega-master-system':{ bg: '#9e9e9e', fg: '#ffffff' },
  'atari-2600':        { bg: '#795548', fg: '#ffffff' },
  'snes':              { bg: '#9c27b0', fg: '#ffffff' },
  'pc-engine':         { bg: '#ffb300', fg: '#1a1025' },
  'playstation':       { bg: '#1565c0', fg: '#ffffff' },
  'sega-saturn':       { bg: '#424242', fg: '#ffffff' },
  'nintendo-64':       { bg: '#2e7d32', fg: '#ffffff' },
};

function generateSvg(title, consoleSlug, index) {
  const colors = CONSOLE_COLORS[consoleSlug] || { bg: '#2d1b4e', fg: '#b388ff' };
  const hueShift = index * 20;
  const bgLighter = lighten(colors.bg, 10 + index * 5);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg}"/>
      <stop offset="100%" style="stop-color:${bgLighter}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="240" fill="url(#g)"/>
  <rect x="40" y="70" width="240" height="100" rx="8" fill="rgba(0,0,0,0.2)"/>
  <text x="160" y="120" font-family="monospace" font-size="14" fill="${colors.fg}" text-anchor="middle" opacity="0.8">${escapeXml(title)}</text>
  <text x="160" y="145" font-family="monospace" font-size="10" fill="${colors.fg}" text-anchor="middle" opacity="0.5">SCREENSHOT ${index + 1}</text>
</svg>`;
}

function lighten(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + Math.round(2.55 * percent));
  const g = Math.min(255, ((num >> 8) & 0xFF) + Math.round(2.55 * percent));
  const b = Math.min(255, (num & 0xFF) + Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const allGames = await Game.find({}).populate('consoleId').lean();
  const games = allGames.filter(g => {
    if (!g.screenshots || g.screenshots.length < MAX_SCREENSHOTS) return true;
    return g.screenshots.some(s => s.includes('placeholder'));
  });

  console.log(`Generating screenshots for ${games.length} games`);

  let count = 0;
  for (const game of games) {
    const consoleSlug = game.consoleId?.slug || 'dendy-nes';
    const filenames = [];

    for (let i = 0; i < MAX_SCREENSHOTS; i++) {
      const filename = `${game.slug}-${i}.svg`;
      const dest = path.join(SCREENSHOTS_DIR, filename);
      const svg = generateSvg(game.title, consoleSlug, i);
      fs.writeFileSync(dest, svg, 'utf-8');
      filenames.push(`/images/screenshots/${filename}`);
    }

    await Game.updateOne({ _id: game._id }, { $set: { screenshots: filenames } });
    count++;
    if (count % 50 === 0) console.log(`  ${count}/${games.length}`);
  }

  console.log(`Done: ${count} games updated`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
