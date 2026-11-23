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

async function debugUrl(url) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-debug';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9225',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--no-first-run',
    '--no-default-browser-check',
    url
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9225/json/version');
      if (version) break;
    } catch(e) {}
  }

  const list = await getJson('http://127.0.0.1:9225/json/list');
  const pageTarget = list.find(t => t.type === 'page');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const calls = new Map();
  const allLogs = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && calls.has(msg.id)) {
      const { resolve, reject } = calls.get(msg.id);
      calls.delete(msg.id);
      if (msg.error) reject(msg.error); else resolve(msg.result);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value) : (a.description || '')).join(' ');
      allLogs.push(`[${msg.params.type}] ${text}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      allLogs.push(`[EXCEPTION] ${JSON.stringify(msg.params.exceptionDetails)}`);
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

  console.log('Waiting 6 seconds...');
  await wait(6000);

  const canvasInfo = await send('Runtime.evaluate', {
    expression: `(function() {
      const c = document.getElementById('retrospect-canvas');
      const box = document.getElementById('emulator-status-box');
      const st = document.getElementById('emulator-status');
      return {
        exists: !!c,
        w: c ? c.width : null,
        h: c ? c.height : null,
        statusText: st ? st.innerText : null,
        boxVisible: box ? box.style.display : null,
        nostalgist: typeof window.Nostalgist,
        nostalgistError: window.lastNostalgistError || null
      };
    })()`,
    returnByValue: true
  });

  console.log('Canvas Info:', canvasInfo.result.value);
  console.log('All Logs:\n' + allLogs.join('\n'));

  ws.close();
  edgeProc.kill();
}

debugUrl('http://localhost:3000/emulators?console=playstation').catch(console.error);
