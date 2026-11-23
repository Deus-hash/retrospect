const mongoose = require('mongoose');
const Game = require('../src/models/Game');
const Console = require('../src/models/Console');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  console.log('Connected to MongoDB.');

  const ps = await Console.findOne({ slug: 'playstation' });
  if (!ps) throw new Error('PlayStation console not found');

  // 1. Create or update PlayStation 3D Adventure Demo
  await Game.findOneAndUpdate(
    { slug: 'playstation-3d-adventure-demo' },
    {
      title: 'PlayStation 3D Adventure Demo',
      slug: 'playstation-3d-adventure-demo',
      consoleId: ps._id,
      year: 2024,
      genre: '3D Экшен / Приключение',
      description: 'Полноценное трехмерное технодемо для Sony PlayStation на движке Meido-Tek GDL и PSn00bSDK. Трехмерный полигональный мир, управляемый 3D-персонаж Клауд, динамические ящики с физикой и текстурированное поле со скоростью 60 FPS на 32-битном ядре.',
      developer: 'Meido-Tek / Lameguy64',
      publisher: 'PSX Homebrew Community',
      rating: 5.0,
      isPlayableOnline: true,
      romFile: '/roms/playstation/demo.cue',
      screenshots: ['/images/screenshots/real/playstation-3d-adventure-demo.png']
    },
    { upsert: true, new: true }
  );
  console.log('[OK] Configured PlayStation 3D Adventure Demo');

  // 2. Cave Story (PS1)
  await Game.findOneAndUpdate(
    { slug: 'playstation-cave-story' },
    {
      title: 'Cave Story (PS1)',
      slug: 'playstation-cave-story',
      consoleId: ps._id,
      year: 2021,
      genre: 'Метроидвания / Платформер',
      description: 'Официальный порт легендарной метроидвании Дайсукэ Амая (Pixel) для Sony PlayStation. Полный саундтрек, оригинальная физика оружия и сюжет в 32-битном исполнении.',
      developer: 'Studio Pixel / PSX Team',
      publisher: 'Tribute Games',
      rating: 4.8,
      isPlayableOnline: true,
      romFile: '/roms/playstation/cavestory.iso',
      screenshots: ['/images/screenshots/real/playstation-cave-story.png']
    },
    { upsert: true, new: true }
  );
  console.log('[OK] Configured Cave Story (PS1)');

  // 3. 240p Test Suite (PS1)
  await Game.findOneAndUpdate(
    { slug: 'playstation-240p-test-suite' },
    {
      title: '240p Test Suite (PS1)',
      slug: 'playstation-240p-test-suite',
      consoleId: ps._id,
      year: 2020,
      genre: 'Утилита / Тест',
      description: 'Калибровочный тест и набор тестовых шаблонов для видеопроцессоров, кинескопов и апскейлеров Sony PlayStation.',
      developer: 'Filip Alac',
      publisher: 'Open Source',
      rating: 4.5,
      isPlayableOnline: true,
      romFile: '/roms/playstation/240pTestSuitePS1-EMU.cue',
      screenshots: ['/images/screenshots/real/playstation-240p-test-suite.png']
    },
    { upsert: true, new: true }
  );
  console.log('[OK] Configured 240p Test Suite (PS1)');

  // 4. Demote broken games
  await Game.updateMany(
    { slug: { $in: ['playstation-takatron-2084', 'playstation-tetrade'] } },
    { $set: { isPlayableOnline: false } }
  );
  console.log('[OK] Demoted broken Takatron and Tetrade');

  // Verify all playable PS1 games
  const playablePS = await Game.find({ consoleId: ps._id, isPlayableOnline: true });
  console.log('\nPlayable PS1 games in database:');
  for (const g of playablePS) {
    console.log(`- ${g.title} | ${g.slug} | ${g.romFile} | ${g.screenshots[0]}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
