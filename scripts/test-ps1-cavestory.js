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

async function testCaveStory() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-cavestory-test`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9388;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,1000',
    'http://localhost:3000/emulators?console=playstation'
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value) : (a.description || '')).join(' ');
        console.log(`[CAVESTORY LOG]`, text);
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

    console.log('Launching Cave Story PS1 ISO in Nostalgist...');
    const testRes = await send('Runtime.evaluate', {
      expression: `(async function() {
        try {
          const c = document.querySelector('.emulator__canvas-wrap canvas');
          const inst = await window.Nostalgist.launch({
            core: 'pcsx_rearmed',
            rom: window.location.origin + '/roms/playstation/cavestory.iso',
            element: c,
            resolveRom: f => f,
            resolveCoreJs: c => '/cores/' + c + '_libretro.js',
            resolveCoreWasm: c => '/cores/' + c + '_libretro.wasm',
            retroarchConfig: {
              video_allow_rotate: false,
              audio_enable: true,
            }
          });
          window._inst = inst;
          return { success: true };
        } catch(e) {
          return { success: false, error: e.message };
        }
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Launch result:', testRes.result.value);

    // Wait 10 seconds for game intro and title screen
    console.log('Waiting 10s for game boot and rendering...');
    await wait(10000);

    // Check pixels
    const check = await send('Runtime.evaluate', {
      expression: `(function() {
        const c = document.querySelector('.emulator__canvas-wrap canvas');
        if (!c) return { error: 'no canvas' };
        const gl = c.getContext('webgl') || c.getContext('webgl2');
        let nonZero = 0;
        if (gl) {
          const p = new Uint8Array(c.width * c.height * 4);
          gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
          for (let i = 0; i < p.length; i += 4) {
            if (p[i] || p[i+1] || p[i+2]) nonZero++;
          }
        }
        return { nonZero: nonZero, w: c.width, h: c.height };
      })()`,
      returnByValue: true
    });
    console.log('Pixel check result:', check.result.value);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.resolve('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\verify-ps1-cavestory.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to ${shotPath}`);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

testCaveStory().catch(console.error);
