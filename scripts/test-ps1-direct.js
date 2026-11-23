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

async function testRom(romArray, testName) {
  console.log('Testing', testName, '...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-test-' + Date.now();
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9380 + Math.floor(Math.random() * 50);
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
    const logs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        logs.push(text);
        console.log('[Browser Console]', text);
      }
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

    const romJs = JSON.stringify(romArray);
    console.log('Launching with roms:', romJs);
    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          try {
            if (window.unifiedEmulator && window.unifiedEmulator.currentNostalgist) {
              await window.unifiedEmulator.currentNostalgist.exit();
            }
            const canvas = document.getElementById('emulator-canvas');
            const nost = await Nostalgist.launch({
              core: 'pcsx_rearmed',
              rom: ${romJs},
              element: canvas,
              respondToGlobalEvents: true,
              resolveCoreJs: c => window.location.origin + '/cores/' + c + '_libretro.js',
              resolveCoreWasm: c => window.location.origin + '/cores/' + c + '_libretro.wasm',
            });
            window.testNost = nost;
            return 'launched_ok';
          } catch(e) {
            return 'error: ' + e.message;
          }
        })()
      `,
      awaitPromise: true
    });

    console.log('Launch result:', evalResult);
    await wait(8000);

    const pixelCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const canvas = document.getElementById('emulator-canvas');
          if (!canvas) return 'no canvas';
          return 'canvas size: ' + canvas.width + 'x' + canvas.height;
        })()
      `
    });
    console.log('Pixel check:', pixelCheck);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\' + testName + '.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to public/' + testName + '.png');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

async function main() {
  await testRom([
    'http://localhost:3000/roms/playstation/demo.cue',
    'http://localhost:3000/roms/playstation/demo.bin'
  ], 'verify-ps1-3ddemo');
}

main().catch(console.error);
