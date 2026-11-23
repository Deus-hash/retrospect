const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/retrospect').then(async () => {
  const Game = mongoose.model('Game', new mongoose.Schema({}, { strict: false }));
  const placeholderCount = await Game.countDocuments({ screenshots: { $regex: /placeholder/ } });
  console.log('Games with placeholder:', placeholderCount);
  const sample = await Game.find({ screenshots: { $regex: /placeholder/ } }, 'title screenshots isPlayableOnline').limit(10);
  console.log('Sample:', sample);
  process.exit(0);
});
