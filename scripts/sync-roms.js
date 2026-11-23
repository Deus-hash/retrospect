/**
 * Syncs romFile paths in MongoDB with actual extracted ROM files.
 * Prioritizes US verified good dumps [U] [!] over other variants.
 * Removes bad dumps [b*], translations [T+*], hacks, homebrew from matching.
 *
 * Usage: node scripts/sync-roms.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const Console = require('../src/models/Console');
const Game = require('../src/models/Game');

const ROM_DIRS = {
  'dendy-nes': path.join(__dirname, '..', 'public', 'roms', 'nes'),
  'sega-mega-drive': path.join(__dirname, '..', 'public', 'roms', 'megadrive'),
};

const ROMAN_NUMERALS = { 'ii': '2', 'iii': '3', 'iv': '4', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10' };

function stripMeta(name) {
  return name.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

function sanitize(name) {
  let s = name.toLowerCase();
  s = s.replace(/\s*&\s*/g, 'and');
  s = s.replace(/^the\s+/, '');
  s = s.replace(/,\s*the$/, '');
  for (const [rom, arab] of Object.entries(ROMAN_NUMERALS)) {
    s = s.replace(new RegExp('\\b' + rom + '\\b', 'g'), arab);
  }
  return s.replace(/[^a-z0-9]+/g, '').replace(/\s+/g, '');
}

function regionScore(filename) {
  if (filename.includes('(U)')) return 3;
  if (filename.includes('(E)')) return 2;
  if (filename.includes('(J)')) return 1;
  if (filename.includes('(W)')) return 2;
  if (filename.includes('(UE)')) return 3;
  if (filename.includes('(Unl)')) return 1;
  return 0;
}

function isBadFile(filename) {
  return filename.includes('[b') ||
         filename.includes('[T-') ||
         filename.includes('[T+') ||
         filename.includes('[h') ||
         filename.includes('Hack') ||
         filename.includes('(PD)') ||
         filename.includes('(Beta)') ||
         filename.includes('[p') ||
         filename.includes('[f') ||
         filename.includes('[o');
}

const MANUAL_MAP = {
  'Phantasy Star IV': 'Phantasy Star - The End of the Millenium',
  'NHL Hockey \'94': 'NHL 94',
  'The Revenge of Shinobi': 'Revenge of Shinobi, The',
  'Mega Man': 'Megaman',
  'Mega Man 2': 'Megaman II',
  'Mega Man 3': 'Megaman III',
  'Mega Man 4': 'Megaman IV',
  'Mega Man 5': 'Megaman V',
  'Mega Man 6': 'Megaman VI',
  'The Legend of Zelda': 'Legend of Zelda, The',
  'Zelda II: The Adventure of Link': 'Zelda II - The Adventure of Link',
  'Castlevania II: Simon\'s Quest': 'Castlevania II - Simon\'s Quest',
  'Castlevania III: Dracula\'s Curse': 'Castlevania III - Dracula\'s Curse',
  'Chip \'n Dale Rescue Rangers': 'Chip \'n Dale Rescue Rangers',
  'Teenage Mutant Ninja Turtles': 'Teenage Mutant Ninja Turtles',
  'Ghosts\'n Goblins': 'Ghosts \'n Goblins',
  'Sonic & Knuckles': 'Sonic and Knuckles',
  'Sonic the Hedgehog 2': 'Sonic 2',
  'Battletoads': 'Battletoads (E)',
  'Bubble Bobble': 'Bubble Bobble (E)',
  'Chip \'n Dale Rescue Rangers': 'Chip \'n Dale Rescue Rangers (E)',
  'Donkey Kong': 'Donkey Kong (J) (PRG0)',
  'Dragon Warrior': 'Dragon Warrior (U) (PRG0)',
  'Final Fantasy': 'Final Fantasy (J) (PRG0)',
  'Mega Man': 'Megaman (E)',
  'Startropics': 'Startropics (E)',
  'Super Mario Bros.': 'Super Mario Bros. + Duck Hunt (E)',
  'Teenage Mutant Ninja Turtles': 'Teenage Mutant Ninja Turtles (J)',
  'Tetris': 'Tetris (E)',
  'Wrecking Crew': 'Wrecking Crew (VS)',
};

function hasNumericConflict(title, rom) {
  if (title.length > rom.length && title.startsWith(rom) && /[0-9]/.test(title[rom.length])) return true;
  if (rom.length > title.length && rom.startsWith(title) && /[0-9]/.test(rom[title.length])) return true;
  return false;
}

function findBestRom(title, files) {
  const mappedTitle = MANUAL_MAP[title] || title;
  const titleClean = sanitize(stripMeta(title));
  const altClean = sanitize(stripMeta(mappedTitle));
  const isMapped = MANUAL_MAP[title] !== undefined;

  let candidates = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (ext !== '.nes' && ext !== '.gen' && ext !== '.bin' && ext !== '.md') return false;
    if (isBadFile(f)) return false;
    const fClean = sanitize(stripMeta(path.parse(f).name));
    if (!fClean.includes(titleClean) && !titleClean.includes(fClean) &&
        !fClean.includes(altClean) && !altClean.includes(fClean)) return false;
    if (hasNumericConflict(titleClean, fClean) || hasNumericConflict(altClean, fClean)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const regionDiff = regionScore(b) - regionScore(a);
    if (regionDiff !== 0) return regionDiff;
    if (b.includes('[!]') && !a.includes('[!]')) return 1;
    if (a.includes('[!]') && !b.includes('[!]')) return -1;
    return a.length - b.length;
  });

  var best = candidates[0];
  var bestClean = sanitize(stripMeta(path.parse(best).name));

  var exactMatches = candidates.filter(f => {
    var fClean = sanitize(stripMeta(path.parse(f).name));
    return titleClean === fClean || altClean === fClean;
  });
  if (exactMatches.length > 0) return exactMatches[0];

  if (isMapped) {
    var mappedMatch = candidates.filter(f => {
      var fClean = sanitize(stripMeta(path.parse(f).name));
      return fClean.startsWith(altClean);
    });
    if (mappedMatch.length > 0) return mappedMatch[0];
  }

  var prefixMatches = candidates.filter(f => {
    var fClean = sanitize(stripMeta(path.parse(f).name));
    return fClean.startsWith(titleClean) || fClean.startsWith(altClean);
  });
  if (prefixMatches.length > 0) return prefixMatches[0];

  return candidates[0];
}

async function syncRoms() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  for (const [consoleSlug, romDir] of Object.entries(ROM_DIRS)) {
    if (!fs.existsSync(romDir)) {
      console.log(`ROM dir not found: ${romDir}`);
      continue;
    }

    const files = fs.readdirSync(romDir);
    console.log(`\n${consoleSlug}: ${files.length} files in directory`);

    const games = await Game.find().populate('consoleId').lean();
    const consoleGames = games.filter(g => g.consoleId && g.consoleId.slug === consoleSlug);

    let matched = 0;
    let unmatched = [];

    for (const game of consoleGames) {
      const bestRom = findBestRom(game.title, files);
      if (bestRom) {
        const romPath = `/roms/${consoleSlug === 'dendy-nes' ? 'nes' : 'megadrive'}/${encodeURIComponent(bestRom)}`;
        if (game.romFile !== romPath) {
          await Game.updateOne({ _id: game._id }, { $set: { romFile: romPath } });
        }
        matched++;
      } else {
        unmatched.push(game.title);
      }
    }

    console.log(`  Matched: ${matched}/${consoleGames.length}`);
    if (unmatched.length > 0) {
      console.log(`  Unmatched (${unmatched.length}): ${unmatched.slice(0, 10).join(', ')}${unmatched.length > 10 ? '...' : ''}`);
    }
  }

  console.log('\nSync complete!');
  await mongoose.disconnect();
}

syncRoms().catch(err => { console.error(err); process.exit(1); });
