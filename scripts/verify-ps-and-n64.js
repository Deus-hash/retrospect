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

async function runTest(testUrl, label) {
  console.log(`\n==============================================`);
  console.log(`Testing: ${label} (${testUrl})`);
  console.log(`==============================================`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-verify-${label}`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9340 + Math.floor(Math.random() * 50);

  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,1000',
    '--autoplay-policy=no-user-gesture-required',
    testUrl
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

    if (!version) {
      console.error('Edge did not start CDP');
      edgeProc.kill();
      return;
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
      if (msg.id && calls.has(msg.id)) {
        const { resolve, reject } = calls.get(msg.id);
        calls.delete(msg.id);
        if (msg.error) reject(msg.error); else resolve(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value) : (a.description || '')).join(' ');
        logs.push(text);
        if (msg.params.type === 'error' || text.toLowerCase().includes('error') || text.includes('Nostalgist')) {
          console.log(`[${label} LOG]`, text);
        }
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

    console.log('Waiting for emulator initialization...');
    await wait(8000); // Allow WASM core to load and initialize

    // Check status in page
    const statusResult = await send('Runtime.evaluate', {
      expression: `(function() {
        var statusEl = document.getElementById('emulator-status');
        var canvas = document.querySelector('.emulator__canvas-wrap canvas');
        var isCanvasPresent = !!canvas;
        var canvasWidth = canvas ? canvas.width : 0;
        var canvasHeight = canvas ? canvas.height : 0;

        var hasPixels = false;
        var nonZeroCount = 0;
        if (canvas) {
          try {
            var gl = canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('2d');
            // Try 2d read or WebGL readPixels
            if (canvas.getContext('2d')) {
              var ctx = canvas.getContext('2d');
              var img = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
              for (var i = 0; i < img.data.length; i += 4) {
                if (img.data[i] !== 0 || img.data[i+1] !== 0 || img.data[i+2] !== 0) {
                  nonZeroCount++;
                }
              }
            }
          } catch(e) {}
        }

        return {
          statusText: statusEl ? statusEl.textContent : '',
          isCanvasPresent: isCanvasPresent,
          canvasWidth: canvasWidth,
          canvasHeight: canvasHeight,
          hasEmulatorClass: document.querySelector('.emulator') ? document.querySelector('.emulator').className : '',
          canvasParent: canvas ? canvas.parentElement.className : 'no-parent'
        };
      })()`,
      returnByValue: true
    });

    console.log('Page DOM State:', statusResult.result.value);

    // Take screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.resolve(__dirname, `../public/verify-${label}.png`);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to ${shotPath}`);

    ws.close();
  } catch(err) {
    console.error('Error during test:', err);
  } finally {
    edgeProc.kill();
  }
}

async function main() {
  await runTest('http://localhost:3000/emulators?console=playstation', 'ps1');
  await runTest('http://localhost:3000/emulators?console=nintendo-64', 'n64');
  console.log('\nAll verification tests completed!');
}

main().catch(console.error);
