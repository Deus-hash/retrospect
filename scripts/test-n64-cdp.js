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

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-2';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9223',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000/emulators?console=nintendo-64'
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9223/json/version');
      if (version) break;
    } catch(e) {}
  }
  console.log('Edge version:', version?.Browser);

  const list = await getJson('http://127.0.0.1:9223/json/list');
  console.log('Targets:', list.map(t => ({ type: t.type, url: t.url, title: t.title })));

  const pageTarget = list.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
  if (!pageTarget) {
    console.log('No page target found');
    edgeProc.kill();
    return;
  }

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
      console.log(`[CONSOLE ${msg.params.type}] ${text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log(`[EXCEPTION]`, msg.params.exceptionDetails);
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

  console.log('Waiting 3 seconds for load...');
  await wait(3000);

  console.log('Clicking start overlay / start button...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.getElementById('emulator-start-overlay');
      if (btn) btn.click();
      const s = document.querySelector('[data-action="start"]');
      if (s) s.click();
      return { overlayFound: !!btn, startFound: !!s };
    })()`,
    returnByValue: true
  });
  console.log('Click res:', clickRes.result.value);

  console.log('Waiting 5 seconds for emulator to run...');
  await wait(5000);

  const status = await send('Runtime.evaluate', {
    expression: `({
      status: document.getElementById('emulator-status')?.innerText,
      statusBoxDisplay: document.getElementById('emulator-status-box')?.style.display,
      canvasWidth: document.getElementById('retrospect-canvas')?.width,
      canvasHeight: document.getElementById('retrospect-canvas')?.height,
    })`,
    returnByValue: true
  });
  console.log('Status result:', status.result.value);

  ws.close();
  edgeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
