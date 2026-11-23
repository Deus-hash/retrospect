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

async function testPixels(url, name) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-${name}`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9228',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--autoplay-policy=no-user-gesture-required',
    url
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9228/json/version');
      if (version) break;
    } catch(e) {}
  }

  const list = await getJson('http://127.0.0.1:9228/json/list');
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

  await wait(6000);

  const canvasData = await send('Runtime.evaluate', {
    expression: `(function() {
      const c = document.querySelector('.emulator__canvas-wrap canvas');
      if (!c) return { error: 'No canvas found' };
      const gl = c.getContext('webgl') || c.getContext('webgl2') || c.getContext('experimental-webgl');
      let nonZeroCount = 0;
      let totalPixels = 0;
      let sample = [];
      if (gl) {
        const pixels = new Uint8Array(c.width * c.height * 4);
        gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        totalPixels = c.width * c.height;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] !== 0 || pixels[i+1] !== 0 || pixels[i+2] !== 0) {
            nonZeroCount++;
            if (sample.length < 5) sample.push([pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]]);
          }
        }
      }
      return {
        width: c.width,
        height: c.height,
        hasGL: !!gl,
        totalPixels: totalPixels,
        nonZeroPixels: nonZeroCount,
        sample: sample,
        statusText: document.getElementById('emulator-status')?.innerText
      };
    })()`,
    returnByValue: true
  });

  console.log(`[${name}] Canvas Data:`, canvasData.result.value);

  ws.close();
  edgeProc.kill();
}

async function run() {
  await testPixels('http://localhost:3000/emulators?console=dendy-nes', 'nes');
  await wait(1000);
  await testPixels('http://localhost:3000/emulators?console=sega-mega-drive', 'genesis');
}

run().catch(console.error);
