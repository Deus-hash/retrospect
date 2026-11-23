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

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-test-yaroze';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9399;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,900',
    'http://localhost:3000/emulators?console=playstation'
  ]);

  try {
    let version = null;
    for (let i = 0; i < 25; i++) {
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
    await wait(2000);

    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const canvas = document.getElementById('retrospect-canvas');
          const nost = await Nostalgist.launch({
            core: 'pcsx_rearmed',
            rom: [
              'http://localhost:3000/roms/playstation/netyaroze.cue',
              'http://localhost:3000/roms/playstation/netyaroze.bin'
            ],
            element: canvas,
            respondToGlobalEvents: true,
            resolveCoreJs: c => window.location.origin + '/cores/' + c + '_libretro.js',
            resolveCoreWasm: c => window.location.origin + '/cores/' + c + '_libretro.wasm',
          });
          window.testNost = nost;
          return 'ok';
        })()
      `,
      awaitPromise: true
    });

    console.log('Emulator started. Waiting 7s...');
    await wait(7000);

    // Send KeyX (in RetroArch, default button for (X) / cross is 'x' or 'z')
    for (let i = 0; i < 3; i++) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'x', code: 'KeyX', windowsVirtualKeyCode: 88 });
      await wait(150);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'x', code: 'KeyX', windowsVirtualKeyCode: 88 });
      await wait(500);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await wait(150);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await wait(1000);
    }

    console.log('Keys sent. Waiting 4s...');
    await wait(4000);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\verify-yaroze-menu.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify-yaroze-menu.png');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
