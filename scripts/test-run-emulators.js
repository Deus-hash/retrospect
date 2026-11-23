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

async function testUrl(url, testName) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-test';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9224',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    url
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9224/json/version');
      if (version) break;
    } catch(e) {}
  }

  const list = await getJson('http://127.0.0.1:9224/json/list');
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
      const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
      logs.push(`[CONSOLE ${msg.params.type}] ${text}`);
      console.log(`[${testName} CONSOLE]`, text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log(`[${testName} EXCEPTION]`, msg.params.exceptionDetails);
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

  await wait(4000);

  const status = await send('Runtime.evaluate', {
    expression: `({
      status: document.getElementById('emulator-status')?.innerText,
      statusBoxDisplay: document.getElementById('emulator-status-box')?.style.display,
      canvasWidth: document.getElementById('retrospect-canvas')?.width,
      canvasHeight: document.getElementById('retrospect-canvas')?.height,
      overlayDisplay: document.getElementById('emulator-start-overlay')?.style.display
    })`,
    returnByValue: true
  });
  console.log(`[${testName}] Initial Status:`, status.result.value);

  // If overlay is visible, click it
  await send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.getElementById('emulator-start-overlay');
      if (btn) btn.click();
    })()`
  });

  await wait(4000);

  const statusAfterClick = await send('Runtime.evaluate', {
    expression: `({
      status: document.getElementById('emulator-status')?.innerText,
      statusBoxDisplay: document.getElementById('emulator-status-box')?.style.display,
      canvasWidth: document.getElementById('retrospect-canvas')?.width,
      canvasHeight: document.getElementById('retrospect-canvas')?.height,
      overlayDisplay: document.getElementById('emulator-start-overlay')?.style.display
    })`,
    returnByValue: true
  });
  console.log(`[${testName}] After click:`, statusAfterClick.result.value);

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:\\Users\\Deus\\Desktop\\Retrospect\\public\\screenshot-${testName}.png`, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screenshot C:\\Users\\Deus\\Desktop\\Retrospect\\public\\screenshot-${testName}.png`);

  ws.close();
  edgeProc.kill();
}

async function run() {
  console.log('=== TEST 1: PS1 ===');
  await testUrl('http://localhost:3000/emulators?console=playstation', 'ps1');
  await wait(2000);
  console.log('\n=== TEST 2: N64 Pong 64 ===');
  await testUrl('http://localhost:3000/emulators?console=nintendo-64&game=nintendo-64-pong-64', 'n64-pong');
  process.exit(0);
}

run().catch(console.error);
