const fs = require('fs');
const path = require('path');

function getDirSize(dir) {
  let size = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      size += getDirSize(full);
    } else {
      size += stat.size;
    }
  }
  return size;
}

const pub = path.join(__dirname, '../public');
const total = getDirSize(pub);
console.log('Total public dir size:', (total / 1024 / 1024).toFixed(2), 'MB');
['roms', 'images', 'cores', 'js', 'css'].forEach(d => {
  const p = path.join(pub, d);
  if (fs.existsSync(p)) {
    console.log(`  - ${d}: ${(getDirSize(p) / 1024 / 1024).toFixed(2)} MB`);
  }
});
