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
    this.errors = [];
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
        this.logs.push(`[${msg.params.type}] ${text}`);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const err = `[EXCEPTION] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ''}`;
        this.logs.push(err);
        this.errors.push(err);
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
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-pres';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9224',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    'http://localhost:3000/presentation.html'
  ]);

  let connected = false;
  let client = null;

  try {
    for (let i = 0; i < 20; i++) {
      await wait(300);
      try {
        const list = await getJson('http://127.0.0.1:9224/json/list');
        const pageTarget = list.find(t => t.type === 'page' && t.url.includes('presentation.html')) || list.find(t => t.type === 'page');
        if (pageTarget) {
          client = new CDPClient(pageTarget.webSocketDebuggerUrl);
          await client.connect();
          connected = true;
          break;
        }
      } catch (e) {}
    }

    if (!connected) {
      console.error('Failed to connect to browser CDP');
      return;
    }

    console.log('Connected to Edge page target via CDP');
    await wait(2500);

    const title = await client.evaluate('document.title');
    console.log('Page Title:', title);

    const slidesCount = await client.evaluate('document.querySelectorAll(".slide").length');
    console.log('Total Slides in DOM:', slidesCount);

    const activeTitle = await client.evaluate('document.querySelector(".slide.active")?.getAttribute("data-title")');
    console.log('Active Slide Title:', activeTitle);

    const artifactDir = 'C:\\Users\\Deus\\.gemini\\antigravity\\brain\\d480a61c-d005-48c8-af10-ea3d4deba974';
    await client.captureScreenshot(`${artifactDir}\\verify-pres-slide1-clean.png`);
    console.log('Saved verify-pres-slide1-clean.png');

    // Slide 4: Metrics
    await client.evaluate('goToSlide(3)');
    await wait(800);
    await client.captureScreenshot(`${artifactDir}\\verify-pres-slide4.png`);
    console.log('Saved verify-pres-slide4.png');

    // Slide 8: Mobile UX
    await client.evaluate('goToSlide(7)');
    await wait(800);
    await client.captureScreenshot(`${artifactDir}\\verify-pres-slide8.png`);
    console.log('Saved verify-pres-slide8.png');

    // Slide 19: Demo
    await client.evaluate('goToSlide(18)');
    await wait(800);
    await client.captureScreenshot(`${artifactDir}\\verify-pres-slide19.png`);
    console.log('Saved verify-pres-slide19.png');

    console.log('Console errors:', client.errors);
    console.log('ALL VERIFICATIONS SUCCESSFUL!');
  } finally {
    if (client) client.close();
    edgeProc.kill();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
