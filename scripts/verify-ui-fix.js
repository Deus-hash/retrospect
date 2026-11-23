const child_process = require('child_process');
const http = require('http');
const fs = require('fs');

async function capture() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = child_process.spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9227',
    '--user-data-dir=C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-check-ui',
    'http://localhost:3000/emulators?console=atari-2600'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  http.get('http://127.0.0.1:9227/json', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      try {
        const targets = JSON.parse(data);
        const wsUrl = targets[0].webSocketDebuggerUrl;
        const ws = new globalThis.WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
          ws.send(JSON.stringify({ id: 2, method: 'Emulation.setDeviceMetricsOverride', params: { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false } }));
          setTimeout(() => {
            ws.send(JSON.stringify({ id: 3, method: 'Page.captureScreenshot', params: { format: 'png' } }));
          }, 2000);
        };
        ws.onmessage = (event) => {
          const m = JSON.parse(event.data);
          if (m.id === 3 && m.result && m.result.data) {
            fs.writeFileSync('public/verify-atari-ui-now.png', Buffer.from(m.result.data, 'base64'));
            console.log('Saved public/verify-atari-ui-now.png successfully!');
            edge.kill();
            process.exit(0);
          }
        };
      } catch (e) {
        console.error('Error:', e);
        edge.kill();
        process.exit(1);
      }
    });
  }).on('error', err => {
    console.error('HTTP Error:', err);
    edge.kill();
    process.exit(1);
  });
}

capture();
