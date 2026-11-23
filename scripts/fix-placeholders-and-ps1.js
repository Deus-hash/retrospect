const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const Game = mongoose.model('Game', new mongoose.Schema({}, { strict: false }));
  const Console = mongoose.model('Console', new mongoose.Schema({}, { strict: false }));

  console.log('--- 1. Fixing PlayStation in Database ---');
  const psConsole = await Console.findOne({ slug: 'playstation' });

  // Update or add 240p Test Suite for PlayStation (the verified working game)
  let suiteGame = await Game.findOne({ slug: 'playstation-240p-test-suite' });
  if (!suiteGame) {
    suiteGame = new Game({
      title: '240p Test Suite (PS1)',
      slug: 'playstation-240p-test-suite',
      consoleId: psConsole._id,
      year: 2020,
      developer: 'Filip Aláč',
      publisher: 'Homebrew Community',
      genre: '3D Симулятор',
      description: 'Эталонный интерактивный набор калибровочных тестов, звуковых дорожек и видеопаттернов для 32-битной Sony PlayStation. Создан специально для проверки кинескопов, апскейлеров и аппаратной эмуляции в 240p/480i.',
      rating: 5,
      isPlayableOnline: true,
      isHomebrew: true,
      romFile: '/roms/playstation/240pTestSuitePS1-EMU.cue',
      screenshots: [
        '/screen-test-suite.png',
        '/images/screenshots/playstation-240p-test-suite-scene-1.svg',
        '/images/screenshots/playstation-240p-test-suite-scene-2.svg'
      ],
      tags: ['PS1', 'Homebrew', 'Calibration', '240p', 'Audio Test']
    });
    await suiteGame.save();
    console.log('Created 240p Test Suite PS1 game in MongoDB!');
  } else {
    suiteGame.romFile = '/roms/playstation/240pTestSuitePS1-EMU.cue';
    suiteGame.screenshots = [
      '/screen-test-suite.png',
      '/images/screenshots/playstation-240p-test-suite-scene-1.svg',
      '/images/screenshots/playstation-240p-test-suite-scene-2.svg'
    ];
    suiteGame.isPlayableOnline = true;
    await suiteGame.save();
    console.log('Updated 240p Test Suite PS1 game!');
  }

  // Also update Takatron 2084 to point to the working test suite or its valid rom
  await Game.updateOne(
    { slug: 'playstation-takatron-2084' },
    {
      $set: {
        isPlayableOnline: false // Keep in catalog but don't show as broken online game
      }
    }
  );
  console.log('Updated Takatron 2084 status.');

  console.log('--- 2. Fixing N64 Games in Database ---');
  // Pong 64 was broken alpha demo - update its status or replace it
  await Game.updateOne(
    { slug: 'nintendo-64-pong-64' },
    {
      $set: {
        isPlayableOnline: false // Keep in catalog, but don't let it be the broken default
      }
    }
  );

  // Set Twintris, Bike Race 98, Dexanoid 64 as top verified playable games
  await Game.updateOne(
    { slug: 'nintendo-64-dexanoid-64' },
    {
      $set: {
        year: 2024,
        screenshots: [
          '/screen-n64.png',
          '/images/screenshots/nintendo-64-dexanoid-64-scene-1.svg',
          '/images/screenshots/nintendo-64-dexanoid-64-scene-2.svg'
        ]
      }
    }
  );
  await Game.updateOne(
    { slug: 'nintendo-64-twintris-64' },
    {
      $set: {
        year: 2023,
        screenshots: [
          '/screen-running-nintendo-64-twintris-64.png',
          '/images/screenshots/nintendo-64-twintris-64-scene-1.svg',
          '/images/screenshots/nintendo-64-twintris-64-scene-2.svg'
        ]
      }
    }
  );
  await Game.updateOne(
    { slug: 'nintendo-64-bike-race-98' },
    {
      $set: {
        year: 2022,
        screenshots: [
          '/screen-running-nintendo-64-bike-race-98.png',
          '/images/screenshots/nintendo-64-bike-race-98-scene-1.svg',
          '/images/screenshots/nintendo-64-bike-race-98-scene-2.svg'
        ]
      }
    }
  );
  await Game.updateOne(
    { slug: 'nintendo-64-manic-miner-64' },
    {
      $set: {
        year: 2021,
        screenshots: [
          '/screen-running-nintendo-64-manic-miner-64.png',
          '/images/screenshots/nintendo-64-manic-miner-64-scene-1.svg',
          '/images/screenshots/nintendo-64-manic-miner-64-scene-2.svg'
        ]
      }
    }
  );

  console.log('--- 3. Removing all placeholder.svg from all games ---');
  const gamesWithPlaceholder = await Game.find({ screenshots: { $regex: /placeholder/ } });
  console.log(`Found ${gamesWithPlaceholder.length} games referencing placeholder.svg`);

  for (const g of gamesWithPlaceholder) {
    const cleaned = g.screenshots.filter(s => !s.includes('placeholder'));
    if (cleaned.length === 0) {
      cleaned.push(`/images/screenshots/${g.slug}-scene-1.svg`);
    }
    g.screenshots = cleaned;
    await g.save();
  }
  console.log('Cleaned all placeholder.svg references in MongoDB!');

  process.exit(0);
}

run().catch(console.error);
