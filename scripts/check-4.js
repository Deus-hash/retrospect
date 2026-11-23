const mongoose = require('mongoose');
const Game = require('../src/models/Game');

async function check4() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const slugs = ['pc-engine-pizza-ball', 'nintendo-64-pong-64', 'pc-engine-conway-s-game-of-life-pce', 'pc-engine-starwave-pce'];
  const games = await Game.find({ slug: { $in: slugs } }).lean();
  games.forEach(g => console.log(g.slug, '| romFile:', g.romFile, '| romPath:', g.romPath, '| playable:', g.isPlayableOnline));
  await mongoose.disconnect();
}
check4().then(() => process.exit(0));
