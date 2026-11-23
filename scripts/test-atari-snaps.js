const https = require('https');

function check(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function testAtari() {
  const repo = 'Atari_-_2600';
  const prefix = `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/Named_Snaps/`;
  
  const games = [
    'Anguna', 'Bit Quest', 'Turtle Bay', 'Winter Fortress',
    'Flappy the Duck', 'Flappy Duck', 'Nanowing', 'Haunted Bakery',
    'Sandcastles', 'Stardust', 'Threes', 'Pothole', 'DK Arcade'
  ];

  for (const g of games) {
    const variations = [
      `${g}.png`,
      `${g} (USA).png`,
      `${g} (World).png`,
      `${g} (Unl).png`,
      `${g} (USA) (Unl).png`,
      `${g} (World) (Unl).png`,
      `${g} (USA) (Homebrew).png`,
      `${g} (Homebrew).png`
    ];
    let hit = null;
    for (const v of variations) {
      if (await check(prefix + encodeURIComponent(v))) {
        hit = v;
        break;
      }
    }
    console.log(g, '=>', hit || 'NO MATCH');
  }
}

testAtari().then(() => process.exit(0));
