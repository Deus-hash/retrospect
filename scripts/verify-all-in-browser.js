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

async function verify() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-verify-final`;
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9488;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,1000',
    'http://localhost:3000/emulators?console=playstation'
  ]);

  try {
    let version = null;
    for (let i = 0; i < 25; i++) {
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
    const consoleLogs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        consoleLogs.push(text);
        console.log('[Browser Console]', text);
      }
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

    console.log('1. Verifying /emulators?console=playstation...');
    await wait(3000);

    // Click start or autoplay
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = document.querySelector('.emulator__start-overlay-btn') || document.querySelector('[data-action="start"]');
          if (btn) btn.click();
        })()
      `
    });

    console.log('Waiting 8s for PlayStation 3D demo to initialize and render...');
    await wait(8000);

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\final-verify-ps1-running.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved final-verify-ps1-running.png');

    // Scroll to see game cards on PlayStation page
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 650);` });
    await wait(1000);
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\final-verify-ps1-cards.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved final-verify-ps1-cards.png');

    // 2. Navigate to /emulators?console=atari-2600
    console.log('2. Verifying /emulators?console=atari-2600...');
    await send('Page.navigate', { url: 'http://localhost:3000/emulators?console=atari-2600' });
    await wait(3000);
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 650);` });
    await wait(1000);
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\final-verify-atari-cards.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved final-verify-atari-cards.png');

    // 3. Navigate to /games?console=playstation
    console.log('3. Verifying /games?console=playstation...');
    await send('Page.navigate', { url: 'http://localhost:3000/games?console=playstation' });
    await wait(3000);
    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Deus\\Desktop\\Retrospect\\public\\final-verify-games-catalog.png', Buffer.from(shot4.data, 'base64'));
    console.log('Saved final-verify-games-catalog.png');

    console.log('All verification screenshots captured successfully!');
    ws.close();
  } finally {
    edgeProc.kill();
  }
}

verify().catch(console.error);
