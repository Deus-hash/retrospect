const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-consoles-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9395;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1200,900',
    'http://localhost:3000/'
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
    await wait(1500);

    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 1200);` });
    await wait(500);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.resolve(__dirname, `../public/verify-home-consoles.png`);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to ${shotPath}`);

    const artifactPath = `C:\\Users\\Deus\\.gemini\\antigravity\\brain\\d480a61c-d005-48c8-af10-ea3d4deba974\\verify-home-consoles.png`;
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved artifact to ${artifactPath}`);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
