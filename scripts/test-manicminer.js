const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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

async function testClick(gameSlug) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-click-${gameSlug}`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=9235`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,1000',
    '--autoplay-policy=no-user-gesture-required',
    `http://localhost:3000/emulators?console=nintendo-64&game=${gameSlug}&autoplay=1`
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9235/json/version');
      if (version) break;
    } catch(e) {}
  }

  const list = await getJson('http://127.0.0.1:9235/json/list');
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

  await wait(3000);

  // Click start overlay
  await send('Runtime.evaluate', {
    expression: `(function() {
      const o = document.getElementById('emulator-start-overlay');
      if (o) o.click();
      const s = document.querySelector('[data-action="start"]');
      if (s) s.click();
    })()`
  });

  await wait(8000);

  await send('Runtime.evaluate', { expression: `window.scrollTo(0, 300);` });
  await wait(500);

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:\\Users\\Deus\\Desktop\\Retrospect\\public\\screen-running-${gameSlug}.png`, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screen-running-${gameSlug}.png`);

  ws.close();
  edgeProc.kill();
  process.exit(0);
}

testClick('nintendo-64-manic-miner-64').catch(console.error);
