const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const Game = mongoose.model('Game', new mongoose.Schema({}, { strict: false }));
  const Console = mongoose.model('Console', new mongoose.Schema({}, { strict: false }));

  const psConsole = await Console.findOne({ slug: 'playstation' });
  if (!psConsole) throw new Error('PlayStation console not found');

  console.log('--- 1. Setting up Cave Story (PS1) ---');
  let caveStory = await Game.findOne({ slug: 'playstation-cave-story' });
  if (!caveStory) {
    caveStory = new Game({
      title: 'Cave Story (PS1)',
      slug: 'playstation-cave-story',
      consoleId: psConsole._id,
      year: 2025,
      developer: 'Daisuke "Pixel" Amaya / fgsfdsfgs',
      publisher: 'Studio Pixel / Homebrew Community',
      genre: 'Metroidvania',
      description: 'Легендарный платформер и метроидвания Дайсукэ Амаи, портированный на 32-битную Sony PlayStation. Полноценная музыка, плавная анимация в 60 FPS, богатый арсенал оружия, боссы и глубокий сюжет с несколькими концовками.',
      shortDescription: 'Культовая метроидвания с потрясающим сюжетом и 32-битным саундтреком для Sony PlayStation.',
      players: '1',
      rating: 5,
      isPlayableOnline: true,
      isHomebrew: false,
      romFile: '/roms/playstation/cavestory.iso',
      screenshots: [
        '/verify-ps1-cavestory.png',
        '/images/screenshots/playstation-cave-story-scene-1.svg',
        '/images/screenshots/playstation-cave-story-scene-2.svg',
        '/images/screenshots/playstation-cave-story-scene-3.svg'
      ],
      tags: ['Metroidvania', 'Action', 'PlayStation', 'Pixel Art', 'Classic']
    });
    await caveStory.save();
    console.log('Created Cave Story (PS1) in MongoDB!');
  } else {
    caveStory.year = 2025;
    caveStory.isPlayableOnline = true;
    caveStory.romFile = '/roms/playstation/cavestory.iso';
    caveStory.screenshots = [
      '/verify-ps1-cavestory.png',
      '/images/screenshots/playstation-cave-story-scene-1.svg',
      '/images/screenshots/playstation-cave-story-scene-2.svg'
    ];
    await caveStory.save();
    console.log('Updated Cave Story (PS1) in MongoDB!');
  }

  console.log('--- 2. Restoring Takatron 2084 ---');
  await Game.updateOne(
    { slug: 'playstation-takatron-2084' },
    {
      $set: {
        year: 2024,
        isPlayableOnline: true,
        romFile: '/roms/playstation/takatron.exe',
        screenshots: [
          '/images/games/ps1-takatron.png',
          '/images/screenshots/playstation-takatron-2084-scene-1.svg',
          '/images/screenshots/playstation-takatron-2084-scene-2.svg'
        ]
      }
    }
  );
  console.log('Restored Takatron 2084 as playable!');

  console.log('--- 3. Setting Tetrade ---');
  await Game.updateOne(
    { slug: 'playstation-tetrade' },
    {
      $set: {
        year: 2023,
        isPlayableOnline: true,
        romFile: '/roms/playstation/tetrade.cue'
      }
    }
  );
  console.log('Updated Tetrade!');

  console.log('--- 4. Demoting 240p Test Suite ---');
  await Game.updateOne(
    { slug: 'playstation-240p-test-suite' },
    {
      $set: {
        year: 2020,
        isPlayableOnline: false // Do not show as a game, it is a calibration utility
      }
    }
  );
  console.log('Demoted 240p Test Suite so real games are front and center!');

  const allPsGames = await Game.find({ consoleId: psConsole._id, isPlayableOnline: true }).toArray();
  console.log('Playable PS1 games now:');
  allPsGames.forEach(g => console.log(' * ' + g.title + ' (' + g.year + ') - ' + g.romFile));

  process.exit(0);
}

run().catch(console.error);
