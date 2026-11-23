const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GAMES_DIR = path.join(__dirname, '../public/images/games');

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// 5x7 mini pixel font for retro text in PNG
const FONT = {
  'A': [0x70,0x88,0x88,0xF8,0x88,0x88,0x88],
  'B': [0xF0,0x88,0x88,0xF0,0x88,0x88,0xF0],
  'C': [0x70,0x88,0x80,0x80,0x80,0x88,0x70],
  'D': [0xE0,0x90,0x88,0x88,0x88,0x90,0xE0],
  'E': [0xF8,0x80,0x80,0xF0,0x80,0x80,0xF8],
  'F': [0xF8,0x80,0x80,0xF0,0x80,0x80,0x80],
  'G': [0x70,0x88,0x80,0xB8,0x88,0x88,0x78],
  'H': [0x88,0x88,0x88,0xF8,0x88,0x88,0x88],
  'I': [0x70,0x20,0x20,0x20,0x20,0x20,0x70],
  'J': [0x38,0x10,0x10,0x10,0x10,0x90,0x60],
  'K': [0x88,0x90,0xA0,0xC0,0xA0,0x90,0x88],
  'L': [0x80,0x80,0x80,0x80,0x80,0x80,0xF8],
  'M': [0x88,0xD8,0xA8,0x88,0x88,0x88,0x88],
  'N': [0x88,0xC8,0xA8,0x98,0x88,0x88,0x88],
  'O': [0x70,0x88,0x88,0x88,0x88,0x88,0x70],
  'P': [0xF0,0x88,0x88,0xF0,0x80,0x80,0x80],
  'Q': [0x70,0x88,0x88,0x88,0xA8,0x90,0x68],
  'R': [0xF0,0x88,0x88,0xF0,0xA0,0x90,0x88],
  'S': [0x70,0x88,0x80,0x70,0x08,0x88,0x70],
  'T': [0xF8,0x20,0x20,0x20,0x20,0x20,0x20],
  'U': [0x88,0x88,0x88,0x88,0x88,0x88,0x70],
  'V': [0x88,0x88,0x88,0x88,0x88,0x50,0x20],
  'W': [0x88,0x88,0x88,0xA8,0xA8,0xD8,0x88],
  'X': [0x88,0x88,0x50,0x20,0x50,0x88,0x88],
  'Y': [0x88,0x88,0x50,0x20,0x20,0x20,0x20],
  'Z': [0xF8,0x08,0x10,0x20,0x40,0x80,0xF8],
  '0': [0x70,0x88,0x98,0xA8,0xC8,0x88,0x70],
  '1': [0x20,0x60,0x20,0x20,0x20,0x20,0x70],
  '2': [0x70,0x88,0x08,0x30,0x40,0x80,0xF8],
  '3': [0x70,0x88,0x08,0x30,0x08,0x88,0x70],
  '4': [0x10,0x30,0x50,0x90,0xF8,0x10,0x10],
  '5': [0xF8,0x80,0xF0,0x08,0x08,0x88,0x70],
  '6': [0x70,0x80,0xF0,0x88,0x88,0x88,0x70],
  '7': [0xF8,0x08,0x10,0x20,0x20,0x20,0x20],
  '8': [0x70,0x88,0x88,0x70,0x88,0x88,0x70],
  '9': [0x70,0x88,0x88,0x78,0x08,0x08,0x70],
  '-': [0x00,0x00,0x00,0xF8,0x00,0x00,0x00],
  ':': [0x00,0x20,0x00,0x00,0x20,0x00,0x00],
  ' ': [0x00,0x00,0x00,0x00,0x00,0x00,0x00],
};

function generateRetroBitmapPng(filename) {
  const w = 320;
  const h = 240;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2; // RGB
  const ihdr = chunk('IHDR', ihdrData);

  const rowLen = 1 + w * 3;
  const raw = Buffer.alloc(h * rowLen);

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const off = y * rowLen + 1 + x * 3;
    raw[off] = r;
    raw[off + 1] = g;
    raw[off + 2] = b;
  }

  function fillRect(x1, y1, width, height, r, g, b) {
    for (let y = y1; y < y1 + height; y++) {
      for (let x = x1; x < x1 + width; x++) {
        setPixel(x, y, r, g, b);
      }
    }
  }

  function drawText(text, startX, startY, scale, r, g, b) {
    const clean = text.toUpperCase();
    let curX = startX;
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const glyph = FONT[char] || FONT[' '];
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (0x80 >> col)) {
            fillRect(curX + col * scale, startY + row * scale, scale, scale, r, g, b);
          }
        }
      }
      curX += 6 * scale;
    }
  }

  // Theme detection from filename
  let theme = { top: [15, 20, 45], bot: [4, 6, 15], ground: [35, 75, 25], accent: [0, 240, 255], system: 'RETRO' };
  if (filename.startsWith('n64-')) {
    theme = { top: [20, 60, 95], bot: [10, 25, 40], ground: [40, 95, 30], accent: [255, 215, 0], system: 'N64 64-BIT' };
  } else if (filename.startsWith('ps1-')) {
    theme = { top: [10, 15, 40], bot: [2, 4, 12], ground: [35, 45, 65], accent: [0, 220, 255], system: 'PLAYSTATION' };
  } else if (filename.startsWith('atari-')) {
    theme = { top: [40, 15, 5], bot: [10, 2, 2], ground: [90, 50, 10], accent: [255, 160, 0], system: 'ATARI 2600' };
  } else if (filename.startsWith('sms-')) {
    theme = { top: [0, 80, 180], bot: [0, 25, 60], ground: [0, 140, 40], accent: [255, 255, 255], system: 'MASTER SYSTEM' };
  } else if (filename.startsWith('snes-')) {
    theme = { top: [30, 20, 60], bot: [8, 5, 20], ground: [45, 110, 35], accent: [240, 80, 255], system: 'SUPER NINTENDO' };
  } else if (filename.startsWith('md-')) {
    theme = { top: [15, 40, 80], bot: [5, 10, 30], ground: [30, 90, 20], accent: [0, 200, 255], system: 'MEGA DRIVE' };
  } else if (filename.startsWith('nes-')) {
    theme = { top: [80, 120, 240], bot: [20, 30, 80], ground: [180, 60, 15], accent: [255, 220, 50], system: 'NES 8-BIT' };
  }

  // 1. Sky Gradient & Scanlines
  for (let y = 0; y < h; y++) {
    const factor = y / h;
    const r = Math.round(theme.top[0] * (1 - factor) + theme.bot[0] * factor);
    const g = Math.round(theme.top[1] * (1 - factor) + theme.bot[1] * factor);
    const b = Math.round(theme.top[2] * (1 - factor) + theme.bot[2] * factor);
    const scanlineDark = (y % 2 === 0) ? 0.85 : 1.0;
    fillRect(0, y, w, 1, Math.round(r * scanlineDark), Math.round(g * scanlineDark), Math.round(b * scanlineDark));
  }

  // 2. Mountains / Hills background
  for (let x = 0; x < w; x++) {
    const hillHeight = Math.round(Math.sin(x / 40) * 15 + Math.sin(x / 15) * 8 + 45);
    fillRect(x, 180 - hillHeight, 1, hillHeight, Math.round(theme.ground[0] * 0.45), Math.round(theme.ground[1] * 0.45), Math.round(theme.ground[2] * 0.45));
  }

  // 3. Ground / Floor
  fillRect(0, 180, w, 60, theme.ground[0], theme.ground[1], theme.ground[2]);
  fillRect(0, 180, w, 4, 210, 90, 20); // Ground border

  // 4. Floating Pixel Platforms & Mystery blocks
  fillRect(60, 110, 50, 14, 180, 80, 20);
  fillRect(62, 112, 46, 10, 220, 100, 30);

  fillRect(130, 90, 20, 20, 255, 180, 0); // Question Block
  fillRect(132, 92, 16, 16, 255, 210, 0);
  drawText('?', 137, 95, 2, 80, 40, 0);

  fillRect(170, 120, 60, 14, 180, 80, 20);
  fillRect(172, 122, 56, 10, 220, 100, 30);

  // Coins
  fillRect(80, 85, 8, 12, 255, 220, 0);
  fillRect(200, 95, 8, 12, 255, 220, 0);

  // 5. Hero Character Sprite
  const heroX = 80;
  const heroY = 145;
  fillRect(heroX + 4, heroY, 16, 6, theme.accent[0], theme.accent[1], theme.accent[2]); // Cap
  fillRect(heroX + 6, heroY + 6, 12, 8, 255, 210, 170); // Face
  fillRect(heroX + 14, heroY + 8, 4, 3, 0, 0, 0); // Eye
  fillRect(heroX + 4, heroY + 14, 16, 12, theme.accent[0], theme.accent[1], theme.accent[2]); // Torso
  fillRect(heroX + 6, heroY + 26, 5, 8, 30, 60, 180); // Leg 1
  fillRect(heroX + 14, heroY + 26, 5, 8, 30, 60, 180); // Leg 2
  fillRect(heroX + 4, heroY + 34, 8, 3, 100, 50, 0); // Shoe 1
  fillRect(heroX + 13, heroY + 34, 8, 3, 100, 50, 0); // Shoe 2

  // 6. Title Banner & Arcade HUD
  fillRect(0, 0, w, 24, 10, 10, 18);
  drawText('SCORE: 054200', 10, 8, 1, 255, 255, 255);
  drawText('COINS: 18', 130, 8, 1, 255, 215, 0);
  drawText(theme.system, 215, 8, 1, theme.accent[0], theme.accent[1], theme.accent[2]);

  // Clean Game Title in center
  const displayTitle = filename.replace(/\.png$/, '').replace(/^[a-z0-9]+-/, '').substring(0, 16);
  fillRect(w / 2 - (displayTitle.length * 10) / 2 - 8, 40, displayTitle.length * 10 + 16, 20, 0, 0, 0);
  fillRect(w / 2 - (displayTitle.length * 10) / 2 - 6, 42, displayTitle.length * 10 + 12, 16, 25, 25, 45);
  drawText(displayTitle, w / 2 - (displayTitle.length * 10) / 2, 45, 1, 255, 255, 255);

  // 7. CRT Monitor Border
  for (let x = 0; x < w; x++) {
    setPixel(x, 0, 30, 30, 30);
    setPixel(x, 1, 15, 15, 15);
    setPixel(x, h - 2, 15, 15, 15);
    setPixel(x, h - 1, 30, 30, 30);
  }
  for (let y = 0; y < h; y++) {
    setPixel(0, y, 30, 30, 30);
    setPixel(1, y, 15, 15, 15);
    setPixel(w - 2, y, 15, 15, 15);
    setPixel(w - 1, y, 30, 30, 30);
  }

  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function run() {
  const files = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.png'));
  let fixedCount = 0;

  files.forEach(f => {
    const fullPath = path.join(GAMES_DIR, f);
    const buf = fs.readFileSync(fullPath);
    if (buf.slice(0, 4).toString('utf8').includes('<')) {
      const realPng = generateRetroBitmapPng(f);
      fs.writeFileSync(fullPath, realPng);
      fixedCount++;
      console.log(`Replaced fake SVG with valid PNG: ${f} (${realPng.length} bytes)`);
    }
  });

  console.log(`Total fixed fake PNGs: ${fixedCount}`);
}

run();
