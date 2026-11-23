const https = require('https');
const fs = require('fs');
const path = require('path');

const dest = path.resolve('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\roms\\playstation\\cavestory.iso');

if (fs.existsSync(dest) && fs.statSync(dest).size > 10000000) {
  console.log('Already downloaded:', dest, fs.statSync(dest).size);
  process.exit(0);
}

console.log('Downloading Cave Story PS1 ISO (32MB)...');
function downloadWithRedirect(url) {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      return downloadWithRedirect(res.headers.location);
    }
    if (res.statusCode !== 200) {
      console.error('Failed with status:', res.statusCode);
      process.exit(1);
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Downloaded successfully! File size:', fs.statSync(dest).size);
      process.exit(0);
    });
  }).on('error', err => {
    console.error('Download error:', err);
    process.exit(1);
  });
}

downloadWithRedirect('https://github.com/fgsfdsfgs/doukutsupsx/releases/download/v0.7/doukutsu_r7_us.iso');
