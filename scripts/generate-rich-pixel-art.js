const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const BASE_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(BASE_DIR, 'public', 'images', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

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

function classifyGenre(rawGenre) {
  const g = (rawGenre || '').toLowerCase();
  if (g.includes('horror') || g.includes('хоррор')) return 'horror';
  if (g.includes('гонк') || g.includes('авто') || g.includes('мото') || g.includes('vehicular') || g.includes('racing')) return 'racing';
  if (g.includes('файтинг') || g.includes('beat') || g.includes('драки') || g.includes('fighting')) return 'fighting';
  if (g.includes('rpg') || g.includes('ролев') || g.includes('dungeon') || g.includes('jrpg')) return 'rpg';
  if (g.includes('fps') || g.includes('стелс') || g.includes('тир') || g.includes('stealth')) return 'stealth';
  if (g.includes('скролл') || g.includes('shoot') || g.includes('космо') || g.includes('shmup')) return 'shmup';
  if (g.includes('головоломка') || g.includes('логическ') || g.includes('пинбол') || g.includes('математич') || g.includes('puzzle')) return 'puzzle';
  if (g.includes('спорт') || g.includes('sport')) return 'sports';
  if (g.includes('стратег') || g.includes('strategy') || g.includes('ферм')) return 'strategy';
  return 'platformer';
}

function generateScene(title, consoleSlug, year, genre, sceneIndex = 0) {
  const safeTitle = escapeXml(title.length > 22 ? title.substring(0, 20) + '..' : title);
  const safeYear = year || '1995';
  const category = classifyGenre(genre);

  let bgDef = '';
  let sceneContent = '';
  let hudContent = '';

  if (category === 'horror') {
    // Survival Horror: Silent Hill / Resident Evil vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="60%" stop-color="#191724"/>
      <stop offset="100%" stop-color="#050508"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Ruined Misty Hall / Street -->
      <polygon points="0,210 110,130 210,130 320,210" fill="#14121d" stroke="#26233a" stroke-width="1.5"/>
      <line x1="160" y1="130" x2="160" y2="210" stroke="#0f0d15" stroke-dasharray="4,4"/>
      <!-- Eerie Fog Clouds -->
      <ellipse cx="160" cy="140" rx="90" ry="25" fill="#44415a" opacity="0.25"/>
      <ellipse cx="90" cy="165" rx="70" ry="20" fill="#44415a" opacity="0.3"/>
      <!-- Flickering Flashlight Cone -->
      <polygon points="75,185 240,110 260,165" fill="#f6c177" opacity="0.2"/>
      <!-- Creature in Shadows -->
      <g transform="translate(195, 125)">
        <ellipse cx="20" cy="18" rx="14" ry="16" fill="#000"/>
        <circle cx="16" cy="14" r="2.5" fill="#eb6f92"/>
        <circle cx="24" cy="14" r="2.5" fill="#eb6f92"/>
        <line x1="8" y1="28" x2="14" y2="48" stroke="#000" stroke-width="3"/>
        <line x1="26" y1="28" x2="30" y2="48" stroke="#000" stroke-width="3"/>
      </g>
      <!-- Hero with flashlight -->
      <g transform="translate(60, 160)">
        <rect x="10" y="0" width="12" height="12" fill="#565f89" rx="2"/>
        <rect x="8" y="12" width="16" height="20" fill="#393b44"/>
        <line x1="24" y1="18" x2="34" y2="16" stroke="#9ccfd8" stroke-width="3"/>
        <circle cx="34" cy="16" r="3" fill="#f6c177"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="22" fill="rgba(0,0,0,0.85)"/>
      <text x="10" y="15" fill="#eb6f92" font-family="'Press Start 2P', monospace" font-size="7">ECG: CAUTION [|||  ]</text>
      <text x="210" y="15" fill="#e0def4" font-family="'Press Start 2P', monospace" font-size="7">AMMO 09/15</text>
    `;
  } else if (category === 'racing') {
    // 3D Perspective Racing: Gran Turismo / Ridge Racer / OutRun vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#ff5555"/>
      <stop offset="45%" stop-color="#f1fa8c"/>
      <stop offset="45%" stop-color="#44475a"/>
      <stop offset="100%" stop-color="#282a36"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Distant Hills -->
      <polygon points="0,110 50,85 110,110 180,80 250,110 320,90 320,110 0,110" fill="#6272a4"/>
      <!-- Perspective Road -->
      <polygon points="120,110 200,110 320,240 0,240" fill="#282a36"/>
      <!-- Road Curbs (Red / White) -->
      <polygon points="116,110 120,110 0,240 -12,240" fill="#ff5555"/>
      <polygon points="200,110 204,110 332,240 320,240" fill="#f8f8f2"/>
      <!-- Center Dashed Line -->
      <polygon points="158,110 162,110 170,240 150,240" fill="#f1fa8c" stroke-dasharray="10,8"/>
      <!-- Player Sports Car (Rear View) -->
      <g transform="translate(130, 168)">
        <!-- Spoiler -->
        <rect x="6" y="0" width="48" height="5" fill="#bd93f9" rx="1"/>
        <rect x="14" y="5" width="4" height="6" fill="#111"/>
        <rect x="42" y="5" width="4" height="6" fill="#111"/>
        <!-- Chassis -->
        <polygon points="8,10 52,10 58,26 2,26" fill="#ff5555"/>
        <rect x="4" y="26" width="52" height="12" fill="#d82020" rx="3"/>
        <!-- Tail Lights -->
        <rect x="8" y="27" width="12" height="5" fill="#ff0000"/>
        <circle cx="14" cy="29" r="2" fill="#ffb86c"/>
        <rect x="40" y="27" width="12" height="5" fill="#ff0000"/>
        <circle cx="46" cy="29" r="2" fill="#ffb86c"/>
        <!-- License Plate -->
        <rect x="25" y="28" width="10" height="6" fill="#fff"/>
        <!-- Wheels -->
        <rect x="2" y="32" width="10" height="12" fill="#111" rx="2"/>
        <rect x="48" y="32" width="10" height="12" fill="#111" rx="2"/>
        <!-- Exhaust flame -->
        <circle cx="12" cy="38" r="3" fill="#50fa7b"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="22" fill="rgba(0,0,0,0.85)"/>
      <text x="10" y="15" fill="#50fa7b" font-family="'Press Start 2P', monospace" font-size="7">POS 1/8</text>
      <text x="110" y="15" fill="#f1fa8c" font-family="'Press Start 2P', monospace" font-size="7">LAP 2/3</text>
      <text x="210" y="15" fill="#ff79c6" font-family="'Press Start 2P', monospace" font-size="7">184 KM/H</text>
    `;
  } else if (category === 'fighting') {
    // 2D Fighting: Tekken / Street Fighter / Mortal Kombat vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="60%" stop-color="#313244"/>
      <stop offset="100%" stop-color="#11111b"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Dojo / Arena Columns -->
      <rect x="15" y="40" width="25" height="150" fill="#45475a" stroke="#181825" stroke-width="2"/>
      <rect x="280" y="40" width="25" height="150" fill="#45475a" stroke="#181825" stroke-width="2"/>
      <line x1="0" y1="185" x2="320" y2="185" stroke="#f38ba8" stroke-width="2"/>
      <rect x="0" y="186" width="320" height="54" fill="#181825"/>
      <!-- Fighter 1 (Hero Stance) -->
      <g transform="translate(85, 120)">
        <rect x="14" y="0" width="12" height="12" fill="#f9e2af" rx="2"/>
        <rect x="10" y="12" width="20" height="24" fill="#89b4fa"/>
        <rect x="6" y="14" width="8" height="16" fill="#f9e2af"/>
        <rect x="10" y="36" width="8" height="26" fill="#1e1e2e"/>
        <rect x="22" y="36" width="8" height="26" fill="#1e1e2e"/>
        <rect x="8" y="60" width="11" height="6" fill="#f38ba8"/>
        <rect x="23" y="60" width="11" height="6" fill="#f38ba8"/>
      </g>
      <!-- Hit Clash Sparks -->
      <g transform="translate(155, 140)">
        <polygon points="0,-12 4,-4 14,-4 6,2 9,12 0,5 -9,12 -6,2 -14,-4 -4,-4" fill="#f9e2af" stroke="#fab387"/>
      </g>
      <!-- Fighter 2 (Opponent Stance) -->
      <g transform="translate(190, 120)">
        <rect x="14" y="0" width="12" height="12" fill="#fab387" rx="2"/>
        <rect x="10" y="12" width="20" height="24" fill="#a6e3a1"/>
        <rect x="26" y="14" width="8" height="16" fill="#fab387"/>
        <rect x="10" y="36" width="8" height="26" fill="#313244"/>
        <rect x="22" y="36" width="8" height="26" fill="#313244"/>
        <rect x="8" y="60" width="11" height="6" fill="#cdd6f4"/>
        <rect x="23" y="60" width="11" height="6" fill="#cdd6f4"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="34" fill="rgba(0,0,0,0.85)"/>
      <!-- Lifebar P1 -->
      <rect x="15" y="8" width="115" height="12" fill="#313244" stroke="#cdd6f4" stroke-width="1.5"/>
      <rect x="25" y="10" width="103" height="8" fill="#a6e3a1"/>
      <text x="15" y="30" fill="#89b4fa" font-family="'Press Start 2P', monospace" font-size="6">PLAYER 1</text>
      <!-- KO -->
      <text x="160" y="20" fill="#f38ba8" font-family="'Press Start 2P', monospace" font-size="10" font-weight="bold" text-anchor="middle">VS</text>
      <!-- Lifebar P2 -->
      <rect x="190" y="8" width="115" height="12" fill="#313244" stroke="#cdd6f4" stroke-width="1.5"/>
      <rect x="192" y="10" width="85" height="8" fill="#f38ba8"/>
      <text x="250" y="30" fill="#a6e3a1" font-family="'Press Start 2P', monospace" font-size="6">CPU</text>
    `;
  } else if (category === 'rpg') {
    // JRPG / Turn-based RPG: Final Fantasy / Chrono Trigger vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#020024"/>
      <stop offset="50%" stop-color="#090979"/>
      <stop offset="100%" stop-color="#1f4068"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Mountain Vista Battle Ground -->
      <polygon points="0,120 70,80 150,120 220,70 320,120 320,160 0,160" fill="#162447"/>
      <rect x="0" y="150" width="320" height="90" fill="#1f4068"/>
      <!-- Monster / Boss (Dragon Wyrm) -->
      <g transform="translate(45, 65)">
        <ellipse cx="40" cy="40" rx="32" ry="24" fill="#e43f5a" stroke="#1b1b2f" stroke-width="2"/>
        <polygon points="70,30 85,18 78,38" fill="#f7b731"/>
        <polygon points="20,18 28,32 12,30" fill="#f7b731"/>
        <circle cx="58" cy="35" r="4" fill="#f7b731"/>
        <circle cx="59" cy="35" r="2" fill="#000"/>
        <!-- Horns & Spikes -->
        <polygon points="35,16 42,4 47,16" fill="#f7b731"/>
      </g>
      <!-- RPG Command Window (Classic Blue Box with White Border) -->
      <g transform="translate(10, 155)">
        <rect x="0" y="0" width="300" height="75" rx="6" fill="#0f3460" stroke="#e43f5a" stroke-width="2"/>
        <rect x="4" y="4" width="292" height="67" rx="4" fill="#162447"/>
        <text x="16" y="24" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="7">▸ ATTACK   MAGIC</text>
        <text x="16" y="42" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="7">  ITEM     DEFEND</text>
        <line x1="150" y1="8" x2="150" y2="66" stroke="#0f3460" stroke-width="1.5"/>
        <text x="160" y="24" fill="#4ecca3" font-family="'Press Start 2P', monospace" font-size="7">HP 385/420</text>
        <text x="160" y="42" fill="#00f0ff" font-family="'Press Start 2P', monospace" font-size="7">MP  94/100</text>
        <text x="160" y="58" fill="#f7b731" font-family="'Press Start 2P', monospace" font-size="6">LV 34 KNIGHT</text>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="20" fill="rgba(0,0,0,0.85)"/>
      <text x="12" y="14" fill="#f7b731" font-family="'Press Start 2P', monospace" font-size="7">${safeTitle}</text>
      <text x="270" y="14" fill="#4ecca3" font-family="'Press Start 2P', monospace" font-size="7">BATTLE</text>
    `;
  } else if (category === 'stealth') {
    // Stealth-Action / Tactical FPS: Metal Gear Solid / GoldenEye 007 vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#051610"/>
      <stop offset="100%" stop-color="#0b2b1f"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Industrial Concrete Facility -->
      <rect x="0" y="30" width="320" height="210" fill="#0e231b"/>
      <line x1="0" y1="180" x2="320" y2="180" stroke="#164d39" stroke-width="2"/>
      <!-- Cargo Crates -->
      <rect x="40" y="130" width="50" height="50" fill="#2d5744" stroke="#16382a" stroke-width="2"/>
      <line x1="40" y1="130" x2="90" y2="180" stroke="#16382a" stroke-width="1.5"/>
      <line x1="40" y1="180" x2="90" y2="130" stroke="#16382a" stroke-width="1.5"/>
      <!-- Laser Tripwire -->
      <line x1="90" y1="155" x2="260" y2="155" stroke="#ff3838" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.8"/>
      <!-- Guard in Distance -->
      <g transform="translate(230, 125)">
        <rect x="6" y="0" width="10" height="10" fill="#e55039" rx="2"/>
        <rect x="4" y="10" width="14" height="22" fill="#4a69bd"/>
        <line x1="2" y1="18" x2="20" y2="18" stroke="#1e272e" stroke-width="2.5"/>
        <rect x="4" y="32" width="6" height="22" fill="#1e272e"/>
        <rect x="12" y="32" width="6" height="22" fill="#1e272e"/>
      </g>
      <!-- Hero In Infiltration Camo -->
      <g transform="translate(110, 138)">
        <rect x="4" y="0" width="12" height="10" fill="#78e08f" rx="2"/>
        <rect x="2" y="10" width="16" height="20" fill="#38ada9"/>
        <line x1="16" y1="16" x2="26" y2="15" stroke="#000" stroke-width="3"/>
        <rect x="4" y="30" width="5" height="18" fill="#1e272e"/>
        <rect x="12" y="30" width="5" height="18" fill="#1e272e"/>
      </g>
      <!-- Radar Screen (Top Right) -->
      <g transform="translate(250, 32)">
        <circle cx="28" cy="28" r="26" fill="rgba(0,30,15,0.75)" stroke="#78e08f" stroke-width="1.5"/>
        <circle cx="28" cy="28" r="16" fill="none" stroke="#78e08f" stroke-dasharray="3,3" opacity="0.6"/>
        <line x1="28" y1="2" x2="28" y2="54" stroke="#78e08f" opacity="0.5"/>
        <line x1="2" y1="28" x2="54" y2="28" stroke="#78e08f" opacity="0.5"/>
        <circle cx="28" cy="28" r="3" fill="#ffffff"/>
        <circle cx="40" cy="18" r="3" fill="#ff3838"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="24" fill="rgba(0,0,0,0.85)"/>
      <text x="12" y="16" fill="#78e08f" font-family="'Press Start 2P', monospace" font-size="7">LIFE [||||||||||  ]</text>
      <text x="175" y="16" fill="#f6b93b" font-family="'Press Start 2P', monospace" font-size="7">SOCOM 12/12</text>
    `;
  } else if (category === 'shmup') {
    // Space Shmup: Gradius / R-Type / Star Fox vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090a0f"/>
      <stop offset="50%" stop-color="#1a1c2e"/>
      <stop offset="100%" stop-color="#080710"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Starfield -->
      <g fill="#ffffff">
        <circle cx="25" cy="45" r="1.5" opacity="0.8"/>
        <circle cx="78" cy="85" r="1" opacity="0.9"/>
        <circle cx="140" cy="50" r="2" opacity="0.7"/>
        <circle cx="195" cy="100" r="1.5" opacity="0.5"/>
        <circle cx="270" cy="65" r="1.8" opacity="0.85"/>
        <circle cx="295" cy="160" r="1" opacity="0.9"/>
        <circle cx="85" cy="190" r="2" opacity="0.6"/>
      </g>
      <!-- Nebula Gas -->
      <ellipse cx="230" cy="120" rx="70" ry="40" fill="#a55eea" opacity="0.25"/>
      <!-- Alien Battle Cruiser (Boss) -->
      <g transform="translate(180, 80)">
        <polygon points="90,30 20,0 35,30 20,60" fill="#eb3b5a" stroke="#2d98da" stroke-width="1.5"/>
        <circle cx="45" cy="30" r="8" fill="#fed330"/>
        <circle cx="45" cy="30" r="4" fill="#fc5c65"/>
        <polygon points="45,10 65,30 45,50" fill="#778ca3"/>
        <line x1="20" y1="30" x2="0" y2="30" stroke="#45aaf2" stroke-width="3" stroke-dasharray="6,4"/>
      </g>
      <!-- Player Starfighter -->
      <g transform="translate(40, 110)">
        <polygon points="40,15 10,5 16,15 10,25" fill="#2bcbba" stroke="#ffffff" stroke-width="1"/>
        <polygon points="20,10 32,15 20,20" fill="#45aaf2"/>
        <line x1="42" y1="12" x2="160" y2="12" stroke="#fed330" stroke-width="2.5"/>
        <line x1="42" y1="18" x2="160" y2="18" stroke="#fed330" stroke-width="2.5"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="22" fill="rgba(0,0,0,0.85)"/>
      <text x="10" y="15" fill="#2bcbba" font-family="'Press Start 2P', monospace" font-size="7">1UP 094820</text>
      <text x="140" y="15" fill="#fed330" font-family="'Press Start 2P', monospace" font-size="7">HIGH 150000</text>
      <text x="260" y="15" fill="#fc5c65" font-family="'Press Start 2P', monospace" font-size="7">BOMB x2</text>
    `;
  } else if (category === 'puzzle') {
    // Puzzle / Falling Blocks: Tetris / Dr Mario / Columns vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#111222"/>
      <stop offset="100%" stop-color="#1e1e38"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Puzzle Board Matrix -->
      <rect x="90" y="30" width="140" height="195" fill="#0d0d18" stroke="#4834d4" stroke-width="2"/>
      <!-- Grid Lines -->
      <g stroke="#1e1e38" stroke-width="1">
        <line x1="104" y1="30" x2="104" y2="225"/>
        <line x1="118" y1="30" x2="118" y2="225"/>
        <line x1="132" y1="30" x2="132" y2="225"/>
        <line x1="146" y1="30" x2="146" y2="225"/>
        <line x1="160" y1="30" x2="160" y2="225"/>
        <line x1="174" y1="30" x2="174" y2="225"/>
        <line x1="188" y1="30" x2="188" y2="225"/>
        <line x1="202" y1="30" x2="202" y2="225"/>
        <line x1="216" y1="30" x2="216" y2="225"/>
      </g>
      <!-- Stacked Colorful Polyomino Blocks -->
      <rect x="90" y="197" width="14" height="14" fill="#eb4d4b" stroke="#000"/>
      <rect x="104" y="197" width="14" height="14" fill="#eb4d4b" stroke="#000"/>
      <rect x="118" y="197" width="14" height="14" fill="#f0932b" stroke="#000"/>
      <rect x="132" y="197" width="14" height="14" fill="#f0932b" stroke="#000"/>
      <rect x="146" y="197" width="14" height="14" fill="#6ab04c" stroke="#000"/>
      <rect x="160" y="197" width="14" height="14" fill="#6ab04c" stroke="#000"/>
      <rect x="174" y="197" width="14" height="14" fill="#22a6b3" stroke="#000"/>
      <rect x="188" y="197" width="14" height="14" fill="#22a6b3" stroke="#000"/>
      <rect x="202" y="197" width="14" height="14" fill="#be2edd" stroke="#000"/>
      <rect x="216" y="197" width="14" height="14" fill="#be2edd" stroke="#000"/>

      <rect x="104" y="183" width="14" height="14" fill="#eb4d4b" stroke="#000"/>
      <rect x="118" y="183" width="14" height="14" fill="#f0932b" stroke="#000"/>
      <rect x="132" y="183" width="14" height="14" fill="#6ab04c" stroke="#000"/>
      <rect x="188" y="183" width="14" height="14" fill="#be2edd" stroke="#000"/>

      <!-- Falling Active Tetromino -->
      <rect x="146" y="90" width="14" height="14" fill="#f9ca24" stroke="#fff" stroke-width="1.5"/>
      <rect x="160" y="90" width="14" height="14" fill="#f9ca24" stroke="#fff" stroke-width="1.5"/>
      <rect x="160" y="76" width="14" height="14" fill="#f9ca24" stroke="#fff" stroke-width="1.5"/>
      <rect x="174" y="76" width="14" height="14" fill="#f9ca24" stroke="#fff" stroke-width="1.5"/>

      <!-- Next Piece Box -->
      <rect x="245" y="40" width="60" height="50" fill="#0d0d18" stroke="#4834d4" stroke-width="1.5"/>
      <text x="252" y="52" fill="#7ed6df" font-family="'Press Start 2P', monospace" font-size="6">NEXT</text>
      <rect x="260" y="62" width="10" height="10" fill="#22a6b3"/>
      <rect x="270" y="62" width="10" height="10" fill="#22a6b3"/>
      <rect x="280" y="62" width="10" height="10" fill="#22a6b3"/>
      <rect x="270" y="72" width="10" height="10" fill="#22a6b3"/>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="22" fill="rgba(0,0,0,0.85)"/>
      <text x="12" y="15" fill="#f9ca24" font-family="'Press Start 2P', monospace" font-size="7">SCORE 074200</text>
      <text x="190" y="15" fill="#7ed6df" font-family="'Press Start 2P', monospace" font-size="7">LINES 048</text>
      <text x="270" y="15" fill="#6ab04c" font-family="'Press Start 2P', monospace" font-size="7">LV 05</text>
    `;
  } else if (category === 'sports') {
    // Sports: FIFA / NBA / NHL vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#218c74"/>
      <stop offset="100%" stop-color="#33d9b2"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Pitch Lines -->
      <circle cx="160" cy="130" r="45" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
      <line x1="0" y1="130" x2="320" y2="130" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
      <!-- Player 1 (Red Striker) -->
      <g transform="translate(130, 110)">
        <circle cx="10" cy="8" r="6" fill="#ff5252"/>
        <rect x="4" y="14" width="12" height="16" fill="#b33939"/>
        <rect x="4" y="30" width="4" height="12" fill="#fff"/>
        <rect x="12" y="30" width="4" height="12" fill="#fff"/>
      </g>
      <!-- Soccer Ball -->
      <circle cx="155" cy="138" r="5" fill="#ffffff" stroke="#222" stroke-width="1.5"/>
      <!-- Player 2 (Blue Defender) -->
      <g transform="translate(180, 115)">
        <circle cx="10" cy="8" r="6" fill="#34ace0"/>
        <rect x="4" y="14" width="12" height="16" fill="#227093"/>
        <rect x="4" y="30" width="4" height="12" fill="#fff"/>
        <rect x="12" y="30" width="4" height="12" fill="#fff"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="24" fill="rgba(0,0,0,0.85)"/>
      <text x="12" y="16" fill="#ff5252" font-family="'Press Start 2P', monospace" font-size="7">RED 2</text>
      <text x="110" y="16" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="7">74:18</text>
      <text x="220" y="16" fill="#34ace0" font-family="'Press Start 2P', monospace" font-size="7">BLUE 1</text>
    `;
  } else if (category === 'strategy') {
    // Strategy / Sim: Civilization / SimCity / Command & Conquer vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#2c3e50"/>
      <stop offset="100%" stop-color="#1a252f"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Isometric Terrain Grid -->
      <polygon points="160,50 250,95 160,140 70,95" fill="#27ae60" stroke="#1e8449" stroke-width="1.5"/>
      <polygon points="250,95 320,130 230,175 160,140" fill="#229954" stroke="#196f3d" stroke-width="1.5"/>
      <polygon points="70,95 160,140 70,185 0,140" fill="#2ecc71" stroke="#27ae60" stroke-width="1.5"/>
      <polygon points="160,140 250,185 160,230 70,185" fill="#3498db" stroke="#2980b9" stroke-width="1.5"/>
      <!-- Castle Fortress -->
      <rect x="145" y="65" width="30" height="30" fill="#95a5a6" stroke="#7f8c8d" stroke-width="1.5"/>
      <polygon points="142,65 160,50 178,65" fill="#e74c3c"/>
      <!-- Unit Banner -->
      <rect x="150" y="40" width="20" height="8" fill="#f1c40f"/>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="22" fill="rgba(0,0,0,0.85)"/>
      <text x="10" y="15" fill="#f1c40f" font-family="'Press Start 2P', monospace" font-size="7">GOLD 1,840</text>
      <text x="135" y="15" fill="#2ecc71" font-family="'Press Start 2P', monospace" font-size="7">FOOD 920</text>
      <text x="240" y="15" fill="#e74c3c" font-family="'Press Start 2P', monospace" font-size="7">ARMY 45</text>
    `;
  } else {
    // Platformer / Action: Super Mario / Sonic / Mega Man vibe
    bgDef = `<linearGradient id="g_${sceneIndex}" x1="0" y1="0" x2="0" y2="100%">
      <stop offset="0%" stop-color="#4a69bd"/>
      <stop offset="65%" stop-color="#82ccdd"/>
      <stop offset="65%" stop-color="#78e08f"/>
      <stop offset="100%" stop-color="#38ada9"/>
    </linearGradient>`;
    sceneContent = `
      <!-- Distant Hills -->
      <polygon points="0,155 45,120 100,155 170,115 240,155 320,120 320,155 0,155" fill="#079992" opacity="0.6"/>
      <!-- Floating Brick Platforms -->
      <g stroke="#000" stroke-width="1.5">
        <rect x="75" y="105" width="22" height="22" fill="#b71540"/>
        <rect x="97" y="105" width="22" height="22" fill="#fa983a"/>
        <text x="108" y="121" font-family="'Press Start 2P', monospace" font-size="11" font-weight="bold" fill="#6a1b9a" text-anchor="middle">?</text>
        <rect x="119" y="105" width="22" height="22" fill="#b71540"/>

        <rect x="210" y="85" width="22" height="22" fill="#fa983a"/>
        <text x="221" y="101" font-family="'Press Start 2P', monospace" font-size="11" font-weight="bold" fill="#6a1b9a" text-anchor="middle">?</text>
      </g>
      <!-- Gold Coins -->
      <ellipse cx="108" cy="80" rx="5" ry="8" fill="#f6b93b" stroke="#e58e26" stroke-width="1.5"/>
      <ellipse cx="221" cy="60" rx="5" ry="8" fill="#f6b93b" stroke="#e58e26" stroke-width="1.5"/>
      <!-- Pipe -->
      <g stroke="#000" stroke-width="1.5">
        <rect x="250" y="130" width="36" height="45" fill="#009432"/>
        <rect x="245" y="120" width="46" height="12" fill="#4cd137"/>
      </g>
      <!-- Hero Character -->
      <g transform="translate(85, 138)">
        <rect x="4" y="0" width="14" height="6" fill="#eb2f06"/>
        <rect x="6" y="6" width="12" height="6" fill="#f8c291"/>
        <rect x="4" y="12" width="14" height="12" fill="#eb2f06"/>
        <rect x="2" y="14" width="4" height="8" fill="#1e3799"/>
        <rect x="5" y="24" width="5" height="10" fill="#1e3799"/>
        <rect x="12" y="24" width="5" height="10" fill="#1e3799"/>
        <rect x="3" y="32" width="7" height="4" fill="#6a2c70"/>
        <rect x="12" y="32" width="7" height="4" fill="#6a2c70"/>
      </g>
    `;
    hudContent = `
      <rect x="0" y="0" width="320" height="22" fill="rgba(0,0,0,0.85)"/>
      <text x="10" y="15" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="7">SCORE 038500</text>
      <text x="145" y="15" fill="#f6b93b" font-family="'Press Start 2P', monospace" font-size="7">🪙x18</text>
      <text x="230" y="15" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="7">STAGE 1-2</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
  <defs>
    ${bgDef}
    <pattern id="scanlines" width="320" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="320" y2="0" stroke="rgba(0,0,0,0.22)" stroke-width="1.2"/>
    </pattern>
  </defs>

  <!-- Background Base -->
  <rect width="320" height="240" fill="url(#g_${sceneIndex})"/>

  <!-- Gameplay Layer -->
  ${sceneContent}

  <!-- CRT Scanlines -->
  <rect width="320" height="240" fill="url(#scanlines)" pointer-events="none"/>

  <!-- HUD -->
  ${hudContent}

  <!-- CRT Bevel Glass Edge -->
  <rect x="2" y="2" width="316" height="236" rx="8" fill="none" stroke="#222" stroke-width="4"/>
  <rect x="4" y="4" width="312" height="232" rx="6" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
</svg>`;
}

async function run() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('retrospect');
  const gamesCol = db.collection('games');

  const games = await gamesCol.find().toArray();
  console.log(`Generating authentic genre pixel-art screenshots for ${games.length} games...`);

  let count = 0;
  for (const game of games) {
    const screens = [];

    // If game has authentic real PNG screenshot(s), KEEP THEM!
    if (game.screenshots && game.screenshots.length > 0) {
      for (const s of game.screenshots) {
        if (s.endsWith('.png') && !s.includes('placeholder')) {
          screens.push(s);
        }
      }
    }

    // Generate 3 genre-specific SVGs for this title
    for (let i = 0; i < 3; i++) {
      const fileName = `${game.slug}-scene-${i + 1}.svg`;
      const filePath = path.join(SCREENSHOTS_DIR, fileName);
      const svg = generateScene(game.title, game.consoleSlug, game.year, game.genre, i);
      fs.writeFileSync(filePath, svg, 'utf8');

      const webPath = `/images/screenshots/${fileName}`;
      if (!screens.includes(webPath)) {
        screens.push(webPath);
      }
    }

    await gamesCol.updateOne({ _id: game._id }, { $set: { screenshots: screens } });
    count++;
  }

  console.log(`Successfully generated genre-specific scenes for ${count} games!`);
  await client.close();
}

run().catch(console.error);
