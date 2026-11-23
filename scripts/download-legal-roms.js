const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const BASE_DIR = path.resolve(__dirname, '..');
const ROMS_DIR = path.join(BASE_DIR, 'public', 'roms');

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get = url.startsWith('https') ? https.get : http.get;
    
    function makeReq(currentUrl) {
      get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return makeReq(response.headers.location);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`HTTP ${response.statusCode} for ${currentUrl}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    makeReq(url);
  });
}

const downloads = [
  // NES
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/super-tilt-bro.nes', dest: 'nes/super-tilt-bro.nes' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/novathesquirrel.nes', dest: 'nes/novathesquirrel.nes' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/driar.nes', dest: 'nes/driar.nes' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/thwaite.nes', dest: 'nes/thwaite.nes' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/flappybird.nes', dest: 'nes/flappybird.nes' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/assimilate.nes', dest: 'nes/assimilate.nes' },

  // Mega Drive / Genesis
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/oldtowers.bin', dest: 'megadrive/oldtowers.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/cavestory.bin', dest: 'megadrive/cavestory.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/projectmd.bin', dest: 'megadrive/projectmd.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/miniplanets.bin', dest: 'megadrive/miniplanets.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/rickdangerous.bin', dest: 'megadrive/rickdangerous.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/xump2.bin', dest: 'megadrive/xump2.bin' },

  // SNES
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/nwarpdaisakusen.smc', dest: 'snes/nwarpdaisakusen.smc' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/superbossgaiden.sfc', dest: 'snes/superbossgaiden.sfc' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/jetpilotrising.sfc', dest: 'snes/jetpilotrising.sfc' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/questformoney.sfc', dest: 'snes/questformoney.sfc' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/astrohawk.smc', dest: 'snes/astrohawk.smc' },

  // Sega Master System
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/astroforce.sms', dest: 'mastersystem/astroforce.sms' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/silvervalley.sms', dest: 'mastersystem/silvervalley.sms' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/2048sanqui.sms', dest: 'mastersystem/2048sanqui.sms' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/galacticrevenge.sms', dest: 'mastersystem/galacticrevenge.sms' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/sokomaster.sms', dest: 'mastersystem/sokomaster.sms' },

  // Atari 2600
  { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/anguna.bin', dest: 'atari2600/anguna.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/bitquest.bin', dest: 'atari2600/bitquest.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/turtlebay.bin', dest: 'atari2600/turtlebay.bin' },
  { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/winterfortress.bin', dest: 'atari2600/winterfortress.bin' },
];

async function main() {
  console.log('Downloading legal homebrew ROMs...');
  for (const item of downloads) {
    const fullPath = path.join(ROMS_DIR, item.dest);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
      await downloadFile(item.url, fullPath);
      const size = fs.statSync(fullPath).size;
      console.log(`[OK] ${item.dest} (${size} bytes)`);
    } catch (err) {
      console.error(`[FAIL] ${item.dest}:`, err.message);
    }
  }

  // Also download screenshots for these games to make the cards look awesome!
  const screenshotDownloads = [
    { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/super-tilt-bro.png', dest: 'public/images/games/nes-super-tilt-bro.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/novathesquirrel.png', dest: 'public/images/games/nes-novathesquirrel.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/driar.png', dest: 'public/images/games/nes-driar.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/flappybird.png', dest: 'public/images/games/nes-flappybird.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/thwaite.png', dest: 'public/images/games/nes-thwaite.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/oldtowers.png', dest: 'public/images/games/md-oldtowers.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/cavestory.png', dest: 'public/images/games/md-cavestory.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/projectmd.png', dest: 'public/images/games/md-projectmd.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/nwarpdaisakusen.png', dest: 'public/images/games/snes-nwarpdaisakusen.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/superbossgaiden.png', dest: 'public/images/games/snes-superbossgaiden.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/astrohawk.png', dest: 'public/images/games/snes-astrohawk.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/astroforce.png', dest: 'public/images/games/sms-astroforce.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/silvervalley.png', dest: 'public/images/games/sms-silvervalley.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/2048sanqui.png', dest: 'public/images/games/sms-2048sanqui.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/anguna.png', dest: 'public/images/games/atari-anguna.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/bitquest.png', dest: 'public/images/games/atari-bitquest.png' },
    { url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/turtlebay.png', dest: 'public/images/games/atari-turtlebay.png' },
  ];

  for (const item of screenshotDownloads) {
    const fullPath = path.join(BASE_DIR, item.dest);
    try {
      await downloadFile(item.url, fullPath);
      console.log(`[IMG OK] ${item.dest}`);
    } catch (e) {
      console.warn(`[IMG SKIP] ${item.dest}`);
    }
  }
}

main().catch(console.error);
