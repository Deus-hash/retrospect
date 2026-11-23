const fs = require('fs');
const path = require('path');
const https = require('https');

const CORES_DIR = path.join(__dirname, '../public/cores');
if (!fs.existsSync(CORES_DIR)) fs.mkdirSync(CORES_DIR, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`Already exists: ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`);
      return resolve();
    }
    console.log(`Downloading: ${url} -> ${path.basename(dest)}`);
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`Downloaded ${path.basename(dest)}: ${fs.statSync(dest).size} bytes`);
          resolve();
        });
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function run() {
  const cores = [
    {
      name: 'mupen64plus_next',
      js: 'https://raw.githubusercontent.com/BinBashBanana/webretro/master/cores/mupen64plus_next_libretro.js',
      wasm: 'https://raw.githubusercontent.com/BinBashBanana/webretro/master/cores/mupen64plus_next_libretro.wasm'
    },
    {
      name: 'stella2014',
      js: 'https://raw.githubusercontent.com/BinBashBanana/webretro/master/cores/stella2014_libretro.js',
      wasm: 'https://raw.githubusercontent.com/BinBashBanana/webretro/master/cores/stella2014_libretro.wasm'
    }
  ];

  for (const c of cores) {
    await downloadFile(c.js, path.join(CORES_DIR, `${c.name}_libretro.js`));
    await downloadFile(c.wasm, path.join(CORES_DIR, `${c.name}_libretro.wasm`));
  }

  console.log('Core downloads complete!');
}

run().catch(console.error);
