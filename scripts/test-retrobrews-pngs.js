const https = require('https');

function check(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      resolve(res.statusCode === 200 ? url : null);
    }).on('error', () => resolve(null));
  });
}

async function test() {
  const list = [
    'sandcastles', 'flappy_the_duck', 'flappytheduck', 'flappyduck',
    'nanowing', 'hauntedbakery', 'haunted_bakery', 'stardust',
    'threes', 'thrust', 'pothole', 'dkarcade2600', 'dk_arcade', 'dkarcade',
    'winterfortress', 'winter_fortress'
  ];
  for (const name of list) {
    const url = `https://raw.githubusercontent.com/retrobrews/atari2600-games/master/${name}.png`;
    const res = await check(url);
    console.log(name, '=>', res ? 'FOUND' : '404');
  }
}
test();
