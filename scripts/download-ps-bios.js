const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const biosDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\public\\bios';
if (!fs.existsSync(biosDir)) fs.mkdirSync(biosDir, { recursive: true });

function downloadFile(url, dest, cb) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return downloadFile(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      return cb(new Error('Status: ' + res.statusCode));
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        const hash = crypto.createHash('md5').update(fs.readFileSync(dest)).digest('hex');
        cb(null, hash);
      });
    });
  }).on('error', cb);
}

downloadFile('https://archive.org/download/ps-1-bios/SCPH5501.BIN', path.join(biosDir, 'scph5501.bin'), (err, hash) => {
  if (err) console.error('Error:', err);
  else console.log('Successfully downloaded scph5501.bin! MD5:', hash, 'Expected: 490f666e1afb15b7362b406ed1cea246');
});
