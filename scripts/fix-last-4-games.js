const https = require('https');
const fs = require('fs');

function check(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      resolve(res.statusCode === 200 ? url : null);
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const tests = [
    // PC Engine
    'https://raw.githubusercontent.com/retrobrews/pce-games/master/pizzaball.png',
    'https://raw.githubusercontent.com/retrobrews/pce-games/master/pizza-ball.png',
    'https://raw.githubusercontent.com/retrobrews/pce-games/master/gamelife.png',
    'https://raw.githubusercontent.com/retrobrews/pce-games/master/starwave.png',
    'https://raw.githubusercontent.com/libretro-thumbnails/NEC_-_PC_Engine_-_TurboGrafx_16/master/Named_Snaps/Pizza%20Ball.png',
    'https://raw.githubusercontent.com/libretro-thumbnails/NEC_-_PC_Engine_-_TurboGrafx_16/master/Named_Snaps/Pizza%20Ball%20(USA).png',
    'https://raw.githubusercontent.com/libretro-thumbnails/NEC_-_PC_Engine_-_TurboGrafx_16/master/Named_Snaps/Ballblazer%20(Japan).png',
    // N64 Pong
    'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_64/master/Named_Snaps/Pong%20(USA).png',
    'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_64/master/Named_Snaps/Pong.png',
    'https://raw.githubusercontent.com/DerekTurtleRoe/N64-PD-ROMS/master/ROMS/Homebrew/Pong%20V0.01%20by%20Omsk%20(PD).png'
  ];

  for (const t of tests) {
    const hit = await check(t);
    console.log(t, '=>', hit ? '200 OK' : '404');
  }
}
run();
