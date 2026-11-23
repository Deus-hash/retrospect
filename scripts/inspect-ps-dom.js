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

async function inspectPS() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = 'C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-inspect';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9226',
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000/emulators?console=playstation'
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      version = await getJson('http://127.0.0.1:9226/json/version');
      if (version) break;
    } catch(e) {}
  }

  const list = await getJson('http://127.0.0.1:9226/json/list');
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

  const domReport = await send('Runtime.evaluate', {
    expression: `(function() {
      const wrap = document.querySelector('.emulator__canvas-wrap');
      const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
        id: c.id,
        className: c.className,
        width: c.width,
        height: c.height,
        parent: c.parentElement ? c.parentElement.className : 'no-parent',
        style: c.getAttribute('style')
      }));
      return {
        wrapHTML: wrap ? wrap.innerHTML.substring(0, 300) : 'no wrap',
        canvases: canvases
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM Report:', JSON.stringify(domReport.result.value, null, 2));

  ws.close();
  edgeProc.kill();
}

inspectPS().catch(console.error);
