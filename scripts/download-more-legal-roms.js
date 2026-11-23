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

const romDownloads = [
  // NES
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/cheril-the-goddess.nes', dest: 'nes/cheril-the-goddess.nes', img: 'nes-cheril-the-goddess.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/sir-ababol-remastered.nes', dest: 'nes/sir-ababol-remastered.nes', img: 'nes-sir-ababol-remastered.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/sgthelmet.nes', dest: 'nes/sgthelmet.nes', img: 'nes-sgthelmet.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/superpakpak.nes', dest: 'nes/superpakpak.nes', img: 'nes-superpakpak.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/superuwol.nes', dest: 'nes/superuwol.nes', img: 'nes-superuwol.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/ninjamuncher.nes', dest: 'nes/ninjamuncher.nes', img: 'nes-ninjamuncher.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/lala.nes', dest: 'nes/lala.nes', img: 'nes-lala.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/kyff.nes', dest: 'nes/kyff.nes', img: 'nes-kyff.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/themadwizard.nes', dest: 'nes/themadwizard.nes', img: 'nes-themadwizard.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/starevil.nes', dest: 'nes/starevil.nes', img: 'nes-starevil.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/theinvasion.nes', dest: 'nes/theinvasion.nes', img: 'nes-theinvasion.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/twindragons.nes', dest: 'nes/twindragons.nes', img: 'nes-twindragons.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/yun.nes', dest: 'nes/yun.nes', img: 'nes-yun.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/roboninjaclimb.nes', dest: 'nes/roboninjaclimb.nes', img: 'nes-roboninjaclimb.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/nes-games/master/robotfindskitten.nes', dest: 'nes/robotfindskitten.nes', img: 'nes-robotfindskitten.png' },

  // Mega Drive / Genesis
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/bombx.bin', dest: 'megadrive/bombx.bin', img: 'md-bombx.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/asciiwar.bin', dest: 'megadrive/asciiwar.bin', img: 'md-asciiwar.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/bareknuckleprincesss.bin', dest: 'megadrive/bareknuckleprincesss.bin', img: 'md-bareknuckleprincesss.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/downforce.bin', dest: 'megadrive/downforce.bin', img: 'md-downforce.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/dragonscastle.bin', dest: 'megadrive/dragonscastle.bin', img: 'md-dragonscastle.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/goldrush.bin', dest: 'megadrive/goldrush.bin', img: 'md-goldrush.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/grielsquest.bin', dest: 'megadrive/grielsquest.bin', img: 'md-grielsquest.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/mega-cheril-perils.bin', dest: 'megadrive/mega-cheril-perils.bin', img: 'md-mega-cheril-perils.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/ohmummy.bin', dest: 'megadrive/ohmummy.bin', img: 'md-ohmummy.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/radrhino.bin', dest: 'megadrive/radrhino.bin', img: 'md-radrhino.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/starchaser.bin', dest: 'megadrive/starchaser.bin', img: 'md-starchaser.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/twocyclops.bin', dest: 'megadrive/twocyclops.bin', img: 'md-twocyclops.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/ultimatetetris.bin', dest: 'megadrive/ultimatetetris.bin', img: 'md-ultimatetetris.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/md-games/master/breakanegg.bin', dest: 'megadrive/breakanegg.bin', img: 'md-breakanegg.png' },

  // SNES
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/blt.sfc', dest: 'snes/blt.sfc', img: 'snes-blt.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/bucket.smc', dest: 'snes/bucket.smc', img: 'snes-bucket.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/furryrpg.sfc', dest: 'snes/furryrpg.sfc', img: 'snes-furryrpg.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/hilda.sfc', dest: 'snes/hilda.sfc', img: 'snes-hilda.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/horizontal-shooter.sfc', dest: 'snes/horizontal-shooter.sfc', img: 'snes-horizontal-shooter.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/megafamilybros.smc', dest: 'snes/megafamilybros.smc', img: 'snes-megafamilybros.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/rockfall.smc', dest: 'snes/rockfall.smc', img: 'snes-rockfall.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/saf.smc', dest: 'snes/saf.smc', img: 'snes-saf.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/snes-games/master/tchouv2.smc', dest: 'snes/tchouv2.smc', img: 'snes-tchouv2.png' },

  // Sega Master System
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/3dcity.sms', dest: 'mastersystem/3dcity.sms', img: 'sms-3dcity.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/acidreflux.sms', dest: 'mastersystem/acidreflux.sms', img: 'sms-acidreflux.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/balubabalok.sms', dest: 'mastersystem/balubabalok.sms', img: 'sms-balubabalok.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/baraburu.sms', dest: 'mastersystem/baraburu.sms', img: 'sms-baraburu.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/baythirddungeon.sms', dest: 'mastersystem/baythirddungeon.sms', img: 'sms-baythirddungeon.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/blockquest.sms', dest: 'mastersystem/blockquest.sms', img: 'sms-blockquest.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/breadandbutter.sms', dest: 'mastersystem/breadandbutter.sms', img: 'sms-breadandbutter.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/diggerchan.sms', dest: 'mastersystem/diggerchan.sms', img: 'sms-diggerchan.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/gotris.sms', dest: 'mastersystem/gotris.sms', img: 'sms-gotris.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/nanowars8k.sms', dest: 'mastersystem/nanowars8k.sms', img: 'sms-nanowars8k.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/picross.sms', dest: 'mastersystem/picross.sms', img: 'sms-picross.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/pongmaster.sms', dest: 'mastersystem/pongmaster.sms', img: 'sms-pongmaster.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/spacehawks.sms', dest: 'mastersystem/spacehawks.sms', img: 'sms-spacehawks.png' },
  { url: 'https://raw.githubusercontent.com/retrobrews/sms-games/master/waimanu.sms', dest: 'mastersystem/waimanu.sms', img: 'sms-waimanu.png' },
];

async function run() {
  console.log(`Starting download of ${romDownloads.length} additional legal games...`);
  let okCount = 0;

  for (const item of romDownloads) {
    const fullRomPath = path.join(ROMS_DIR, item.dest);
    const romDir = path.dirname(fullRomPath);
    if (!fs.existsSync(romDir)) fs.mkdirSync(romDir, { recursive: true });

    try {
      await downloadFile(item.url, fullRomPath);
      const size = fs.statSync(fullRomPath).size;
      console.log(`[ROM OK] ${item.dest} (${size} bytes)`);
      okCount++;

      // Try downloading matching screenshot
      if (item.img) {
        const imgUrl = item.url.replace(/\.(nes|bin|sfc|smc|sms)$/, '.png');
        const fullImgPath = path.join(IMGS_DIR, item.img);
        try {
          await downloadFile(imgUrl, fullImgPath);
          console.log(`  [IMG OK] ${item.img}`);
        } catch {
          // screenshot optional
        }
      }
    } catch (err) {
      console.warn(`[ROM SKIP] ${item.dest}: ${err.message}`);
    }
  }

  console.log(`\nCompleted: ${okCount} of ${romDownloads.length} downloaded successfully.`);
}

run().catch(console.error);
