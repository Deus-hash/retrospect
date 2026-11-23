const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');

async function audit() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  const games = await Game.find({}).lean();
  console.log('Total games in database:', games.length);

  let missingScreenshots = 0;
  let svgScreenshots = 0;
  let placeholderScreenshots = 0;
  let fileNotFound = 0;

  for (const g of games) {
    if (!g.screenshots || g.screenshots.length === 0) {
      console.log(`[NO SCREENSHOT] ${g.slug}`);
      missingScreenshots++;
      continue;
    }

    for (const s of g.screenshots) {
      if (s.endsWith('.svg')) {
        console.log(`[SVG] ${g.slug}: ${s}`);
        svgScreenshots++;
      }
      if (s.startsWith('/images/games/')) {
        console.log(`[PLACEHOLDER /images/games/] ${g.slug}: ${s}`);
        placeholderScreenshots++;
      }
      const localPath = path.join(__dirname, '..', 'public', s.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) {
        console.log(`[FILE MISSING] ${g.slug}: ${localPath}`);
        fileNotFound++;
      } else {
        const size = fs.statSync(localPath).size;
        if (size < 500) {
          console.log(`[FILE TOO SMALL (${size}b)] ${g.slug}: ${localPath}`);
          fileNotFound++;
        }
      }
    }
  }

  console.log('\n================ AUDIT SUMMARY ================');
  console.log('Total games:', games.length);
  console.log('Missing screenshots:', missingScreenshots);
  console.log('SVG screenshots:', svgScreenshots);
  console.log('Placeholder (/images/games/) screenshots:', placeholderScreenshots);
  console.log('Files missing or invalid on disk:', fileNotFound);
  console.log('Games 100% verified authentic and on disk:', games.length - missingScreenshots - svgScreenshots - placeholderScreenshots - fileNotFound);
  console.log('================================================\n');

  await mongoose.disconnect();
}

audit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
