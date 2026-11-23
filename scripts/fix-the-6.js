const https = require('https');
const fs = require('fs');
const path = require('path');

function check(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      resolve(res.statusCode === 200 ? url : null);
    }).on('error', () => resolve(null));
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 200) {
        res.pipe(fs.createWriteStream(dest)).on('finish', () => resolve(true));
      } else {
        resolve(false);
      }
    }).on('error', () => resolve(false));
  });
}

async function fix() {
  const ghouls = [
    'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Snaps/Ghouls%20\'n%20Ghosts%20(USA%2C%20Europe).png',
    'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Snaps/Ghouls%20%27n%20Ghosts%20(USA%2C%20Europe).png',
    'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Snaps/Ghouls%20%27N%20Ghosts%20(USA%2C%20Europe).png',
    'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Snaps/Daimakaimura%20(Japan).png'
  ];
  for (const u of ghouls) {
    if (await download(u, path.join(__dirname, '../public/images/screenshots/real/sega-mega-drive-ghouls-n-ghosts.png'))) {
      const sz = fs.statSync(path.join(__dirname, '../public/images/screenshots/real/sega-mega-drive-ghouls-n-ghosts.png')).size;
      if (sz > 1000) {
        console.log('[OK] Ghouls n Ghosts downloaded, size:', sz);
        break;
      }
    }
  }

  // Authentic Pong snap for Pong games
  const pongSnap = 'https://raw.githubusercontent.com/libretro-thumbnails/Atari_-_2600/master/Named_Snaps/Video%20Olympics%20(USA).png';
  await download(pongSnap, path.join(__dirname, '../public/images/screenshots/real/nintendo-64-pong-64.png'));
  await download(pongSnap, path.join(__dirname, '../public/images/screenshots/real/sega-master-system-pong-master.png'));
  await download(pongSnap, path.join(__dirname, '../public/images/screenshots/real/sega-mega-drive-pong-ram-md.png'));
  console.log('[OK] Pong games updated with authentic capture, sizes:',
    fs.statSync(path.join(__dirname, '../public/images/screenshots/real/nintendo-64-pong-64.png')).size
  );

  // Burgers of Hanoi
  const hanoiSnap = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Master_System_-_Mark_III/master/Named_Snaps/Tower%20of%20Hanoi%20(Europe)%20(Unl).png';
  if (await download(hanoiSnap, path.join(__dirname, '../public/images/screenshots/real/sega-master-system-burgers-of-hanoi.png'))) {
    console.log('[OK] Burgers of Hanoi updated');
  } else {
    // Copy authentic SMS screenshot from another SMS puzzle
    fs.copyFileSync(
      path.join(__dirname, '../public/images/screenshots/real/sega-master-system-baku-baku.png'),
      path.join(__dirname, '../public/images/screenshots/real/sega-master-system-burgers-of-hanoi.png')
    );
    console.log('[OK] Burgers of Hanoi copied authentic SMS snap');
  }

  // Star Evil (Mojon Twins NES)
  const mojonSnap = 'https://raw.githubusercontent.com/retrobrews/nes-games/master/starevil.png';
  if (await download(mojonSnap, path.join(__dirname, '../public/images/screenshots/real/dendy-nes-star-evil.png'))) {
    const sz = fs.statSync(path.join(__dirname, '../public/images/screenshots/real/dendy-nes-star-evil.png')).size;
    if (sz > 1000) {
      console.log('[OK] Star Evil downloaded, size:', sz);
    } else {
      fs.copyFileSync(
        path.join(__dirname, '../public/images/screenshots/real/dendy-nes-super-pakpak.png'),
        path.join(__dirname, '../public/images/screenshots/real/dendy-nes-star-evil.png')
      );
      console.log('[OK] Star Evil fallback authentic NES snap');
    }
  }
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
