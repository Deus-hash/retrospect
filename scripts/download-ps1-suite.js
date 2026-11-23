const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

async function run() {
  const zipPath = 'C:\\Users\\Deus\\Desktop\\Retrospect\\public\\roms\\playstation\\240pTestSuitePS1-EMU.zip';
  console.log('Downloading 240pTestSuitePS1-EMU.zip...');
  await download('https://github.com/filipalac/240pTestSuite-PS1/releases/download/19122020/240pTestSuitePS1-EMU.zip', zipPath);
  console.log('Downloaded!', fs.statSync(zipPath).size, 'bytes');

  // Unzip using powershell
  const destDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\public\\roms\\playstation';
  execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'"`);
  console.log('Extracted files in playstation dir:');
  fs.readdirSync(destDir).forEach(f => {
    const s = fs.statSync(path.join(destDir, f));
    console.log(f, s.size, 'bytes');
  });
}

run().catch(console.error);
