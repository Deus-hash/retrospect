const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Game = require('../src/models/Game');

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function captureGame(consoleSlug, gameSlug) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-capture-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9390 + Math.floor(Math.random() * 50);
  const targetUrl = `http://localhost:3000/emulators?console=${consoleSlug}&game=${gameSlug}&autoplay=1`;
  console.log(`Launching Edge for ${gameSlug}...`);
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,900',
    '--autoplay-policy=no-user-gesture-required',
    targetUrl
  ]);

  try {
    let version = null;
    for (let i = 0; i < 20; i++) {
      await wait(300);
      try {
        version = await getJson(`http://127.0.0.1:${port}/json/version`);
        if (version) break;
      } catch(e) {}
    }

    const list = await getJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = list.find(t => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const calls = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && calls.has(msg.id)) {
        const { resolve, reject } = calls.get(msg.id);
        calls.delete(msg.id);
        if (msg.error) reject(msg.error); else resolve(msg.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        calls.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    console.log(`Waiting 4s for emulator to render frame...`);
    await wait(4000);

    // Grab canvas data URL
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const canvas = document.querySelector('#emulator-screen canvas') || document.querySelector('canvas');
          if (!canvas) return { error: 'No canvas found' };
          try {
            return { data: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
          } catch(e) {
            return { error: e.message };
          }
        })()
      `,
      returnByValue: true
    });

    const result = evalRes.result && evalRes.result.value;
    if (result && result.data && result.data.startsWith('data:image/png;base64,')) {
      const base64 = result.data.replace(/^data:image\/png;base64,/, '');
      const outPath = path.resolve(__dirname, `../public/images/screenshots/real/${gameSlug}.png`);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`[SUCCESS] Saved genuine frame to ${outPath} (${result.w}x${result.h})`);
      ws.close();
      return `/images/screenshots/real/${gameSlug}.png`;
    } else {
      console.log(`[WARN] Could not grab canvas:`, result);
      ws.close();
      return null;
    }
  } catch(e) {
    console.error(`Error capturing ${gameSlug}:`, e.message);
    return null;
  } finally {
    edgeProc.kill();
  }
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/retrospect');
  
  const toCapture = [
    { console: 'pc-engine', slug: 'pc-engine-pizza-ball' },
    { console: 'pc-engine', slug: 'pc-engine-conway-s-game-of-life-pce' },
    { console: 'pc-engine', slug: 'pc-engine-starwave-pce' }
  ];

  for (const item of toCapture) {
    const shot = await captureGame(item.console, item.slug);
    if (shot) {
      await Game.updateOne({ slug: item.slug }, { $set: { screenshots: [shot] } });
      console.log(`Updated Game ${item.slug} in DB`);
    }
  }

  // For Pong 64 (non-playable), use authentic Arcade/Retro Pong snap
  const pongSnap = 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/master/Named_Snaps/Pong%20(USA)%20(Unl).png';
  const pongDest = path.resolve(__dirname, '../public/images/screenshots/real/nintendo-64-pong-64.png');
  const https = require('https');
  await new Promise(r => {
    https.get(pongSnap, res => {
      if (res.statusCode === 200) {
        res.pipe(fs.createWriteStream(pongDest)).on('finish', async () => {
          console.log('Saved authentic Pong snap');
          await Game.updateOne({ slug: 'nintendo-64-pong-64' }, { $set: { screenshots: ['/images/screenshots/real/nintendo-64-pong-64.png'] } });
          r();
        });
      } else {
        // Fallback to Atari 2600 Video Olympics (Pong)
        const pongAtari = 'https://raw.githubusercontent.com/libretro-thumbnails/Atari_-_2600/master/Named_Snaps/Video%20Olympics%20(USA).png';
        https.get(pongAtari, res2 => {
          res2.pipe(fs.createWriteStream(pongDest)).on('finish', async () => {
            console.log('Saved Video Olympics (Pong) snap');
            await Game.updateOne({ slug: 'nintendo-64-pong-64' }, { $set: { screenshots: ['/images/screenshots/real/nintendo-64-pong-64.png'] } });
            r();
          });
        });
      }
    });
  });

  await mongoose.disconnect();
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
