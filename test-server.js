const http = require('http');
const mongoose = require('mongoose');
const config = require('./src/config');
const app = require('./server');

function checkServerOnline(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/stats`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function testRoutes() {
  console.log('=== Starting Retrospect Comprehensive End-to-End Test Suite ===\n');

  let serverInstance = null;
  const isOnline = await checkServerOnline(config.port);

  if (!isOnline) {
    console.log(`Starting local test server on port ${config.port}...`);
    await mongoose.connect(config.mongodbUri);
    await new Promise((resolve) => {
      serverInstance = app.listen(config.port, () => {
        console.log(`Test server running on port ${config.port}`);
        resolve();
      });
    });
  } else {
    console.log(`Server already running on port ${config.port}. Running tests against active instance.`);
  }

  const routes = [
    // 1. Core pages
    { path: '/', expectStatus: 200, checkBody: 'Retrospect' },
    { path: '/emulators', expectStatus: 200, checkBody: 'Лаборатория веб-эмуляции' },
    { path: '/emulators?console=dendy-nes', expectStatus: 200, checkBody: 'dendy-nes' },
    { path: '/emulators?console=sega-mega-drive', expectStatus: 200, checkBody: 'genesis_plus_gx' },
    { path: '/emulators?console=snes', expectStatus: 200, checkBody: 'snes9x' },
    { path: '/emulators?console=sega-master-system', expectStatus: 200, checkBody: 'genesis_plus_gx' },
    { path: '/emulators?console=atari-2600', expectStatus: 200, checkBody: 'stella2014' },
    { path: '/emulators?console=pc-engine', expectStatus: 200, checkBody: 'beetle_pce_fast' },
    { path: '/emulators?console=nintendo-64', expectStatus: 200, checkBody: 'parallel_n64' },
    { path: '/emulators?console=playstation', expectStatus: 200, checkBody: 'pcsx_rearmed' },
    { path: '/emulators?console=playstation', expectStatus: 200, checkBody: 'touch-btn--r2' },
    { path: '/emulators?console=playstation', expectStatus: 200, checkBody: 'emulator-landscape-exit' },
    { path: '/emulators?console=playstation', expectStatus: 200, checkBody: 'unified-emulator.js?v=4.0' },
    { path: '/emulators?console=playstation', expectStatus: 200, checkBody: 'emulator.css?v=4.0' },
    { path: '/emulators?console=sega-saturn', expectStatus: 200, checkBody: 'yabause' },
    { path: '/legal', expectStatus: 200, checkBody: 'Используемые технологии' },
    { path: '/about', expectStatus: 200, checkBody: 'Retrospect' },
    { path: '/accessories', expectStatus: 200, checkBody: 'Аксессуары' },

    // 2. All 9 Consoles
    { path: '/consoles', expectStatus: 200, checkBody: 'Консоли' },
    { path: '/consoles/dendy-nes', expectStatus: 200, checkBody: 'Dendy' },
    { path: '/consoles/sega-master-system', expectStatus: 200, checkBody: 'Master System' },
    { path: '/consoles/atari-2600', expectStatus: 200, checkBody: 'Atari 2600' },
    { path: '/consoles/sega-mega-drive', expectStatus: 200, checkBody: 'Mega Drive' },
    { path: '/consoles/snes', expectStatus: 200, checkBody: 'Super Nintendo' },
    { path: '/consoles/pc-engine', expectStatus: 200, checkBody: 'PC Engine' },
    { path: '/consoles/playstation', expectStatus: 200, checkBody: 'PlayStation' },
    { path: '/consoles/sega-saturn', expectStatus: 200, checkBody: 'Sega Saturn' },
    { path: '/consoles/nintendo-64', expectStatus: 200, checkBody: 'Nintendo 64' },

    // 3. Games catalog & filtering
    { path: '/games', expectStatus: 200, checkBody: 'Каталог игр' },
    { path: '/games?page=2', expectStatus: 200, checkBody: 'pagination' },
    { path: '/games?playable=1', expectStatus: 200, checkBody: 'Только играбельные онлайн' },
    { path: '/games?console=dendy-nes&playable=1', expectStatus: 200, checkBody: 'Dendy' },
    { path: '/games?genre=Платформер', expectStatus: 200, checkBody: 'Платформер' },

    // 4. Game Detail Pages
    { path: '/games/dendy-nes-2048-nes', expectStatus: 200, checkBody: '2048 NES' },
    { path: '/games/dendy-nes-cheril-the-goddess', expectStatus: 200, checkBody: 'Cheril the Goddess' },
    { path: '/games/sega-mega-drive-bomb-x', expectStatus: 200, checkBody: 'Bomb X' },
    { path: '/games/snes-blt-bacon-lettuce-tomato', expectStatus: 200, checkBody: 'Bacon Lettuce Tomato' },
    { path: '/games/sega-master-system-3d-city', expectStatus: 200, checkBody: '3D City' },
    { path: '/games/atari-2600-anguna-scourge-of-the-goblin-king', expectStatus: 200, checkBody: 'Anguna' },
    { path: '/games/atari-2600-halo-2600', expectStatus: 200, checkBody: 'Halo 2600' },
    { path: '/games/nintendo-64-twintris-64', expectStatus: 200, checkBody: 'X / K / B — B' },
    { path: '/games/playstation-voxide-ps1', expectStatus: 200, checkBody: 'VoXide (PS1)' },
    { path: '/games/playstation-voxide-ps1', expectStatus: 200, checkBody: 'R/F — L2/R2' },
    { path: '/games/playstation-takatron-2084', expectStatus: 200, checkBody: 'Takatron 2084' },
    { path: '/games/playstation-tetrade', expectStatus: 200, checkBody: 'Tetrade' },
    { path: '/games/dendy-nes-action-53-volume-1-function-16', expectStatus: 200, checkBody: 'Action 53' },
    { path: '/games/sega-mega-drive-tanglewood-demo', expectStatus: 200, checkBody: 'Tanglewood' },
    { path: '/games/sega-saturn-celeste-classic-saturn-port', expectStatus: 200, checkBody: 'Celeste Classic' },
    { path: '/games/dendy-nes-super-mario-bros', expectStatus: 200, checkBody: 'Энциклопедическая запись' },

    // 5. Search queries & Sanitization
    { path: '/search?q=mario', expectStatus: 200, checkBody: 'Mario' },
    { path: '/search?q=sonic', expectStatus: 200, checkBody: 'Sonic' },
    { path: '/search?q=halo', expectStatus: 200, checkBody: 'Halo 2600' },
    { path: '/search?q=twintris', expectStatus: 200, checkBody: 'Twintris' },
    { path: '/search?q=takatron', expectStatus: 200, checkBody: 'Takatron' },
    { path: '/search?q=2048', expectStatus: 200, checkBody: '2048' },
    { path: '/search?q=тетрис', expectStatus: 200, checkBody: 'Результаты' },
    { path: '/search?q=test(brackets)+*regex[0-9]', expectStatus: 200, checkBody: 'Результаты' },

    // 6. REST API
    { path: '/api/games', expectStatus: 200, checkContentType: 'json' },
    { path: '/api/consoles', expectStatus: 200, checkContentType: 'json' },
    { path: '/api/accessories', expectStatus: 200, checkContentType: 'json' },
    { path: '/api/stats', expectStatus: 200, checkContentType: 'json' },

    // 7. Static ROM Downloads & MIME Types
    { path: '/roms/nes/cheril-the-goddess.nes', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/nes/invaders.nes', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/megadrive/bombx.bin', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/megadrive/rickdangerous2.bin', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/snes/blt.sfc', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/mastersystem/3dcity.sms', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/mastersystem/colossalcaveadventure.sms', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/atari2600/anguna.bin', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/atari2600/halo2600.bin', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/pcengine/gamelife.pce', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/pcengine/starwave.pce', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/n64/twintris.z64', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/playstation/takatron.exe', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/playstation/tetrade.cue', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/playstation/rocksngems.exe', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/saturn/celeste.cue', expectStatus: 200, checkMime: 'application/octet-stream' },
    { path: '/roms/snes/pushstart.sfc', expectStatus: 200, checkMime: 'application/octet-stream' },

    // 8. 404 Error handling
    { path: '/non-existent-page-test-404', expectStatus: 404, checkBody: 'не найдена' },
  ];

  let passed = 0;
  let failed = 0;

  for (const item of routes) {
    await new Promise((resolve) => {
      const url = `http://localhost:${config.port}${item.path}`;
      const encodedUrl = encodeURI(url);
      http.get(encodedUrl, (res) => {
        let rawData = '';
        res.on('data', chunk => { rawData += chunk; });
        res.on('end', () => {
          let testOk = true;
          const reasons = [];

          if (res.statusCode !== item.expectStatus) {
            testOk = false;
            reasons.push(`Status expected ${item.expectStatus}, got ${res.statusCode}`);
          }

          if (item.checkContentType === 'json' && !res.headers['content-type']?.includes('application/json')) {
            testOk = false;
            reasons.push(`Expected JSON content-type, got ${res.headers['content-type']}`);
          }

          if (item.checkMime && !res.headers['content-type']?.includes(item.checkMime)) {
            testOk = false;
            reasons.push(`Expected MIME ${item.checkMime}, got ${res.headers['content-type']}`);
          }

          if (item.checkBody && !rawData.includes(item.checkBody)) {
            testOk = false;
            reasons.push(`Expected body to include "${item.checkBody}"`);
          }

          if (testOk) {
            console.log(`[PASS] ${res.statusCode} ${item.path}`);
            passed++;
          } else {
            console.error(`[FAIL] ${item.path}: ${reasons.join(', ')}`);
            failed++;
          }
          resolve();
        });
      }).on('error', (err) => {
        console.error(`[ERROR] ${item.path}:`, err.message);
        failed++;
        resolve();
      });
    });
  }

  console.log(`\n======================================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed out of ${routes.length} tests.`);
  console.log(`======================================================\n`);

  if (serverInstance) {
    serverInstance.close();
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

testRoutes().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
