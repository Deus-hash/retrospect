const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.logs = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        this.logs.push(`[CONSOLE ${msg.params.type}] ${text}`);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.logs.push(`[EXCEPTION] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ''}`);
      }
    };

    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result ? res.result.value : null;
  }

  async captureScreenshot(path) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path, Buffer.from(res.data, 'base64'));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9222',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required'
  ]);

  let connected = false;
  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9222/json/version');
      if (version) { connected = true; break; }
    } catch (e) {}
  }

  if (!connected) {
    console.error('Failed to connect to Edge remote debugging port 9222');
    edgeProc.kill();
    return;
  }

  console.log('Connected to Edge CDP:', version['Browser']);

  const targets = await getJson('http://127.0.0.1:9222/json/list');
  let target = targets[0];
  if (!target) {
    const newTab = await getJson('http://127.0.0.1:9222/json/new');
    target = newTab;
  }

  const cdp = new CDPClient(target.webSocketDebuggerUrl);
  await cdp.connect();

  console.log('\n--- 1. Testing PlayStation ---');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/emulators?console=playstation' });
  await wait(3000);

  // Click start overlay if present
  console.log('Checking status and clicking start...');
  const psStatus1 = await cdp.evaluate(`document.getElementById('emulator-status')?.innerText || ''`);
  console.log('PS Status before click:', psStatus1);

  await cdp.evaluate(`
    (function() {
      const btn = document.getElementById('emulator-start-overlay');
      if (btn) btn.click();
      const startBtn = document.querySelector('[data-action="start"]');
      if (startBtn) startBtn.click();
    })()
  `);
  await wait(4000);

  const psStatus2 = await cdp.evaluate(`document.getElementById('emulator-status')?.innerText || ''`);
  console.log('PS Status after click:', psStatus2);
  const psCanvasDim = await cdp.evaluate(`
    (function() {
      const c = document.getElementById('retrospect-canvas');
      return c ? { w: c.width, h: c.height, styleW: c.style.width, styleH: c.style.height } : null;
    })()
  `);
  console.log('PS Canvas dimensions:', psCanvasDim);

  await cdp.captureScreenshot('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\test-ps.png');
  console.log('Captured PS screenshot to public/test-ps.png');

  console.log('\n--- 2. Testing Nintendo 64 ---');
  cdp.logs = [];
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/emulators?console=nintendo-64' });
  await wait(3000);

  const n64Status1 = await cdp.evaluate(`document.getElementById('emulator-status')?.innerText || ''`);
  console.log('N64 Status before click:', n64Status1);

  await cdp.evaluate(`
    (function() {
      const btn = document.getElementById('emulator-start-overlay');
      if (btn) btn.click();
      const startBtn = document.querySelector('[data-action="start"]');
      if (startBtn) startBtn.click();
    })()
  `);
  await wait(4000);

  const n64Status2 = await cdp.evaluate(`document.getElementById('emulator-status')?.innerText || ''`);
  console.log('N64 Status after click:', n64Status2);
  const n64CanvasDim = await cdp.evaluate(`
    (function() {
      const c = document.getElementById('retrospect-canvas');
      return c ? { w: c.width, h: c.height, styleW: c.style.width, styleH: c.style.height } : null;
    })()
  `);
  console.log('N64 Canvas dimensions:', n64CanvasDim);

  await cdp.captureScreenshot('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\test-n64.png');
  console.log('Captured N64 screenshot to public/test-n64.png');

  console.log('\n--- Recent Logs ---');
  console.log(cdp.logs.slice(-30).join('\n'));

  cdp.close();
  edgeProc.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
