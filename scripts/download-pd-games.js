const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_DIR = path.resolve(__dirname, '..');
const ROMS_DIR = path.join(BASE_DIR, 'public', 'roms');
const IMGS_DIR = path.join(BASE_DIR, 'public', 'images', 'games');

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

const pdDownloads = [
  // --- Nintendo 64 (Public Domain Games) ---
  {
    url: 'https://raw.githubusercontent.com/DerekTurtleRoe/N64-PD-ROMS/master/ROMS/Homebrew/Twintris%20by%20Twinsen%20(POM%20\'98)%20(PD).z64',
    dest: 'n64/twintris.z64',
    img: 'n64-twintris.png'
  },
  {
    url: 'https://raw.githubusercontent.com/DerekTurtleRoe/N64-PD-ROMS/master/ROMS/Homebrew/Bike%20Race%20\'98%20V1.2%20by%20NAN%20(PD).z64',
    dest: 'n64/bikerace.z64',
    img: 'n64-bikerace.png'
  },
  {
    url: 'https://raw.githubusercontent.com/DerekTurtleRoe/N64-PD-ROMS/master/ROMS/Homebrew/Pong%20V0.01%20by%20Omsk%20(PD).z64',
    dest: 'n64/pong64.z64',
    img: 'n64-pong64.png'
  },
  {
    url: 'https://raw.githubusercontent.com/DerekTurtleRoe/N64-PD-ROMS/master/ROMS/Homebrew/Manic%20Miner%20by%20RedboX%20(PD).z64',
    dest: 'n64/manicminer64.z64',
    img: 'n64-manicminer64.png'
  },
  {
    url: 'https://raw.githubusercontent.com/DerekTurtleRoe/N64-PD-ROMS/master/ROMS/Homebrew/Dexanoid%20R1%20by%20Protest%20Design%20(PD).z64',
    dest: 'n64/dexanoid.z64',
    img: 'n64-dexanoid.png'
  },

  // --- PlayStation (PS1 - Open Source / Public Domain) ---
  {
    url: 'https://raw.githubusercontent.com/tursilion/psxcompilation/main/Takatron/takatron.psx',
    dest: 'playstation/takatron.psx',
    img: 'ps1-takatron.png'
  },

  // --- Atari 2600 (Public Domain / Free Author Releases) ---
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/halo2600.bin',
    dest: 'atari2600/halo2600.bin',
    img: 'atari-halo2600.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/flappy_the_duck.bin',
    dest: 'atari2600/flappy_the_duck.bin',
    img: 'atari-flappyduck.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/nanowing.bin',
    dest: 'atari2600/nanowing.bin',
    img: 'atari-nanowing.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/hauntedbakery.bin',
    dest: 'atari2600/hauntedbakery.bin',
    img: 'atari-hauntedbakery.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/sandcastles.bin',
    dest: 'atari2600/sandcastles.bin',
    img: 'atari-sandcastles.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/stardust.bin',
    dest: 'atari2600/stardust.bin',
    img: 'atari-stardust.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/threes.bin',
    dest: 'atari2600/threes.bin',
    img: 'atari-threes.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/thrust.bin',
    dest: 'atari2600/thrust.bin',
    img: 'atari-thrust.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/pothole.bin',
    dest: 'atari2600/pothole.bin',
    img: 'atari-pothole.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/atari2600-games/master/dkarcade2600.bin',
    dest: 'atari2600/dkarcade2600.bin',
    img: 'atari-dkarcade2600.png'
  },

  // --- Dendy / NES (Public Domain & Classic Port Games) ---
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/invaders.nes',
    dest: 'nes/invaders.nes',
    img: 'nes-invaders.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/pong1k.nes',
    dest: 'nes/pong1k.nes',
    img: 'nes-pong1k.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/pong1k2p.nes',
    dest: 'nes/pong1k2p.nes',
    img: 'nes-pong1k2p.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/snailmaze.nes',
    dest: 'nes/snailmaze.nes',
    img: 'nes-snailmaze.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/mineshaft.nes',
    dest: 'nes/mineshaft.nes',
    img: 'nes-mineshaft.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/blaster.nes',
    dest: 'nes/blaster.nes',
    img: 'nes-blaster.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/pegs.nes',
    dest: 'nes/pegs.nes',
    img: 'nes-pegs.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/memory.nes',
    dest: 'nes/memory.nes',
    img: 'nes-memory.png'
  },

  // --- Sega Mega Drive (Public Domain & Open Source Classic Ports) ---
  {
    url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/rickdangerous2.bin',
    dest: 'megadrive/rickdangerous2.bin',
    img: 'md-rickdangerous2.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/barbarian.bin',
    dest: 'megadrive/barbarian.bin',
    img: 'md-barbarian.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/crazycars.bin',
    dest: 'megadrive/crazycars.bin',
    img: 'md-crazycars.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/pongram.bin',
    dest: 'megadrive/pongram.bin',
    img: 'md-pongram.png'
  },

  // --- Sega Master System (Public Domain & Historic Open Ports) ---
  {
    url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/colossalcaveadventure.sms',
    dest: 'mastersystem/colossalcaveadventure.sms',
    img: 'sms-colossalcave.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/battleships.sms',
    dest: 'mastersystem/battleships.sms',
    img: 'sms-battleships.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/burgersofhanoi.sms',
    dest: 'mastersystem/burgersofhanoi.sms',
    img: 'sms-burgersofhanoi.png'
  },
  {
    url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/cix.sms',
    dest: 'mastersystem/cix.sms',
    img: 'sms-cix.png'
  },

  // --- PC Engine / TurboGrafx-16 (Public Domain Games) ---
  {
    url: 'https://raw.githubusercontent.com/langel/pce-dev-kit/master/demo%20projects/GAMELIFE/GAMELIFE.PCE',
    dest: 'pcengine/gamelife.pce',
    img: 'pce-gamelife.png'
  },
  {
    url: 'https://raw.githubusercontent.com/langel/pce-dev-kit/master/demo%20projects/STARWAVE/DEMO.PCE',
    dest: 'pcengine/starwave.pce',
    img: 'pce-starwave.png'
  }
];

function createFallbackImage(filePath, title, color = '#7c4dff') {
  const p1 = (title || 'GAME').slice(0, 14);
  const p2 = (title || 'GAME').slice(14, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
  <rect width="320" height="240" fill="#12121c"/>
  <rect x="8" y="8" width="304" height="224" fill="none" stroke="${color}" stroke-width="2"/>
  <circle cx="160" cy="100" r="45" fill="${color}" opacity="0.2"/>
  <text x="160" y="105" fill="${color}" font-family="monospace" font-size="28" font-weight="bold" text-anchor="middle">★ RETRO ★</text>
  <text x="160" y="165" fill="#ffffff" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">${p1}</text>
  ${p2 ? `<text x="160" y="185" fill="#00f0ff" font-family="monospace" font-size="12" text-anchor="middle">${p2}</text>` : ''}
</svg>`;
  fs.writeFileSync(filePath, svg, 'utf8');
}

async function run() {
  console.log(`Checking & downloading ${pdDownloads.length} Public Domain & Non-Copyright Games across all platforms...`);
  let ok = 0;

  for (const item of pdDownloads) {
    const fullRomPath = path.join(ROMS_DIR, item.dest);
    const dir = path.dirname(fullRomPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(fullRomPath) && fs.statSync(fullRomPath).size > 100) {
      console.log(`-> Already exists: ${item.dest} (${fs.statSync(fullRomPath).size} bytes)`);
      ok++;
    } else {
      try {
        console.log(`Downloading ROM: ${item.dest}...`);
        await downloadFile(item.url, fullRomPath);
        console.log(`-> Saved: ${item.dest} (${fs.statSync(fullRomPath).size} bytes)`);
        ok++;
      } catch (err) {
        console.error(`Failed to download ${item.url}:`, err.message);
      }
    }

    const fullImgPath = path.join(IMGS_DIR, item.img);
    if (!fs.existsSync(fullImgPath)) {
      const title = path.basename(item.dest, path.extname(item.dest)).toUpperCase();
      createFallbackImage(fullImgPath, title, '#00f0ff');
      console.log(`-> Created screenshot card: ${item.img}`);
    }
  }

  console.log(`\nSuccessfully processed ${ok} of ${pdDownloads.length} games.`);
}

run().catch(console.error);
