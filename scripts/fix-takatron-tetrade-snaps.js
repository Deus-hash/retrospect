const https = require('https');
const fs = require('fs');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');

function dl(url, dest) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 200) {
        res.pipe(fs.createWriteStream(dest)).on('finish', resolve);
      } else resolve();
    }).on('error', () => resolve());
  });
}

async function fix() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  await dl('https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Snaps/' + encodeURIComponent('Next Tetris, The (USA).png'), 'public/images/screenshots/real/playstation-tetrade.png');
  await dl('https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Snaps/' + encodeURIComponent('Robotron X (USA).png'), 'public/images/screenshots/real/playstation-takatron-2084.png');
  await Game.updateOne({ slug: 'playstation-tetrade' }, { $set: { screenshots: ['/images/screenshots/real/playstation-tetrade.png'] } });
  await Game.updateOne({ slug: 'playstation-takatron-2084' }, { $set: { screenshots: ['/images/screenshots/real/playstation-takatron-2084.png'] } });
  console.log('Fixed Takatron and Tetrade screenshots!');
  await mongoose.disconnect();
}
fix().catch(console.error);
