const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BASE_DIR = path.resolve(__dirname, '..');
const GAMES_IMG_DIR = path.join(BASE_DIR, 'public', 'images', 'games');
const SCREENSHOTS_DIR = path.join(BASE_DIR, 'public', 'images', 'screenshots');

if (!fs.existsSync(GAMES_IMG_DIR)) fs.mkdirSync(GAMES_IMG_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const CONSOLE_THEMES = {
  'dendy-nes':          { bg: '#3b000a', accent: '#ff3344', border: '#e53935', badge: 'NES 8-BIT', hud: '#ffff55' },
  'sega-mega-drive':    { bg: '#041022', accent: '#00d2ff', border: '#2196f3', badge: 'SEGA 16-BIT', hud: '#00f0ff' },
  'sega-master-system': { bg: '#0a1420', accent: '#40c4ff', border: '#00b0ff', badge: 'SMS 8-BIT', hud: '#ffffff' },
  'atari-2600':         { bg: '#221105', accent: '#ff9800', border: '#ff6f00', badge: 'ATARI 2600', hud: '#ffcc00' },
  'snes':               { bg: '#1c0528', accent: '#e040fb', border: '#aa00ff', badge: 'SNES 16-BIT', hud: '#00e676' },
  'pc-engine':          { bg: '#281a00', accent: '#ffd700', border: '#ffab00', badge: 'PC ENGINE', hud: '#ffffff' },
  'playstation':        { bg: '#040e20', accent: '#2979ff', border: '#0055ff', badge: 'PS1 32-BIT', hud: '#ff0055' },
  'sega-saturn':        { bg: '#141414', accent: '#00e676', border: '#00c853', badge: 'SATURN 32-BIT', hud: '#00e676' },
  'nintendo-64':        { bg: '#041c0c', accent: '#00e676', border: '#2e7d32', badge: 'N64 64-BIT', hud: '#ffff00' },
};

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function generateSceneSvg(title, consoleSlug, year, genre, sceneIndex = 0) {
  const theme = CONSOLE_THEMES[consoleSlug] || { bg: '#12121c', accent: '#00f0ff', border: '#7c4dff', badge: 'RETRO', hud: '#ffffff' };
  const safeTitle = escapeXml(title);
  const safeGenre = escapeXml(genre || 'Аркада');
  const safeYear = year || '1990';
  
  const scenes = [
    { name: 'TITLE SCREEN', score: '000000', stage: '01' },
    { name: 'LEVEL 1 - ACTION', score: '028400', stage: '01' },
    { name: 'BONUS ZONE', score: '074900', stage: '02' },
    { name: 'BOSS ENCOUNTER', score: '158200', stage: '03' },
    { name: 'HALL OF FAME', score: '999990', stage: 'TOP' }
  ];
  const scene = scenes[sceneIndex % scenes.length];

  // Dynamic visual elements based on sceneIndex
  let artElements = '';
  if (sceneIndex === 0) {
    // Title screen
    artElements = `
      <rect x="80" y="80" width="160" height="40" fill="${theme.border}" opacity="0.3" rx="4"/>
      <text x="160" y="105" fill="${theme.accent}" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">★ START GAME ★</text>
      <text x="160" y="140" fill="#ffffff" font-family="monospace" font-size="10" text-anchor="middle">1 PLAYER GAME</text>
      <text x="160" y="156" fill="rgba(255,255,255,0.6)" font-family="monospace" font-size="10" text-anchor="middle">2 PLAYERS MODE</text>
    `;
  } else if (sceneIndex === 1) {
    // Gameplay
    artElements = `
      <!-- Ground / Platforms -->
      <rect x="20" y="180" width="280" height="20" fill="${theme.border}" opacity="0.6"/>
      <rect x="50" y="130" width="60" height="12" fill="${theme.accent}" opacity="0.5"/>
      <rect x="180" y="110" width="70" height="12" fill="${theme.accent}" opacity="0.5"/>
      <!-- Player & Enemy -->
      <rect x="65" y="112" width="16" height="18" fill="#00e676"/>
      <circle cx="210" cy="100" r="9" fill="#ff3344"/>
    `;
  } else if (sceneIndex === 2) {
    // Bonus
    artElements = `
      <circle cx="90" cy="110" r="14" fill="#ffd700" opacity="0.8"/>
      <circle cx="160" cy="90" r="14" fill="#ffd700" opacity="0.8"/>
      <circle cx="230" cy="110" r="14" fill="#ffd700" opacity="0.8"/>
      <text x="160" y="155" fill="${theme.accent}" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">BONUS STAGE</text>
    `;
  } else {
    // Boss / Scores
    artElements = `
      <polygon points="130,80 190,80 180,130 140,130" fill="#ff1744" opacity="0.7"/>
      <text x="160" y="160" fill="${theme.accent}" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">${scene.name}</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
  <defs>
    <linearGradient id="crt-bg-${sceneIndex}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#050508;stop-opacity:1" />
    </linearGradient>
    <pattern id="scanlines" width="320" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="320" y2="0" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
    </pattern>
  </defs>

  <!-- CRT Monitor Frame -->
  <rect width="320" height="240" fill="url(#crt-bg-${sceneIndex})"/>
  <rect x="6" y="6" width="308" height="228" rx="8" fill="none" stroke="${theme.border}" stroke-width="2"/>
  
  <!-- Arcade HUD Header -->
  <rect x="8" y="8" width="304" height="24" fill="rgba(0,0,0,0.7)"/>
  <text x="16" y="24" fill="${theme.hud}" font-family="monospace" font-size="10" font-weight="bold">SCORE:${scene.score}</text>
  <text x="170" y="24" fill="${theme.accent}" font-family="monospace" font-size="9" font-weight="bold">STAGE:${scene.stage}</text>
  <text x="304" y="24" fill="#ffffff" font-family="monospace" font-size="8" text-anchor="end">${theme.badge}</text>

  <!-- Scene Elements -->
  ${artElements}

  <!-- CRT Scanlines Overlay -->
  <rect width="320" height="240" fill="url(#scanlines)" pointer-events="none"/>

  <!-- Footer Info Bar -->
  <rect x="8" y="204" width="304" height="26" fill="rgba(0,0,0,0.85)"/>
  <text x="160" y="221" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${safeTitle.slice(0, 24)}</text>
  <text x="16" y="221" fill="rgba(255,255,255,0.5)" font-family="monospace" font-size="8">${safeYear}</text>
  <text x="304" y="221" fill="${theme.accent}" font-family="monospace" font-size="8" text-anchor="end">${safeGenre.slice(0, 10)}</text>
</svg>`;
}

async function run() {
  console.log('Generating authentic retro screenshots for all games in Retrospect...');

  // 1. Create dedicated files for the 10 playable games in public/images/games/
  const playableCards = [
    { file: 'nes-assimilate.png', title: 'Assimilate', consoleSlug: 'dendy-nes', year: 2012, genre: 'Action' },
    { file: 'md-miniplanets.png', title: 'Miniplanets', consoleSlug: 'sega-mega-drive', year: 2016, genre: 'Головоломка' },
    { file: 'md-rickdangerous.png', title: 'Rick Dangerous MD', consoleSlug: 'sega-mega-drive', year: 2018, genre: 'Платформер' },
    { file: 'md-xump2.png', title: 'Xump 2', consoleSlug: 'sega-mega-drive', year: 2017, genre: 'Головоломка' },
    { file: 'snes-jetpilotrising.png', title: 'Jet Pilot Rising', consoleSlug: 'snes', year: 2019, genre: 'Авиасимулятор' },
    { file: 'snes-uwol.png', title: 'Uwol: Quest for Money', consoleSlug: 'snes', year: 2014, genre: 'Платформер' },
    { file: 'sms-galacticrevenge.png', title: 'Galactic Revenge', consoleSlug: 'sega-master-system', year: 2015, genre: 'Аркада' },
    { file: 'sms-sokomaster.png', title: 'SokoMaster', consoleSlug: 'sega-master-system', year: 2013, genre: 'Головоломка' },
    { file: 'atari-winterfortress.png', title: 'Winter Fortress', consoleSlug: 'atari-2600', year: 2015, genre: 'Стратегия' },
    { file: 'pce-pizzaball.png', title: 'Pizza Ball', consoleSlug: 'pc-engine', year: 2018, genre: 'Пинбол' },
  ];

  for (const item of playableCards) {
    const dest = path.join(GAMES_IMG_DIR, item.file);
    const svg = generateSceneSvg(item.title, item.consoleSlug, item.year, item.genre, 0);
    fs.writeFileSync(dest, svg, 'utf8');
    console.log(`-> Created playable screenshot card: ${item.file}`);
  }

  // 2. Connect to MongoDB and update all games that have placeholders
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const Game = mongoose.model('Game', new mongoose.Schema({
    title: String,
    slug: String,
    year: Number,
    genre: String,
    screenshots: [String],
    consoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Console' }
  }));
  const Console = mongoose.model('Console', new mongoose.Schema({ name: String, slug: String }));

  // Update the 10 playable games to point to their dedicated screenshot card
  const updates = [
    { slug: 'dendy-nes-assimilate', shot: '/images/games/nes-assimilate.png' },
    { slug: 'sega-mega-drive-miniplanets', shot: '/images/games/md-miniplanets.png' },
    { slug: 'sega-mega-drive-rick-dangerous-md', shot: '/images/games/md-rickdangerous.png' },
    { slug: 'sega-mega-drive-xump-2', shot: '/images/games/md-xump2.png' },
    { slug: 'snes-jet-pilot-rising', shot: '/images/games/snes-jetpilotrising.png' },
    { slug: 'snes-uwol-quest-for-money-snes', shot: '/images/games/snes-uwol.png' },
    { slug: 'sega-master-system-galactic-revenge', shot: '/images/games/sms-galacticrevenge.png' },
    { slug: 'sega-master-system-sokomaster', shot: '/images/games/sms-sokomaster.png' },
    { slug: 'atari-2600-winter-fortress', shot: '/images/games/atari-winterfortress.png' },
    { slug: 'pc-engine-pizza-ball', shot: '/images/games/pce-pizzaball.png' },
  ];

  for (const u of updates) {
    await Game.updateOne({ slug: u.slug }, { $set: { screenshots: [u.shot] } });
  }

  // 3. Generate screenshots for all games with placeholder
  const allGames = await Game.find({}).populate('consoleId');
  let updatedCount = 0;

  for (const game of allGames) {
    const hasPlaceholder = !game.screenshots || game.screenshots.length === 0 || game.screenshots.some(s => s.includes('placeholder.svg'));
    if (!hasPlaceholder) continue;

    const consoleSlug = game.consoleId?.slug || 'dendy-nes';
    const shots = [];

    // Generate 4 distinct CRT screenshot scenes for each game
    for (let i = 0; i < 4; i++) {
      const filename = `${game.slug}-scene-${i + 1}.svg`;
      const filePath = path.join(SCREENSHOTS_DIR, filename);
      const svgContent = generateSceneSvg(game.title, consoleSlug, game.year, game.genre, i);
      fs.writeFileSync(filePath, svgContent, 'utf8');
      shots.push(`/images/screenshots/${filename}`);
    }

    await Game.updateOne({ _id: game._id }, { $set: { screenshots: shots } });
    updatedCount++;
    if (updatedCount % 50 === 0) {
      console.log(`Updated screenshots for ${updatedCount}/${allGames.length} games...`);
    }
  }

  console.log(`\nSuccessfully updated screenshots for all ${updatedCount} games!`);
  await mongoose.disconnect();
}

run().catch(console.error);
