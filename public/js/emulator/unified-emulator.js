/**
 * Retrospect — Универсальный эмулятор ретро-систем
 * Поддерживает 9 консолей (NES, SMS, Atari 2600, Mega Drive, SNES, PC Engine, PS1, N64, Saturn)
 * На базе Nostalgist.js (Libretro WebAssembly) и локального JSNES (офлайн-фолбэк).
 * С поддержкой WASD, геймпадов (Gamepad API) и аппаратного ускорения.
 */

(function() {
  'use strict';

  var emulatorEl = document.querySelector('.emulator');
  if (!emulatorEl) return;

  var consoleSlug = emulatorEl.dataset.console || 'dendy-nes';
  var initialRomFile = emulatorEl.dataset.rom;
  if (initialRomFile === 'null' || initialRomFile === 'undefined') initialRomFile = null;

  var canvas = document.getElementById('retrospect-canvas');
  var statusText = document.getElementById('emulator-status');
  var statusBox = document.getElementById('emulator-status-box');
  var dropzone = document.getElementById('emulator-dropzone');
  var fileInput = document.getElementById('emulator-file-input');
  var canvasWrap = document.querySelector('.emulator__canvas-wrap');
  var touchGamepad = document.getElementById('emulator-touch-gamepad');
  var gamepadStatusIndicator = document.getElementById('gamepad-status-indicator');

  var currentInstance = null;
  var isRunning = false;
  var isPaused = false;
  var isMuted = false;
  var currentRomSource = initialRomFile;
  var isCrtActive = false;
  var jsnesInstance = null;

  // Карта ядер Libretro для всех консолей
  var CORE_MAP = {
    'dendy-nes': 'fceumm',
    'sega-master-system': 'genesis_plus_gx',
    'atari-2600': 'stella2014',
    'sega-mega-drive': 'genesis_plus_gx',
    'snes': 'snes9x',
    'pc-engine': 'mednafen_pce_fast',
    'playstation': 'pcsx_rearmed',
    'sega-saturn': 'yabause',
    'nintendo-64': 'parallel_n64',
  };

  function setStatus(msg, isError) {
    if (!statusText) return;
    statusText.textContent = msg;
    if (statusBox) {
      statusBox.style.display = msg ? 'block' : 'none';
      if (isError) statusBox.classList.add('emulator__status--error');
      else statusBox.classList.remove('emulator__status--error');
    }
  }

  // Запуск через Nostalgist
  async function launchWithNostalgist(romDataOrUrl) {
    var core = CORE_MAP[consoleSlug] || 'fceumm';
    var startOverlay = document.getElementById('emulator-start-overlay');
    if (startOverlay) startOverlay.style.display = 'none';

    setStatus('Загрузка ядра эмуляции [' + core + ']...', false);

    if (currentInstance) {
      try {
        await currentInstance.exit({ removeCanvas: false });
      } catch (e) {
        console.warn('Exit previous instance:', e);
      }
      currentInstance = null;
    }

    var activeCanvas = document.getElementById('retrospect-canvas') || document.getElementById('canvas') || document.querySelector('.emulator__canvas-wrap canvas');
    if (!activeCanvas && canvasWrap) {
      activeCanvas = document.createElement('canvas');
      activeCanvas.id = 'retrospect-canvas';
      activeCanvas.className = 'emulator__canvas';
      activeCanvas.width = 640;
      activeCanvas.height = 480;
      canvasWrap.appendChild(activeCanvas);
    }
    canvas = activeCanvas;

    try {
      var romParam = romDataOrUrl;
      if (typeof romDataOrUrl === 'string' && romDataOrUrl.indexOf('://') === -1 && romDataOrUrl.indexOf('//') !== 0) {
        romParam = window.location.origin + romDataOrUrl;
      }

      // Универсальная поддержка образов дисков (.cue + .bin tracks) для PlayStation, Sega Saturn и PC Engine CD
      if (typeof romParam === 'string' && /\.cue(\?.*)?$/i.test(romParam)) {
        try {
          var cueResp = await fetch(romParam);
          if (cueResp.ok) {
            var cueText = await cueResp.text();
            var baseDir = romParam.substring(0, romParam.lastIndexOf('/') + 1);
            var files = [romParam];
            var fileRe = /FILE\s+"([^"]+)"/gi;
            var match;
            while ((match = fileRe.exec(cueText)) !== null) {
              var binUrl = baseDir + encodeURIComponent(match[1]).replace(/%2F/gi, '/');
              if (files.indexOf(binUrl) === -1) {
                files.push(binUrl);
              }
            }
            if (files.length > 1) {
              romParam = files;
            }
          }
        } catch (cueErr) {
          console.warn('CUE parse error:', cueErr);
        }
      }

      setStatus('Инициализация виртуальной консоли...', false);

      var raConfig = {
        video_allow_rotate: false,
        audio_enable: true,
      };
      var raCoreConfig = {};
      if (consoleSlug === 'nintendo-64') {
        // N64: Control Stick + D-Pad via Arrows/WASD; Z/J=A, X/K/B=B, Space=Z-Trigger, Q/E=L/R, T/G/F/H=C-Buttons
        raCoreConfig['parallel-n64-alt-map'] = 'disabled';
        raConfig.input_player1_analog_dpad_mode = 0;
        raConfig.input_player1_l_y_minus = 'up';
        raConfig.input_player1_l_y_plus = 'down';
        raConfig.input_player1_l_x_minus = 'left';
        raConfig.input_player1_l_x_plus = 'right';
        raConfig.input_player1_up = 'up';
        raConfig.input_player1_down = 'down';
        raConfig.input_player1_left = 'left';
        raConfig.input_player1_right = 'right';
        raConfig.input_player1_b = 'z';
        raConfig.input_player1_y = 'x';
        raConfig.input_player1_a = 'nul';
        raConfig.input_player1_x = 'nul';
        raConfig.input_player1_l = 'q';
        raConfig.input_player1_r = 'e';
        raConfig.input_player1_l2 = 'space';
        raConfig.input_player1_r2 = 'nul';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
        raConfig.input_player1_r_y_minus = 't';
        raConfig.input_player1_r_y_plus = 'g';
        raConfig.input_player1_r_x_minus = 'f';
        raConfig.input_player1_r_x_plus = 'h';
      } else if (consoleSlug === 'playstation') {
        // PS1 DualShock (517): Arrows=D-Pad, WASD=Left Stick, IJKL=Right Stick, Z/X/C/V=✕/○/□/△, Q/E=L1/R1, R/F=L2/R2
        raConfig.input_libretro_device_p1 = 517;
        raConfig.input_player1_analog_dpad_mode = 0;
        raConfig.input_player1_up = 'up';
        raConfig.input_player1_down = 'down';
        raConfig.input_player1_left = 'left';
        raConfig.input_player1_right = 'right';
        raConfig.input_player1_l_y_minus = 'w';
        raConfig.input_player1_l_y_plus = 's';
        raConfig.input_player1_l_x_minus = 'a';
        raConfig.input_player1_l_x_plus = 'd';
        raConfig.input_player1_r_y_minus = 'i';
        raConfig.input_player1_r_y_plus = 'k';
        raConfig.input_player1_r_x_minus = 'j';
        raConfig.input_player1_r_x_plus = 'l';
        raConfig.input_player1_b = 'z';
        raConfig.input_player1_a = 'x';
        raConfig.input_player1_y = 'c';
        raConfig.input_player1_x = 'v';
        raConfig.input_player1_l = 'q';
        raConfig.input_player1_r = 'e';
        raConfig.input_player1_l2 = 'r';
        raConfig.input_player1_r2 = 'f';
        raConfig.input_player1_l3 = 'g';
        raConfig.input_player1_r3 = 'h';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
      } else if (consoleSlug === 'sega-saturn') {
        // Saturn 6-button + L/R: Z/X/C=A/B/C, A/S/D=X/Y/Z, Q/W=L/R, Enter=Start
        raConfig.input_player1_analog_dpad_mode = 1;
        raConfig.input_player1_b = 'z';
        raConfig.input_player1_a = 'x';
        raConfig.input_player1_r = 'c';
        raConfig.input_player1_y = 'a';
        raConfig.input_player1_x = 's';
        raConfig.input_player1_l = 'd';
        raConfig.input_player1_l2 = 'q';
        raConfig.input_player1_r2 = 'w';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
      } else if (consoleSlug === 'sega-mega-drive') {
        // Mega Drive 6-button: Z/X/C=A/B/C, A/S/D=X/Y/Z, Shift=Mode, Enter=Start
        raConfig.input_player1_y = 'z';
        raConfig.input_player1_b = 'x';
        raConfig.input_player1_a = 'c';
        raConfig.input_player1_l = 'a';
        raConfig.input_player1_x = 's';
        raConfig.input_player1_r = 'd';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
      } else if (consoleSlug === 'snes') {
        // SNES: Z/X=B/A, A/S=Y/X, Q/W=L/R, Enter=Start, Shift=Select
        raConfig.input_player1_b = 'z';
        raConfig.input_player1_a = 'x';
        raConfig.input_player1_y = 'a';
        raConfig.input_player1_x = 's';
        raConfig.input_player1_l = 'q';
        raConfig.input_player1_r = 'w';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
      }

      var launchOptions = {
        core: core,
        rom: romParam,
        element: canvas,
        respondToGlobalEvents: true,
        resolveRom: function(file) {
          return file;
        },
        resolveCoreJs: function(c) {
          return window.location.origin + '/cores/' + c + '_libretro.js';
        },
        resolveCoreWasm: function(c) {
          return window.location.origin + '/cores/' + c + '_libretro.wasm';
        },
        retroarchConfig: raConfig,
        retroarchCoreConfig: raCoreConfig,
      };

      currentInstance = await window.Nostalgist.launch(launchOptions);

      isRunning = true;
      isPaused = false;
      setStatus('', false);
      emulatorEl.classList.add('emulator--running');
      emulatorEl.classList.remove('emulator--paused');
      if (dropzone) dropzone.style.display = 'none';
      if (startOverlay) startOverlay.style.display = 'none';

      focusActiveCanvas();
      setTimeout(focusActiveCanvas, 150);
      setTimeout(focusActiveCanvas, 500);

      var startBtn = emulatorEl.querySelector('[data-action="start"]');
      if (startBtn) startBtn.textContent = 'Перезапуск';

    } catch (err) {
      console.error('Nostalgist error:', err);
      if (startOverlay && !isRunning) startOverlay.style.display = 'flex';
      // Если это NES, пробуем локальный JSNES фолбэк
      if (consoleSlug === 'dendy-nes' && typeof window.jsnes !== 'undefined') {
        setStatus('WASM ядро недоступно, запуск локального JS-движка...', false);
        launchWithJsnes(romDataOrUrl);
      } else {
        setStatus('Ошибка эмулятора: ' + (err.message || 'Не удалось загрузить ядро'), true);
      }
    }
  }

  // Локальный офлайн-фолбэк JSNES для Dendy/NES
  function launchWithJsnes(romDataOrUrl) {
    try {
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var nes = new window.jsnes.NES({
        onFrame: function(framebuffer_24) {
          var img = ctx.getImageData(0, 0, 256, 240);
          var u32 = new Uint32Array(img.data.buffer);
          for (var i = 0; i < 256 * 240; i++) {
            u32[i] = 0xFF000000 | framebuffer_24[i];
          }
          ctx.putImageData(img, 0, 0);
        },
        onStatusUpdate: function(s) { console.log('JSNES:', s); },
      });
      jsnesInstance = nes;

      function runRom(binaryString) {
        nes.loadROM(binaryString);
        isRunning = true;
        setStatus('', false);
        emulatorEl.classList.add('emulator--running');
        if (dropzone) dropzone.style.display = 'none';

        function step() {
          if (isRunning && !isPaused) {
            nes.frame();
          }
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);

        // Привязка клавиш NES (Arrows + WASD + ZX + JK)
        window.addEventListener('keydown', function(e) {
          var keyMap = {
            38: [1, jsnes.Controller.BUTTON_UP],
            87: [1, jsnes.Controller.BUTTON_UP],    // W
            40: [1, jsnes.Controller.BUTTON_DOWN],
            83: [1, jsnes.Controller.BUTTON_DOWN],  // S
            37: [1, jsnes.Controller.BUTTON_LEFT],
            65: [1, jsnes.Controller.BUTTON_LEFT],  // A
            39: [1, jsnes.Controller.BUTTON_RIGHT],
            68: [1, jsnes.Controller.BUTTON_RIGHT], // D
            90: [1, jsnes.Controller.BUTTON_A],     // Z
            74: [1, jsnes.Controller.BUTTON_A],     // J
            88: [1, jsnes.Controller.BUTTON_B],     // X
            75: [1, jsnes.Controller.BUTTON_B],     // K
            13: [1, jsnes.Controller.BUTTON_START], // Enter
            16: [1, jsnes.Controller.BUTTON_SELECT], // Shift
          };
          if (keyMap[e.keyCode]) {
            nes.buttonDown(keyMap[e.keyCode][0], keyMap[e.keyCode][1]);
            e.preventDefault();
          }
        });

        window.addEventListener('keyup', function(e) {
          var keyMap = {
            38: [1, jsnes.Controller.BUTTON_UP],
            87: [1, jsnes.Controller.BUTTON_UP],    // W
            40: [1, jsnes.Controller.BUTTON_DOWN],
            83: [1, jsnes.Controller.BUTTON_DOWN],  // S
            37: [1, jsnes.Controller.BUTTON_LEFT],
            65: [1, jsnes.Controller.BUTTON_LEFT],  // A
            39: [1, jsnes.Controller.BUTTON_RIGHT],
            68: [1, jsnes.Controller.BUTTON_RIGHT], // D
            90: [1, jsnes.Controller.BUTTON_A],     // Z
            74: [1, jsnes.Controller.BUTTON_A],     // J
            88: [1, jsnes.Controller.BUTTON_B],     // X
            75: [1, jsnes.Controller.BUTTON_B],     // K
            13: [1, jsnes.Controller.BUTTON_START],
            16: [1, jsnes.Controller.BUTTON_SELECT],
          };
          if (keyMap[e.keyCode]) {
            nes.buttonUp(keyMap[e.keyCode][0], keyMap[e.keyCode][1]);
            e.preventDefault();
          }
        });
      }

      if (typeof romDataOrUrl === 'string') {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', romDataOrUrl, true);
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
        xhr.onload = function() {
          if (xhr.status === 200) runRom(xhr.responseText);
          else setStatus('Не удалось скачать ROM файл', true);
        };
        xhr.onerror = function() { setStatus('Ошибка сети', true); };
        xhr.send();
      } else if (romDataOrUrl instanceof Blob) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var bytes = new Uint8Array(e.target.result);
          var binary = '';
          for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          runRom(binary);
        };
        reader.readAsArrayBuffer(romDataOrUrl);
      }
    } catch (e) {
      console.error('JSNES error:', e);
      setStatus('Ошибка запуска эмулятора: ' + e.message, true);
    }
  }

  // Запуск ROM
  function startEmulator(rom) {
    if (!rom) {
      setStatus('Выберите ROM-файл для запуска', true);
      return;
    }
    currentRomSource = rom;
    launchWithNostalgist(rom);
  }

  // Пауза / Возобновление
  async function togglePause() {
    if (!currentInstance && !jsnesInstance) return;
    try {
      if (currentInstance) {
        if (!isPaused) {
          await currentInstance.pause();
          isPaused = true;
          emulatorEl.classList.add('emulator--paused');
        } else {
          await currentInstance.resume();
          isPaused = false;
          emulatorEl.classList.remove('emulator--paused');
        }
      } else {
        isPaused = !isPaused;
        emulatorEl.classList.toggle('emulator--paused', isPaused);
      }
    } catch (e) {
      console.error('Pause error:', e);
    }
  }

  // Звук Вкл / Выкл
  async function toggleMute() {
    if (!currentInstance) return;
    try {
      isMuted = !isMuted;
      var soundBtn = emulatorEl.querySelector('[data-action="sound"]');
      if (soundBtn) soundBtn.textContent = isMuted ? 'Вкл звук' : 'Звук';
      if (isMuted) {
        await currentInstance.setAudioVolume(0);
      } else {
        await currentInstance.setAudioVolume(1);
      }
    } catch (e) {
      console.warn('Audio toggle:', e);
    }
  }

  // Скриншот кадра
  async function takeScreenshot() {
    if (!canvas) return;
    try {
      var dataUrl = canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = (consoleSlug || 'game') + '-screenshot-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatus('Скриншот сохранён!', false);
      setTimeout(function() { if (isRunning && !isPaused) setStatus('', false); }, 2000);
    } catch (e) {
      console.error('Screenshot error:', e);
    }
  }

  // Переключение эффекта CRT
  function toggleCrt() {
    isCrtActive = !isCrtActive;
    if (canvasWrap) {
      canvasWrap.classList.toggle('emulator__canvas-wrap--crt', isCrtActive);
    }
    var crtBtn = emulatorEl.querySelector('[data-action="crt"]');
    if (crtBtn) crtBtn.classList.toggle('pixel-btn--active', isCrtActive);
  }

  // Перезапуск
  async function restartGame() {
    if (currentInstance) {
      try {
        await currentInstance.restart();
        isPaused = false;
        emulatorEl.classList.remove('emulator--paused');
      } catch (e) {
        console.error('Restart error:', e);
      }
    } else if (currentRomSource) {
      startEmulator(currentRomSource);
    }
  }

  // Обработка кнопок панели управления
  emulatorEl.querySelectorAll('[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      focusActiveCanvas();
      var action = this.dataset.action;
      if (action === 'start') {
        if (!isRunning) startEmulator(currentRomSource);
        else restartGame();
      } else if (action === 'pause') {
        togglePause();
      } else if (action === 'sound') {
        toggleMute();
      } else if (action === 'screenshot') {
        takeScreenshot();
      } else if (action === 'crt') {
        toggleCrt();
      } else if (action === 'fullscreen') {
        var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth <= 768;
        // На ПК во весь экран разворачиваем чистую область холста (canvasWrap) без экранных сенсорных кнопок.
        // На мобильных устройствах — контейнер viewport с сенсорным геймпадом.
        var elem;
        if (isTouchDevice && touchGamepad && touchGamepad.classList.contains('emulator__touch-gamepad--visible')) {
          elem = document.getElementById('emulator-viewport') || canvasWrap || canvas;
        } else {
          elem = canvasWrap || document.getElementById('emulator-viewport') || canvas;
        }

        var isFull = document.fullscreenElement || document.webkitFullscreenElement;
        if (!isFull) {
          if (elem && elem.requestFullscreen) {
            elem.requestFullscreen();
          } else if (elem && elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
        focusActiveCanvas();
      } else if (action === 'toggle-gamepad') {
        if (touchGamepad) {
          var nextVisible = !touchGamepad.classList.contains('emulator__touch-gamepad--visible');
          touchUserOverride = nextVisible;
          setTouchGamepadVisible(nextVisible);
          syncMobileLayout();
        }
        focusActiveCanvas();
      }
    });
  });

  function focusActiveCanvas() {
    var c = (currentInstance && currentInstance.getCanvas) ? currentInstance.getCanvas() : canvas;
    if (!c) c = document.getElementById('retrospect-canvas') || document.querySelector('.emulator__canvas-wrap canvas');
    if (c) {
      if (!c.getAttribute('tabindex')) c.setAttribute('tabindex', '0');
      try { c.focus(); } catch(e) {}
    }
  }

  // Профили раскладок сенсорного геймпада для каждой консоли (включая шифты, триггеры, C-кнопки и правый стик PS1)
  var TOUCH_PROFILES = {
    'dendy-nes': {
      actionsMode: '2btn',
      b: { label: 'B', code: 'KeyZ', key: 'z', codeNum: 90, jsnes: 'B' },
      a: { label: 'A', code: 'KeyX', key: 'x', codeNum: 88, jsnes: 'A' },
      select: { label: 'SELECT' },
      start: { label: 'START' },
    },
    'sega-master-system': {
      actionsMode: '2btn',
      b: { label: '1', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: '2', code: 'KeyX', key: 'x', codeNum: 88 },
      select: null,
      start: { label: 'PAUSE' },
    },
    'atari-2600': {
      actionsMode: '1btn',
      b: { label: 'FIRE', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: null,
      select: { label: 'SELECT' },
      start: { label: 'RESET' },
    },
    'pc-engine': {
      actionsMode: '2btn',
      b: { label: 'II', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: 'I', code: 'KeyX', key: 'x', codeNum: 88 },
      select: { label: 'SELECT' },
      start: { label: 'RUN' },
    },
    'snes': {
      actionsMode: '4btn',
      shoulders: {
        l: { label: 'L', code: 'KeyQ', key: 'q', codeNum: 81 },
        r: { label: 'R', code: 'KeyW', key: 'w', codeNum: 87 },
      },
      y: { label: 'Y', code: 'KeyA', key: 'a', codeNum: 65 },
      x: { label: 'X', code: 'KeyS', key: 's', codeNum: 83 },
      b: { label: 'B', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: 'A', code: 'KeyX', key: 'x', codeNum: 88 },
      select: { label: 'SELECT' },
      start: { label: 'START' },
    },
    'sega-mega-drive': {
      actionsMode: '6btn',
      y: { label: 'X', code: 'KeyA', key: 'a', codeNum: 65 },
      x: { label: 'Y', code: 'KeyS', key: 's', codeNum: 83 },
      z6: { label: 'Z', code: 'KeyD', key: 'd', codeNum: 68 },
      b: { label: 'A', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: 'B', code: 'KeyX', key: 'x', codeNum: 88 },
      c6: { label: 'C', code: 'KeyC', key: 'c', codeNum: 67 },
      select: { label: 'MODE' },
      start: { label: 'START' },
    },
    'sega-saturn': {
      actionsMode: '6btn',
      shoulders: {
        l: { label: 'L', code: 'KeyQ', key: 'q', codeNum: 81 },
        r: { label: 'R', code: 'KeyW', key: 'w', codeNum: 87 },
      },
      y: { label: 'X', code: 'KeyA', key: 'a', codeNum: 65 },
      x: { label: 'Y', code: 'KeyS', key: 's', codeNum: 83 },
      z6: { label: 'Z', code: 'KeyD', key: 'd', codeNum: 68 },
      b: { label: 'A', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: 'B', code: 'KeyX', key: 'x', codeNum: 88 },
      c6: { label: 'C', code: 'KeyC', key: 'c', codeNum: 67 },
      select: null,
      start: { label: 'START' },
    },
    'nintendo-64': {
      actionsMode: '2btn',
      shoulders: {
        l: { label: 'L', code: 'KeyQ', key: 'q', codeNum: 81 },
        l2: { label: 'Z', code: 'Space', key: ' ', codeNum: 32 },
        r: { label: 'R', code: 'KeyE', key: 'e', codeNum: 69 },
      },
      subpad: {
        center: 'C',
        up: { label: 'C▲', code: 'KeyT', key: 't', codeNum: 84 },
        left: { label: 'C◀', code: 'KeyF', key: 'f', codeNum: 70 },
        right: { label: 'C▶', code: 'KeyH', key: 'h', codeNum: 72 },
        down: { label: 'C▼', code: 'KeyG', key: 'g', codeNum: 71 },
      },
      b: { label: 'B', code: 'KeyX', key: 'x', codeNum: 88 },
      a: { label: 'A', code: 'KeyZ', key: 'z', codeNum: 90 },
      select: null,
      start: { label: 'START' },
    },
    'playstation': {
      actionsMode: '4btn',
      stickToggle: true,
      shoulders: {
        l: { label: 'L1', code: 'KeyQ', key: 'q', codeNum: 81 },
        l2: { label: 'L2', code: 'KeyR', key: 'r', codeNum: 82 },
        r2: { label: 'R2', code: 'KeyF', key: 'f', codeNum: 70 },
        r: { label: 'R1', code: 'KeyE', key: 'e', codeNum: 69 },
      },
      subpad: {
        center: 'RS',
        up: { label: '▲', code: 'KeyI', key: 'i', codeNum: 73 },
        left: { label: '◀', code: 'KeyJ', key: 'j', codeNum: 74 },
        right: { label: '▶', code: 'KeyL', key: 'l', codeNum: 76 },
        down: { label: '▼', code: 'KeyK', key: 'k', codeNum: 75 },
      },
      y: { label: '□', code: 'KeyC', key: 'c', codeNum: 67 },
      x: { label: '△', code: 'KeyV', key: 'v', codeNum: 86 },
      b: { label: '✕', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: '○', code: 'KeyX', key: 'x', codeNum: 88 },
      select: { label: 'SELECT' },
      start: { label: 'START' },
    },
  };

  var viewportEl = document.getElementById('emulator-viewport');
  var landscapeExitBtn = document.getElementById('emulator-landscape-exit');
  var touchUserOverride = null;
  var landscapeDismissed = false;
  var psxStickMode = false;

  function setTouchGamepadVisible(visible) {
    if (!touchGamepad) return;
    touchGamepad.classList.toggle('emulator__touch-gamepad--visible', !!visible);
    if (viewportEl) viewportEl.classList.toggle('emulator__viewport--touch-visible', !!visible);
    var touchToggleBtn = emulatorEl.querySelector('[data-action="toggle-gamepad"]');
    if (touchToggleBtn) touchToggleBtn.classList.toggle('pixel-btn--active', !!visible);
  }

  function isTouchEnvironment() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function isMobileLandscapeViewport() {
    if (window.innerWidth <= window.innerHeight) return false;
    var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (isCoarse) return window.innerHeight <= 820;
    return isTouchEnvironment() && window.innerHeight <= 540;
  }

  function syncMobileLayout() {
    if (!viewportEl) return;
    var mobileLandscape = isMobileLandscapeViewport();
    if (!mobileLandscape) {
      landscapeDismissed = false;
    }
    var activeSplit = mobileLandscape && !landscapeDismissed;
    viewportEl.classList.toggle('emulator__viewport--mobile-landscape', activeSplit);
    document.body.classList.toggle('emulator-landscape-active', activeSplit);
    if (landscapeExitBtn) {
      landscapeExitBtn.style.display = activeSplit ? 'inline-flex' : 'none';
    }
    if (touchGamepad) {
      if (activeSplit && touchUserOverride !== false) {
        setTouchGamepadVisible(true);
      } else if (!activeSplit && touchUserOverride === null) {
        setTouchGamepadVisible(window.innerWidth <= 768 || isTouchEnvironment());
      }
    }
  }

  if (landscapeExitBtn) {
    landscapeExitBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      landscapeDismissed = true;
      syncMobileLayout();
    });
  }

  window.addEventListener('resize', syncMobileLayout);
  window.addEventListener('orientationchange', function() {
    setTimeout(syncMobileLayout, 80);
    setTimeout(syncMobileLayout, 260);
  });
  if (window.screen && screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', syncMobileLayout);
  }
  if (window.matchMedia) {
    var landscapeMq = window.matchMedia('(orientation: landscape)');
    if (landscapeMq.addEventListener) landscapeMq.addEventListener('change', syncMobileLayout);
  }

  function configureSlotButton(slotName, spec) {
    if (!touchGamepad) return;
    var btn = touchGamepad.querySelector('[data-slot="' + slotName + '"]');
    if (!btn) return;
    if (!spec) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    if (spec.label) btn.textContent = spec.label;
    if (spec.code) btn.dataset.code = spec.code;
    if (spec.key) btn.dataset.key = spec.key;
    if (spec.codeNum) btn.dataset.codeNum = String(spec.codeNum);
    if (spec.jsnes) btn.dataset.jsnes = spec.jsnes;
    else delete btn.dataset.jsnes;
  }

  function applyTouchProfile() {
    if (!touchGamepad) return;
    var profile = TOUCH_PROFILES[consoleSlug] || TOUCH_PROFILES['snes'];

    var leftShoulders = touchGamepad.querySelector('.touch-shoulders--left');
    var rightShoulders = touchGamepad.querySelector('.touch-shoulders--right');
    var sh = profile.shoulders || null;
    configureSlotButton('l', sh && sh.l);
    configureSlotButton('l2', sh && sh.l2);
    configureSlotButton('r2', sh && sh.r2);
    configureSlotButton('r', sh && sh.r);
    if (leftShoulders) leftShoulders.style.display = (sh && (sh.l || sh.l2)) ? 'flex' : 'none';
    if (rightShoulders) rightShoulders.style.display = (sh && (sh.r || sh.r2)) ? 'flex' : 'none';

    var subpadEl = touchGamepad.querySelector('.touch-subpad');
    if (profile.subpad) {
      if (subpadEl) subpadEl.style.display = 'flex';
      var centerLabel = subpadEl && subpadEl.querySelector('.touch-subpad-center');
      if (centerLabel) centerLabel.textContent = profile.subpad.center || '';
      configureSlotButton('sub-up', profile.subpad.up);
      configureSlotButton('sub-left', profile.subpad.left);
      configureSlotButton('sub-right', profile.subpad.right);
      configureSlotButton('sub-down', profile.subpad.down);
    } else if (subpadEl) {
      subpadEl.style.display = 'none';
    }

    var actionsEl = touchGamepad.querySelector('.touch-actions');
    if (actionsEl) {
      actionsEl.classList.remove('touch-actions--1btn', 'touch-actions--2btn', 'touch-actions--4btn', 'touch-actions--6btn');
      actionsEl.classList.add('touch-actions--' + (profile.actionsMode || '4btn'));
    }
    configureSlotButton('y', profile.y);
    configureSlotButton('x', profile.x);
    configureSlotButton('z6', profile.z6);
    configureSlotButton('b', profile.b);
    configureSlotButton('a', profile.a);
    configureSlotButton('c6', profile.c6);

    configureSlotButton('select', profile.select ? Object.assign({ code: 'ShiftLeft', key: 'Shift', codeNum: 16 }, profile.select) : null);
    configureSlotButton('start', profile.start ? Object.assign({ code: 'Enter', key: 'Enter', codeNum: 13 }, profile.start) : null);

    var stickModeBtn = document.getElementById('touch-stick-mode-btn');
    if (stickModeBtn) {
      stickModeBtn.style.display = profile.stickToggle ? 'inline-flex' : 'none';
    }
  }

  function releaseTouchButtons(slots) {
    if (!touchGamepad) return;
    slots.forEach(function(slotName) {
      var btn = touchGamepad.querySelector('[data-slot="' + slotName + '"]');
      if (btn && btn._release) btn._release();
    });
  }

  function updateDpadStickMapping() {
    if (!touchGamepad) return;
    releaseTouchButtons(['up', 'down', 'left', 'right']);
    var dpadMap = psxStickMode ? {
      up: { code: 'KeyW', key: 'w', codeNum: 87 },
      down: { code: 'KeyS', key: 's', codeNum: 83 },
      left: { code: 'KeyA', key: 'a', codeNum: 65 },
      right: { code: 'KeyD', key: 'd', codeNum: 68 },
    } : {
      up: { code: 'ArrowUp', key: 'ArrowUp', codeNum: 38 },
      down: { code: 'ArrowDown', key: 'ArrowDown', codeNum: 40 },
      left: { code: 'ArrowLeft', key: 'ArrowLeft', codeNum: 37 },
      right: { code: 'ArrowRight', key: 'ArrowRight', codeNum: 39 },
    };
    ['up', 'down', 'left', 'right'].forEach(function(dir) {
      var btn = touchGamepad.querySelector('[data-slot="' + dir + '"]');
      if (btn) {
        btn.dataset.code = dpadMap[dir].code;
        btn.dataset.key = dpadMap[dir].key;
        btn.dataset.codeNum = String(dpadMap[dir].codeNum);
      }
    });
  }

  // Виртуальный сенсорный геймпад для смартфонов
  if (touchGamepad) {
    applyTouchProfile();
    if (window.innerWidth <= 768 || isTouchEnvironment()) {
      setTouchGamepadVisible(true);
    }
    syncMobileLayout();

    var stickModeBtn = document.getElementById('touch-stick-mode-btn');
    if (stickModeBtn) {
      stickModeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        psxStickMode = !psxStickMode;
        stickModeBtn.textContent = psxStickMode ? 'L-STICK' : 'D-PAD';
        stickModeBtn.classList.toggle('touch-btn--stick-active', psxStickMode);
        updateDpadStickMapping();
        focusActiveCanvas();
      });
    }

    touchGamepad.querySelectorAll('.touch-btn[data-slot]').forEach(function(padBtn) {
      function press(down) {
        down = !!down;
        if (!!padBtn._isDown === down) return;
        padBtn._isDown = down;

        var btnName = padBtn.dataset.btn;
        var code = padBtn.dataset.code || 'ArrowUp';
        var key = padBtn.dataset.key || 'ArrowUp';
        var keyCode = parseInt(padBtn.dataset.codeNum || '38', 10);
        var jsnesRole = padBtn.dataset.jsnes || btnName;

        padBtn.classList.toggle('touch-btn--pressed', down);
        focusActiveCanvas();

        // 1. Direct Nostalgist keyboard API (все кнопки/шифты/триггеры/аналог замаплены в raConfig)
        if (currentInstance && currentInstance.keyboardDown && currentInstance.keyboardUp) {
          try {
            if (down) {
              currentInstance.keyboardDown(code);
            } else {
              currentInstance.keyboardUp(code);
            }
          } catch(e) {}
        }

        // 2. Direct JSNES API
        if (jsnesInstance && typeof jsnes !== 'undefined' && jsnes.Controller) {
          var jBtn = null;
          if (btnName === 'up' || keyCode === 38) jBtn = jsnes.Controller.BUTTON_UP;
          else if (btnName === 'down' || keyCode === 40) jBtn = jsnes.Controller.BUTTON_DOWN;
          else if (btnName === 'left' || keyCode === 37) jBtn = jsnes.Controller.BUTTON_LEFT;
          else if (btnName === 'right' || keyCode === 39) jBtn = jsnes.Controller.BUTTON_RIGHT;
          else if (jsnesRole === 'A' || btnName === 'a' || keyCode === 88) jBtn = jsnes.Controller.BUTTON_A;
          else if (jsnesRole === 'B' || btnName === 'b' || keyCode === 90) jBtn = jsnes.Controller.BUTTON_B;
          else if (btnName === 'start' || keyCode === 13) jBtn = jsnes.Controller.BUTTON_START;
          else if (btnName === 'select' || keyCode === 16) jBtn = jsnes.Controller.BUTTON_SELECT;

          if (jBtn !== null) {
            try {
              if (down) jsnesInstance.buttonDown(1, jBtn);
              else jsnesInstance.buttonUp(1, jBtn);
            } catch(e) {}
          }
        }

        // 3. Synthetic KeyboardEvent fallback
        var eventType = down ? 'keydown' : 'keyup';
        var ev = new KeyboardEvent(eventType, {
          key: key,
          code: code,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true,
        });
        ev._synthesized = true;
        var c = (currentInstance && currentInstance.getCanvas) ? currentInstance.getCanvas() : canvas;
        if (c) c.dispatchEvent(ev);
        window.dispatchEvent(ev);
      }

      padBtn._release = function() { press(false); };

      padBtn.addEventListener('mousedown', function(e) { e.preventDefault(); press(true); });
      padBtn.addEventListener('mouseup', function(e) { e.preventDefault(); press(false); });
      padBtn.addEventListener('mouseleave', function() { press(false); });

      padBtn.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); press(true); }, { passive: false });
      padBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); press(false); }, { passive: false });
      padBtn.addEventListener('touchcancel', function() { press(false); });
    });
  }

  // --- Поддержка WASD и альтернативных клавиш без конфликта с 32-битными раскладками ---
  function getKeyTranslationsForConsole(slug) {
    if (slug === 'playstation') {
      // WASD = Left Stick, IJKL = Right Stick нативно; Space = удобный дублёр Cross (✕)
      return {
        'Space': { key: 'z', code: 'KeyZ', keyCode: 90 },
      };
    }
    if (slug === 'snes' || slug === 'sega-mega-drive' || slug === 'sega-saturn') {
      // A/S/D/W используются для Y/X/Z/R; сохраняем только J/K как альтернативу Z/X
      return {
        'KeyJ': { key: 'z', code: 'KeyZ', keyCode: 90 },
        'KeyK': { key: 'x', code: 'KeyX', keyCode: 88 },
      };
    }
    var base = {
      'KeyW': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      'KeyS': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      'KeyA': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      'KeyD': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      'KeyJ': { key: 'z', code: 'KeyZ', keyCode: 90 },
      'KeyK': { key: 'x', code: 'KeyX', keyCode: 88 },
    };
    if (slug === 'nintendo-64') {
      // Дублёр физической клавиши B на клавиатуре -> N64 B (KeyX -> input_player1_y)
      base['KeyB'] = { key: 'x', code: 'KeyX', keyCode: 88 };
    }
    if (slug === 'atari-2600') {
      base['Space'] = { key: 'z', code: 'KeyZ', keyCode: 90 };
    }
    return base;
  }

  var KEY_TRANSLATIONS = getKeyTranslationsForConsole(consoleSlug);

  function handleKeyTranslation(e, isDown) {
    if (e._synthesized || !isRunning) return;
    var active = document.activeElement;
    var tag = (active && active.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable)) return;

    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }

    var mapping = KEY_TRANSLATIONS[e.code];
    if (mapping) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      if (currentInstance) {
        try {
          if (isDown && !e.repeat && currentInstance.keyboardDown) {
            currentInstance.keyboardDown(mapping.code);
          } else if (!isDown && currentInstance.keyboardUp) {
            currentInstance.keyboardUp(mapping.code);
          }
        } catch(err) {}
      }

      if (jsnesInstance) {
        var jCode = mapping.keyCode;
        var btn = jCode === 38 ? jsnes.Controller.BUTTON_UP :
                  jCode === 40 ? jsnes.Controller.BUTTON_DOWN :
                  jCode === 37 ? jsnes.Controller.BUTTON_LEFT :
                  jCode === 39 ? jsnes.Controller.BUTTON_RIGHT :
                  jCode === 90 ? jsnes.Controller.BUTTON_A :
                  jCode === 88 ? jsnes.Controller.BUTTON_B : null;
        if (btn !== null) {
          if (isDown) jsnesInstance.buttonDown(1, btn);
          else jsnesInstance.buttonUp(1, btn);
        }
      }
    }
  }

  window.addEventListener('keydown', function(e) {
    if (isRunning) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        focusActiveCanvas();
      }
    }
    handleKeyTranslation(e, true);
  }, true);

  window.addEventListener('keyup', function(e) {
    handleKeyTranslation(e, false);
  }, true);

  // --- HTML5 Gamepad API (Геймпады для ПК, Android, iOS) ---
  var prevPadButtons = {};
  var prevPadAxes = {};
  var gamepadLoopStarted = false;

  function updateGamepadUI(name, connected) {
    if (!gamepadStatusIndicator) return;
    if (connected) {
      gamepadStatusIndicator.textContent = '🎮 ' + name + ' (Подключен)';
      gamepadStatusIndicator.classList.add('gamepad-status-indicator--active');
    } else {
      gamepadStatusIndicator.textContent = '🎮 Геймпад: ожидание ввода';
      gamepadStatusIndicator.classList.remove('gamepad-status-indicator--active');
    }
  }

  function fireSyntheticKey(code, key, keyCode, isDown) {
    var ev = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
      code: code,
      key: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });
    ev._synthesized = true;
    window.dispatchEvent(ev);
    if (canvas) canvas.dispatchEvent(ev);

    if (jsnesInstance) {
      var btn = keyCode === 38 ? jsnes.Controller.BUTTON_UP :
                keyCode === 40 ? jsnes.Controller.BUTTON_DOWN :
                keyCode === 37 ? jsnes.Controller.BUTTON_LEFT :
                keyCode === 39 ? jsnes.Controller.BUTTON_RIGHT :
                keyCode === 90 ? jsnes.Controller.BUTTON_A :
                keyCode === 88 ? jsnes.Controller.BUTTON_B :
                keyCode === 13 ? jsnes.Controller.BUTTON_START :
                keyCode === 16 ? jsnes.Controller.BUTTON_SELECT : null;
      if (btn !== null) {
        if (isDown) jsnesInstance.buttonDown(1, btn);
        else jsnesInstance.buttonUp(1, btn);
      }
    }
  }

  var PAD_BUTTON_MAP = {
    0: { code: 'KeyZ', key: 'z', keyCode: 90 },             // Кнопка A (низ) -> Действие 1 (Z)
    1: { code: 'KeyX', key: 'x', keyCode: 88 },             // Кнопка B (право) -> Действие 2 (X)
    2: { code: 'KeyA', key: 'a', keyCode: 65 },             // Кнопка X (лево) -> Доп (A)
    3: { code: 'KeyS', key: 's', keyCode: 83 },             // Кнопка Y (верх) -> Доп (S)
    8: { code: 'ShiftLeft', key: 'Shift', keyCode: 16 },    // Select / Back
    9: { code: 'Enter', key: 'Enter', keyCode: 13 },        // Start
    12: { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 },       // D-pad Вверх
    13: { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 },   // D-pad Вниз
    14: { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 },   // D-pad Влево
    15: { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 }, // D-pad Вправо
  };

  function pollGamepads() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    var pad = null;
    for (var i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        pad = gamepads[i];
        break;
      }
    }

    if (pad) {
      if (gamepadStatusIndicator && !gamepadStatusIndicator.classList.contains('gamepad-status-indicator--active')) {
        var padName = pad.id.replace(/\(.*\)/, '').trim().substring(0, 20) || 'Геймпад';
        updateGamepadUI(padName, true);
      }

      // Nostalgist/RetroArch считывает физические геймпады нативно (с аналогом);
      // синтетические события нужны только для JSNES фолбэка.
      if (jsnesInstance) {
        // 1. Опрос цифровых кнопок
        for (var bIndex in PAD_BUTTON_MAP) {
          var mapping = PAD_BUTTON_MAP[bIndex];
          var isPressed = pad.buttons[bIndex] ? pad.buttons[bIndex].pressed : false;
          var wasPressed = !!prevPadButtons[bIndex];
          if (isPressed !== wasPressed) {
            prevPadButtons[bIndex] = isPressed;
            fireSyntheticKey(mapping.code, mapping.key, mapping.keyCode, isPressed);
          }
        }

        // 2. Опрос аналогового стика
        var axisX = pad.axes[0] || 0;
        var axisY = pad.axes[1] || 0;
        var DEADZONE = 0.45;

        var leftActive = axisX < -DEADZONE;
        var rightActive = axisX > DEADZONE;
        var upActive = axisY < -DEADZONE;
        var downActive = axisY > DEADZONE;

        if (leftActive !== !!prevPadAxes['left']) {
          prevPadAxes['left'] = leftActive;
          fireSyntheticKey('ArrowLeft', 'ArrowLeft', 37, leftActive);
        }
        if (rightActive !== !!prevPadAxes['right']) {
          prevPadAxes['right'] = rightActive;
          fireSyntheticKey('ArrowRight', 'ArrowRight', 39, rightActive);
        }
        if (upActive !== !!prevPadAxes['up']) {
          prevPadAxes['up'] = upActive;
          fireSyntheticKey('ArrowUp', 'ArrowUp', 38, upActive);
        }
        if (downActive !== !!prevPadAxes['down']) {
          prevPadAxes['down'] = downActive;
          fireSyntheticKey('ArrowDown', 'ArrowDown', 40, downActive);
        }
      }
    }

    requestAnimationFrame(pollGamepads);
  }

  window.addEventListener('gamepadconnected', function(e) {
    console.log('Gamepad connected:', e.gamepad.id);
    var name = e.gamepad.id.replace(/\(.*\)/, '').trim().substring(0, 20) || 'Геймпад';
    updateGamepadUI(name, true);
    if (!gamepadLoopStarted) {
      gamepadLoopStarted = true;
      requestAnimationFrame(pollGamepads);
    }
  });

  window.addEventListener('gamepaddisconnected', function(e) {
    console.log('Gamepad disconnected:', e.gamepad.id);
    updateGamepadUI('', false);
  });

  if (navigator.getGamepads) {
    gamepadLoopStarted = true;
    requestAnimationFrame(pollGamepads);
  }

  // Клик по оверлею старта на экране
  var startOverlay = document.getElementById('emulator-start-overlay');
  if (startOverlay) {
    startOverlay.addEventListener('click', function(e) {
      e.preventDefault();
      if (!isRunning && currentRomSource) {
        startEmulator(currentRomSource);
      }
    });
  }

  // Автоматический запуск при переходе к игре или в эмулятор
  var urlParams = new URLSearchParams(window.location.search);
  var shouldAutoStart = urlParams.get('autoplay') === '1' || window.location.pathname.indexOf('/emulators') !== -1 || window.location.pathname.indexOf('/games/') !== -1;
  if (shouldAutoStart && initialRomFile) {
    setTimeout(function() {
      if (!isRunning && currentRomSource) {
        startEmulator(currentRomSource);
      }
    }, 200);
  }
})();
