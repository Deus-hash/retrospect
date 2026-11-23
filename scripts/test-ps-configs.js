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

async function testPsConfig(coreConfig, romFile, name) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-corecfg-${name}`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=9232`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,1000',
    '--autoplay-policy=no-user-gesture-required',
    'http://localhost:3000/emulators?console=playstation'
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9232/json/version');
      if (version) break;
    } catch(e) {}
  }

  const list = await getJson('http://127.0.0.1:9232/json/list');
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
      console.log(`[${name} CONSOLE]`, text);
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

  console.log(`[${name}] Launching with config...`);
  const res = await send('Runtime.evaluate', {
    expression: `(async function() {
      try {
        const c = document.querySelector('.emulator__canvas-wrap canvas');
        const inst = await window.Nostalgist.launch({
          core: 'pcsx_rearmed',
          rom: ${JSON.stringify(romFile)},
          element: c,
          resolveRom: f => f,
          resolveCoreJs: c => '/cores/' + c + '_libretro.js',
          resolveCoreWasm: c => '/cores/' + c + '_libretro.wasm',
          retroarchCoreConfig: ${JSON.stringify(coreConfig)}
        });
        window._inst = inst;
        return { success: true };
      } catch(e) {
        return { success: false, error: e.message };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log(`[${name}] Launch result:`, res.result.value);

  await wait(8000);

  // Check canvas pixels
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
  console.log(`[${name}] Pixel check:`, check.result.value);

  await send('Runtime.evaluate', { expression: `window.scrollTo(0, 300);` });
  await wait(500);

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:\\Users\\Deus\\Desktop\\Retrospect\\public\\screen-test-${name}.png`, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screen-test-${name}.png`);

  ws.close();
  edgeProc.kill();
  await wait(1000);
}

async function run() {
  await testPsConfig({
    pcsx_rearmed_bios: 'openbios',
    pcsx_rearmed_drc: 'disabled',
    pcsx_rearmed_show_bios_bootlogo: 'disabled'
  }, '/roms/playstation/takatron.exe', 'takatron-openbios');

  await testPsConfig({
    pcsx_rearmed_bios: 'openbios',
    pcsx_rearmed_drc: 'disabled',
    pcsx_rearmed_show_bios_bootlogo: 'disabled'
  }, [
    'http://localhost:3000/roms/playstation/tetrade.cue',
    'http://localhost:3000/roms/playstation/TETRADE_PSX.bin'
  ], 'tetrade-openbios');

  process.exit(0);
}

run().catch(console.error);
