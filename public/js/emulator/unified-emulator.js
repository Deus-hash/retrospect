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
        // PS1 DualShock (517): Arrows + WASD -> Left Stick & D-Pad (работает и в 2D/Zazerkalye 2, и в 3D VoXide), IJKL=Right Stick, Z/X/C/V=✕/○/□/△, Q/E=L1/R1, R/F=L2/R2
        raConfig.input_libretro_device_p1 = 517;
        raConfig.input_player1_analog_dpad_mode = 0;
        raConfig.input_player1_up = 'up';
        raConfig.input_player1_down = 'down';
        raConfig.input_player1_left = 'left';
        raConfig.input_player1_right = 'right';
        raConfig.input_player1_l_y_minus = 'up';
        raConfig.input_player1_l_y_plus = 'down';
        raConfig.input_player1_l_x_minus = 'left';
        raConfig.input_player1_l_x_plus = 'right';
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
        // Saturn 6-button + L/R: WASD/Arrows=D-Pad, Z/X/C=A/B/C, F/G/H=X/Y/Z, Q/E=L/R, Enter=Start
        raConfig.input_player1_analog_dpad_mode = 1;
        raConfig.input_player1_up = 'up';
        raConfig.input_player1_down = 'down';
        raConfig.input_player1_left = 'left';
        raConfig.input_player1_right = 'right';
        raConfig.input_player1_b = 'z';
        raConfig.input_player1_a = 'x';
        raConfig.input_player1_r = 'c';
        raConfig.input_player1_y = 'f';
        raConfig.input_player1_x = 'g';
        raConfig.input_player1_l = 'h';
        raConfig.input_player1_l2 = 'q';
        raConfig.input_player1_r2 = 'e';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
      } else if (consoleSlug === 'sega-mega-drive') {
        // Mega Drive 6-button: WASD/Arrows=D-Pad, Z/X/C=A/B/C, F/G/H=X/Y/Z, Shift=Mode, Enter=Start
        raConfig.input_player1_up = 'up';
        raConfig.input_player1_down = 'down';
        raConfig.input_player1_left = 'left';
        raConfig.input_player1_right = 'right';
        raConfig.input_player1_y = 'z';
        raConfig.input_player1_b = 'x';
        raConfig.input_player1_a = 'c';
        raConfig.input_player1_l = 'f';
        raConfig.input_player1_x = 'g';
        raConfig.input_player1_r = 'h';
        raConfig.input_player1_start = 'enter';
        raConfig.input_player1_select = 'shift';
      } else if (consoleSlug === 'snes') {
        // SNES: WASD/Arrows=D-Pad, Z/X=B/A, C/V=Y/X, Q/E=L/R, Enter=Start, Shift=Select
        raConfig.input_player1_up = 'up';
        raConfig.input_player1_down = 'down';
        raConfig.input_player1_left = 'left';
        raConfig.input_player1_right = 'right';
        raConfig.input_player1_b = 'z';
        raConfig.input_player1_a = 'x';
        raConfig.input_player1_y = 'c';
        raConfig.input_player1_x = 'v';
        raConfig.input_player1_l = 'q';
        raConfig.input_player1_r = 'e';
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
        r: { label: 'R', code: 'KeyE', key: 'e', codeNum: 69 },
      },
      y: { label: 'Y', code: 'KeyC', key: 'c', codeNum: 67 },
      x: { label: 'X', code: 'KeyV', key: 'v', codeNum: 86 },
      b: { label: 'B', code: 'KeyZ', key: 'z', codeNum: 90 },
      a: { label: 'A', code: 'KeyX', key: 'x', codeNum: 88 },
      select: { label: 'SELECT' },
      start: { label: 'START' },
    },
    'sega-mega-drive': {
      actionsMode: '6btn',
      y: { label: 'X', code: 'KeyF', key: 'f', codeNum: 70 },
      x: { label: 'Y', code: 'KeyG', key: 'g', codeNum: 71 },
      z6: { label: 'Z', code: 'KeyH', key: 'h', codeNum: 72 },
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
        r: { label: 'R', code: 'KeyE', key: 'e', codeNum: 69 },
      },
      y: { label: 'X', code: 'KeyF', key: 'f', codeNum: 70 },
      x: { label: 'Y', code: 'KeyG', key: 'g', codeNum: 71 },
      z6: { label: 'Z', code: 'KeyH', key: 'h', codeNum: 72 },
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
      stickToggle: false,
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
        dispatchSynthesizedKeyEvent(code, key, keyCode, down, jsnesRole);
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

  var KEY_META = {
    'ArrowUp': { key: 'ArrowUp', keyCode: 38, jsnes: 'up' },
    'ArrowDown': { key: 'ArrowDown', keyCode: 40, jsnes: 'down' },
    'ArrowLeft': { key: 'ArrowLeft', keyCode: 37, jsnes: 'left' },
    'ArrowRight': { key: 'ArrowRight', keyCode: 39, jsnes: 'right' },
    'KeyZ': { key: 'z', keyCode: 90, jsnes: 'B' },
    'KeyX': { key: 'x', keyCode: 88, jsnes: 'A' },
    'KeyC': { key: 'c', keyCode: 67 },
    'KeyV': { key: 'v', keyCode: 86 },
    'KeyF': { key: 'f', keyCode: 70 },
    'KeyG': { key: 'g', keyCode: 71 },
    'KeyH': { key: 'h', keyCode: 72 },
    'KeyT': { key: 't', keyCode: 84 },
    'KeyQ': { key: 'q', keyCode: 81 },
    'KeyE': { key: 'e', keyCode: 69 },
    'KeyR': { key: 'r', keyCode: 82 },
    'KeyI': { key: 'i', keyCode: 73 },
    'KeyJ': { key: 'j', keyCode: 74 },
    'KeyK': { key: 'k', keyCode: 75 },
    'KeyL': { key: 'l', keyCode: 76 },
    'Space': { key: ' ', keyCode: 32 },
    'Enter': { key: 'Enter', keyCode: 13, jsnes: 'start' },
    'ShiftLeft': { key: 'Shift', keyCode: 16, jsnes: 'select' },
  };

  function dispatchSynthesizedKeyEvent(code, key, keyCode, isDown, jsnesRole) {
    var meta = KEY_META[code] || {};
    var resolvedKey = key || meta.key || code;
    var resolvedKeyCode = keyCode || meta.keyCode || 0;
    var resolvedRole = jsnesRole || meta.jsnes || null;

    if (jsnesInstance && typeof jsnes !== 'undefined' && jsnes.Controller) {
      var btn = resolvedRole === 'up' || resolvedKeyCode === 38 ? jsnes.Controller.BUTTON_UP :
                resolvedRole === 'down' || resolvedKeyCode === 40 ? jsnes.Controller.BUTTON_DOWN :
                resolvedRole === 'left' || resolvedKeyCode === 37 ? jsnes.Controller.BUTTON_LEFT :
                resolvedRole === 'right' || resolvedKeyCode === 39 ? jsnes.Controller.BUTTON_RIGHT :
                resolvedRole === 'A' || resolvedRole === 'a' || resolvedKeyCode === 88 ? jsnes.Controller.BUTTON_A :
                resolvedRole === 'B' || resolvedRole === 'b' || resolvedKeyCode === 90 ? jsnes.Controller.BUTTON_B :
                resolvedRole === 'start' || resolvedKeyCode === 13 ? jsnes.Controller.BUTTON_START :
                resolvedRole === 'select' || resolvedKeyCode === 16 ? jsnes.Controller.BUTTON_SELECT : null;
      if (btn !== null) {
        try {
          if (isDown) jsnesInstance.buttonDown(1, btn);
          else jsnesInstance.buttonUp(1, btn);
        } catch(e) {}
      }
    }

    var ev = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
      key: resolvedKey,
      code: code,
      keyCode: resolvedKeyCode,
      which: resolvedKeyCode,
      bubbles: true,
      cancelable: true,
    });
    ev._synthesized = true;
    var c = (currentInstance && currentInstance.getCanvas) ? currentInstance.getCanvas() : canvas;
    var targetEl = (c && c.isConnected !== false) ? c : ((canvas && canvas.isConnected !== false) ? canvas : document);
    try {
      targetEl.dispatchEvent(ev);
    } catch(e) {
      window.dispatchEvent(ev);
    }
  }

  // --- Поддержка WASD на всех 9 консолях и альтернативных клавиш без конфликтов ---
  function getKeyTranslationsForConsole(slug) {
    var base = {
      'KeyW': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, jsnes: 'up' },
      'KeyS': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, jsnes: 'down' },
      'KeyA': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, jsnes: 'left' },
      'KeyD': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, jsnes: 'right' },
    };
    if (slug !== 'playstation') {
      // На PlayStation I/J/K/L заняты под правый аналоговый стик (обзор камеры)
      base['KeyJ'] = { key: 'z', code: 'KeyZ', keyCode: 90, jsnes: 'B' };
      base['KeyK'] = { key: 'x', code: 'KeyX', keyCode: 88, jsnes: 'A' };
    }
    if (slug === 'nintendo-64') {
      // Дублёр физической клавиши B -> N64 B (KeyX)
      base['KeyB'] = { key: 'x', code: 'KeyX', keyCode: 88 };
    }
    if (slug === 'playstation' || slug === 'atari-2600') {
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

      if (isDown && e.repeat) return;
      dispatchSynthesizedKeyEvent(mapping.code, mapping.key, mapping.keyCode, isDown, mapping.jsnes);
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

  // --- HTML5 Gamepad API (USB и Bluetooth геймпады для ПК, Android, iOS) ---
  var prevGamepadKeys = Object.create(null);
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

  function getGamepadProfile(slug) {
    var common = {
      buttons: {
        0: 'KeyZ',       // Bottom (Xbox A / PS ✕)
        1: 'KeyX',       // Right  (Xbox B / PS ○)
        2: 'KeyZ',       // Left   (Xbox X / PS □)
        3: 'KeyX',       // Top    (Xbox Y / PS △)
        8: 'ShiftLeft',  // Select / Back
        9: 'Enter',      // Start / Options
        12: 'ArrowUp',
        13: 'ArrowDown',
        14: 'ArrowLeft',
        15: 'ArrowRight',
      },
      rightStick: null,
    };
    if (slug === 'snes') {
      common.buttons[2] = 'KeyC'; // Y
      common.buttons[3] = 'KeyV'; // X
      common.buttons[4] = 'KeyQ'; // L
      common.buttons[5] = 'KeyE'; // R
    } else if (slug === 'sega-mega-drive') {
      common.buttons[2] = 'KeyF'; // X
      common.buttons[3] = 'KeyG'; // Y
      common.buttons[4] = 'KeyF'; // X alt
      common.buttons[5] = 'KeyC'; // C
      common.buttons[6] = 'KeyC'; // C alt
      common.buttons[7] = 'KeyH'; // Z
    } else if (slug === 'sega-saturn') {
      common.buttons[2] = 'KeyF'; // X
      common.buttons[3] = 'KeyG'; // Y
      common.buttons[4] = 'KeyQ'; // L
      common.buttons[5] = 'KeyE'; // R
      common.buttons[6] = 'KeyC'; // C
      common.buttons[7] = 'KeyH'; // Z
    } else if (slug === 'nintendo-64') {
      common.buttons[0] = 'KeyZ';  // N64 A
      common.buttons[1] = 'KeyX';  // N64 B
      common.buttons[2] = 'KeyX';  // N64 B (удобно и на Xbox X / PS □)
      common.buttons[3] = 'KeyT';  // C-Up
      common.buttons[4] = 'KeyQ';  // L
      common.buttons[5] = 'KeyE';  // R
      common.buttons[6] = 'Space'; // Z-Trigger
      common.buttons[7] = 'Space'; // Z-Trigger alt
      common.rightStick = { up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH' };
    } else if (slug === 'playstation') {
      common.buttons[0] = 'KeyZ'; // Cross ✕
      common.buttons[1] = 'KeyX'; // Circle ○
      common.buttons[2] = 'KeyC'; // Square □
      common.buttons[3] = 'KeyV'; // Triangle △
      common.buttons[4] = 'KeyQ'; // L1
      common.buttons[5] = 'KeyE'; // R1
      common.buttons[6] = 'KeyR'; // L2
      common.buttons[7] = 'KeyF'; // R2
      common.buttons[10] = 'KeyG'; // L3
      common.buttons[11] = 'KeyH'; // R3
      common.rightStick = { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' };
    }
    return common;
  }

  var GAMEPAD_PROFILE = getGamepadProfile(consoleSlug);

  function syncGamepadKeySet(nextKeys) {
    for (var prevCode in prevGamepadKeys) {
      if (!nextKeys[prevCode]) {
        delete prevGamepadKeys[prevCode];
        var metaUp = KEY_META[prevCode] || {};
        dispatchSynthesizedKeyEvent(prevCode, metaUp.key, metaUp.keyCode, false, metaUp.jsnes);
      }
    }
    for (var code in nextKeys) {
      if (nextKeys[code] && !prevGamepadKeys[code]) {
        prevGamepadKeys[code] = true;
        var metaDown = KEY_META[code] || {};
        dispatchSynthesizedKeyEvent(code, metaDown.key, metaDown.keyCode, true, metaDown.jsnes);
      }
    }
  }

  function pollGamepads() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    var connectedPad = null;
    var nextKeys = Object.create(null);
    var DEADZONE = 0.4;

    for (var i = 0; i < gamepads.length; i++) {
      var pad = gamepads[i];
      if (!pad || !pad.connected) continue;
      if (!connectedPad) connectedPad = pad;
      if (!isRunning) continue;

      // 1. Кнопки (поддерживает и аналоговые курки Bluetooth/USB через value > 0.35)
      for (var bIndex in GAMEPAD_PROFILE.buttons) {
        var btnObj = pad.buttons && pad.buttons[bIndex];
        if (btnObj && (btnObj.pressed || btnObj.value > 0.35)) {
          nextKeys[GAMEPAD_PROFILE.buttons[bIndex]] = true;
        }
      }

      // 2. Левый стик
      if (pad.axes && pad.axes.length >= 2) {
        var lx = pad.axes[0] || 0;
        var ly = pad.axes[1] || 0;
        if (lx < -DEADZONE) nextKeys['ArrowLeft'] = true;
        if (lx > DEADZONE) nextKeys['ArrowRight'] = true;
        if (ly < -DEADZONE) nextKeys['ArrowUp'] = true;
        if (ly > DEADZONE) nextKeys['ArrowDown'] = true;
      }

      // 3. Правый стик (PS1 Look / N64 C-Buttons)
      if (GAMEPAD_PROFILE.rightStick && pad.axes && pad.axes.length >= 4) {
        var rx = pad.axes[2] || 0;
        var ry = pad.axes[3] || 0;
        var rs = GAMEPAD_PROFILE.rightStick;
        if (rx < -DEADZONE) nextKeys[rs.left] = true;
        if (rx > DEADZONE) nextKeys[rs.right] = true;
        if (ry < -DEADZONE) nextKeys[rs.up] = true;
        if (ry > DEADZONE) nextKeys[rs.down] = true;
      }

      // 4. Нестандартные USB/Bluetooth D-Pad крестовины через HID hat-switch axis[9]
      if (pad.mapping !== 'standard' && pad.axes && pad.axes.length > 9) {
        var hat = pad.axes[9];
        if (typeof hat === 'number' && Math.abs(hat) <= 1.08) {
          if (hat < -0.65 || hat > 0.90) nextKeys['ArrowUp'] = true;
          if (hat > -0.82 && hat < -0.05) nextKeys['ArrowRight'] = true;
          if (hat > -0.24 && hat < 0.54) nextKeys['ArrowDown'] = true;
          if (hat > 0.34 && hat < 1.08) nextKeys['ArrowLeft'] = true;
        }
      }
    }

    if (connectedPad) {
      if (gamepadStatusIndicator && !gamepadStatusIndicator.classList.contains('gamepad-status-indicator--active')) {
        var padName = (connectedPad.id || '').replace(/\(.*\)/, '').trim().substring(0, 22) || 'Геймпад';
        updateGamepadUI(padName, true);
      }
      if (isRunning && (currentInstance || jsnesInstance)) {
        syncGamepadKeySet(nextKeys);
      } else {
        syncGamepadKeySet(Object.create(null));
      }
    } else {
      syncGamepadKeySet(Object.create(null));
      if (gamepadStatusIndicator && gamepadStatusIndicator.classList.contains('gamepad-status-indicator--active')) {
        updateGamepadUI('', false);
      }
    }

    requestAnimationFrame(pollGamepads);
  }

  window.addEventListener('gamepadconnected', function(e) {
    console.log('Gamepad connected:', e.gamepad.id);
    var name = (e.gamepad.id || '').replace(/\(.*\)/, '').trim().substring(0, 22) || 'Геймпад';
    updateGamepadUI(name, true);
    if (!gamepadLoopStarted) {
      gamepadLoopStarted = true;
      requestAnimationFrame(pollGamepads);
    }
  });

  window.addEventListener('gamepaddisconnected', function(e) {
    console.log('Gamepad disconnected:', e.gamepad.id);
    var gps = navigator.getGamepads ? navigator.getGamepads() : [];
    var stillConnected = null;
    for (var i = 0; i < gps.length; i++) {
      if (gps[i] && gps[i].connected) { stillConnected = gps[i]; break; }
    }
    if (stillConnected) {
      var name = (stillConnected.id || '').replace(/\(.*\)/, '').trim().substring(0, 22) || 'Геймпад';
      updateGamepadUI(name, true);
    } else {
      syncGamepadKeySet(Object.create(null));
      updateGamepadUI('', false);
    }
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
