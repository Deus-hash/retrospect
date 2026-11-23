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

async function testTakatron(fileToTest) {
  console.log(`\nTesting Takatron with: ${fileToTest}`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-takatron-test`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9390;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
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
        console.log(`[CDP LOG]`, text);
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

    const testRes = await send('Runtime.evaluate', {
      expression: `(async function() {
        try {
          const c = document.querySelector('.emulator__canvas-wrap canvas');
          const inst = await window.Nostalgist.launch({
            core: 'pcsx_rearmed',
            rom: window.location.origin + '${fileToTest}',
            element: c,
            resolveRom: f => f,
            resolveCoreJs: c => '/cores/' + c + '_libretro.js',
            resolveCoreWasm: c => '/cores/' + c + '_libretro.wasm',
          });
          return { success: true };
        } catch(e) {
          return { success: false, error: e.message };
        }
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Test result:', testRes.result.value);

    await wait(4000);
    ws.close();
  } finally {
    edgeProc.kill();
  }
}

async function main() {
  await testTakatron('/roms/playstation/takatron.exe');
  await testTakatron('/roms/playstation/takatron.psx');
}

main().catch(console.error);
