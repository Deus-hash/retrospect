const fs = require('fs');

let content = fs.readFileSync('src/seeds/games.seed.js', 'utf8');
const updates = [
  { title: 'Jet Pilot Rising', img: '/images/screenshots/snes-jetpilotrising.png' },
  { title: 'Uwol: Quest for Money (SNES)', img: '/images/screenshots/snes-uwol.png' },
  { title: 'Galactic Revenge', img: '/images/screenshots/sms-galacticrevenge.png' },
  { title: 'SokoMaster', img: '/images/screenshots/sms-sokomaster.png' },
  { title: 'Winter Fortress', img: '/images/screenshots/atari-winterfortress.png' },
  { title: 'Pizza Ball', img: '/images/screenshots/pce-pizzaball.png' }
];

for (const u of updates) {
  const p = content.indexOf(u.title);
  if (p !== -1) {
    const end = content.indexOf('},', p);
    let block = content.substring(p, end);
    block = block.replace(/screenshots:\s*\[.*?\]/, `screenshots: ['${u.img}']`);
    content = content.substring(0, p) + block + content.substring(end);
  }
}

fs.writeFileSync('src/seeds/games.seed.js', content, 'utf8');
console.log('Successfully updated seed screenshots.');
