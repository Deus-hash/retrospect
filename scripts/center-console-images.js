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

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = `C:\\Users\\Deus\\Desktop\\Retrospect\\.edge-tmp-crop-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9396;
  const edgeProc = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    'http://localhost:3000'
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
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        calls.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Runtime.enable');

    const consolesDir = path.join(__dirname, '../public/images/consoles');
    const files = fs.readdirSync(consolesDir).filter(f => f.endsWith('.png'));

    for (const f of files) {
      const imgPath = `/images/consoles/${f}`;
      console.log(`Processing and centering ${f}...`);

      const res = await send('Runtime.evaluate', {
        expression: `
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);

              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imgData.data;
              let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

              for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                  const alpha = data[(y * canvas.width + x) * 4 + 3];
                  if (alpha > 15) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                  }
                }
              }

              if (minX > maxX || minY > maxY) {
                return resolve(null);
              }

              const cropW = maxX - minX + 1;
              const cropH = maxY - minY + 1;

              // Create a square canvas where the cropped icon is perfectly centered
              const targetSize = Math.max(cropW, cropH);
              const padding = Math.round(targetSize * 0.08); // 8% padding
              const finalSize = targetSize + padding * 2;

              const outCanvas = document.createElement('canvas');
              outCanvas.width = finalSize;
              outCanvas.height = finalSize;
              const outCtx = outCanvas.getContext('2d');

              const drawX = Math.round((finalSize - cropW) / 2);
              const drawY = Math.round((finalSize - cropH) / 2);

              outCtx.drawImage(canvas, minX, minY, cropW, cropH, drawX, drawY, cropW, cropH);
              resolve({
                dataUrl: outCanvas.toDataURL('image/png'),
                orig: { w: img.width, h: img.height },
                crop: { minX, minY, cropW, cropH },
                finalSize
              });
            };
            img.onerror = () => resolve(null);
            img.src = '${imgPath}?t=' + Date.now();
          })
        `,
        awaitPromise: true,
        returnByValue: true
      });

      const result = res.result && res.result.value;
      if (result && result.dataUrl) {
        const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
        const targetPath = path.join(consolesDir, f);
        fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
        console.log(`[CENTERED] ${f}: cropped from ${result.crop.cropW}x${result.crop.cropH} into centered ${result.finalSize}x${result.finalSize} canvas`);
      } else {
        console.warn(`[SKIP] Could not center ${f}`);
      }
    }

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
