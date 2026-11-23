const mongoose = require('mongoose');

async function purgeSvgs() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const Game = mongoose.model('Game', new mongoose.Schema({
    title: String,
    slug: String,
    screenshots: [String]
  }));
  const games = await Game.find({});
  let updated = 0;
  for (const g of games) {
    if (g.screenshots && g.screenshots.some(s => s && s.endsWith('.svg'))) {
      g.screenshots = g.screenshots.filter(s => s && !s.endsWith('.svg'));
      await g.save();
      updated++;
    }
  }
  console.log('Successfully purged SVGs from', updated, 'games.');
  
  const allGames = await Game.find({}).lean();
  const remaining = allGames.filter(g => (g.screenshots || []).some(s => s.endsWith('.svg')));
  console.log('Remaining games with SVG in screenshots:', remaining.length);
  await mongoose.disconnect();
}

purgeSvgs().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
