const fs = require('fs');
const path = require('path');

const presPath = path.join(__dirname, '..', 'public', 'presentation.html');
const qrSvgPath = path.join(__dirname, '..', 'public', 'images', 'qr-retrospect-live.svg');

let presHtml = fs.readFileSync(presPath, 'utf8');
let qrSvg = fs.readFileSync(qrSvgPath, 'utf8');

// Strip XML header from SVG for inline embedding
qrSvg = qrSvg.replace(/<\?xml[\s\S]*?\?>\s*/i, '');
qrSvg = qrSvg.replace(/<!--[\s\S]*?-->\s*/gi, '');
qrSvg = qrSvg.replace(/width="250"/, 'width="210"');
qrSvg = qrSvg.replace(/height="250"/, 'height="210"');
qrSvg = qrSvg.replace('<svg ', '<svg shape-rendering="crispEdges" aria-label="QR-код для перехода на сайт Retrospect" style="display:block; border-radius:4px; background:#fff; padding:6px; box-sizing:border-box;" ');

// New QR block with link and real SVG
const newQrBlock = `          <div style="display:flex; flex-direction:column; align-items:center; gap:12px;" data-stagger="card-2">
            <a href="https://retrospect-production-581108da.up.railway.app" target="_blank" rel="noopener" class="qr-box" id="qr-card" title="Нажмите, чтобы открыть сайт Retrospect" style="text-decoration:none; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
              ${qrSvg.trim()}
              <div class="qr-caption" style="margin-top:8px;">SCAN TO OPEN PLATFORM</div>
            </a>
            <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-align:center;">
              <a href="https://retrospect-production-581108da.up.railway.app" target="_blank" rel="noopener" style="color:var(--cyan); text-decoration:none; border-bottom:1px dashed var(--cyan);">
                retrospect-production-581108da.up.railway.app
              </a>
            </div>
            <div style="font-family:var(--font-mono); font-size:11px; color:#8fa0c9;">
              WASMsandbox · 60 FPS · Zero-Install
            </div>
          </div>`;

// Replace previous qr-card block
const qrRegex = /<div style="display:flex; flex-direction:column; align-items:center; gap:12px;" data-stagger="card-2">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/;

if (!qrRegex.test(presHtml)) {
  console.error('Could not find QR card block in presentation.html');
  process.exit(1);
}

presHtml = presHtml.replace(qrRegex, newQrBlock + '\n        </div>\n      </div>\n    </section>');

// Update button on the left to also offer opening the live site
const oldBtnRegex = /<div data-stagger="action" style="display:flex; flex-wrap:wrap; gap:12px;">\s*<button class="cyber-btn lime" id="btn-launch-demo">[\s\S]*?<\/button>\s*<\/div>/;

const newActionBlock = `<div data-stagger="action" style="display:flex; flex-wrap:wrap; gap:12px;">
              <a href="https://retrospect-production-581108da.up.railway.app" target="_blank" rel="noopener" class="cyber-btn lime" style="text-decoration:none;">
                <svg class="svg-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                ОТКРЫТЬ САЙТ RETROSPECT
              </a>
              <button class="cyber-btn" id="btn-launch-demo" style="background:rgba(0,240,255,0.1); border-color:var(--cyan); color:var(--cyan);">
                <svg class="svg-sm" viewBox="0 0 24 24"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="4"/></svg>
                ИНТЕРАКТИВНОЕ LIVE DEMO
              </button>
            </div>`;

presHtml = presHtml.replace(oldBtnRegex, newActionBlock);

// Remove qr-card click listener that hijacked click to open demo instead of following link
presHtml = presHtml.replace("document.getElementById('qr-card').addEventListener('click', openDemo);", "// qr-card links directly to live site");

fs.writeFileSync(presPath, presHtml, 'utf8');
console.log('Successfully updated presentation.html with live scannable QR code!');
