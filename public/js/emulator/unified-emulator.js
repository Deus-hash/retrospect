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

      // Handling for PlayStation games (ISO / CUE+BIN / PS-EXE)
      if (core === 'pcsx_rearmed') {
        if (typeof romDataOrUrl === 'string' && (romDataOrUrl.indexOf('demo') !== -1 || romDataOrUrl.indexOf('adventure') !== -1)) {
          romParam = [
            window.location.origin + '/roms/playstation/demo.cue',
            window.location.origin + '/roms/playstation/demo.bin'
          ];
        } else if (typeof romDataOrUrl === 'string' && romDataOrUrl.indexOf('cavestory') !== -1) {
          romParam = window.location.origin + '/roms/playstation/cavestory.iso';
        } else if (typeof romDataOrUrl === 'string' && romDataOrUrl.indexOf('240p') !== -1) {
          romParam = [
            window.location.origin + '/roms/playstation/240pTestSuitePS1-EMU.cue',
            window.location.origin + '/roms/playstation/240pTestSuitePS1-EMU.bin'
          ];
        } else {
          romParam = [
            window.location.origin + '/roms/playstation/demo.cue',
            window.location.origin + '/roms/playstation/demo.bin'
          ];
        }
      }

      setStatus('Инициализация виртуальной консоли...', false);

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
        retroarchConfig: {
          video_allow_rotate: false,
          audio_enable: true,
        },
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
        var elem = document.getElementById('emulator-viewport') || canvasWrap || canvas;
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
          var isHidden = touchGamepad.style.display === 'none' || !touchGamepad.style.display;
          touchGamepad.style.display = isHidden ? 'flex' : 'none';
          this.classList.toggle('pixel-btn--active', isHidden);
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

  // Виртуальный сенсорный геймпад для смартфонов
  if (touchGamepad) {
    // Автоматически показываем сенсорные кнопки на смартфонах/планшетах
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
      touchGamepad.style.display = 'flex';
      var touchToggleBtn = emulatorEl.querySelector('[data-action="toggle-gamepad"]');
      if (touchToggleBtn) touchToggleBtn.classList.add('pixel-btn--active');
    }

    touchGamepad.querySelectorAll('.touch-btn').forEach(function(padBtn) {
      var btnName = padBtn.dataset.btn;
      var code = padBtn.dataset.code || 'ArrowUp';
      var key = padBtn.dataset.key || 'ArrowUp';
      var keyCode = parseInt(padBtn.dataset.codeNum || padBtn.dataset.key, 10);

      function press(down) {
        padBtn.classList.toggle('touch-btn--pressed', down);
        focusActiveCanvas();

        // 1. Direct Nostalgist Core API
        if (currentInstance) {
          try {
            if (btnName && currentInstance.pressDown && currentInstance.pressUp) {
              if (down) {
                currentInstance.pressDown(btnName, 1);
              } else {
                currentInstance.pressUp(btnName, 1);
              }
            } else if (currentInstance.keyboardDown && currentInstance.keyboardUp) {
              if (down) {
                currentInstance.keyboardDown(code);
              } else {
                currentInstance.keyboardUp(code);
              }
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
          else if (btnName === 'a' || keyCode === 88) jBtn = jsnes.Controller.BUTTON_A;
          else if (btnName === 'b' || keyCode === 90) jBtn = jsnes.Controller.BUTTON_B;
          else if (btnName === 'start' || keyCode === 13) jBtn = jsnes.Controller.BUTTON_START;
          else if (btnName === 'select' || keyCode === 16) jBtn = jsnes.Controller.BUTTON_SELECT;

          if (jBtn !== null) {
            try {
              if (down) jsnesInstance.buttonDown(1, jBtn);
              else jsnesInstance.buttonUp(1, jBtn);
            } catch(e) {}
          }
        }

        // 3. Dispatch genuine synthetic KeyboardEvents with code & key
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

      padBtn.addEventListener('mousedown', function(e) { e.preventDefault(); press(true); });
      padBtn.addEventListener('mouseup', function(e) { e.preventDefault(); press(false); });
      padBtn.addEventListener('mouseleave', function(e) { press(false); });

      padBtn.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); press(true); }, { passive: false });
      padBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); press(false); }, { passive: false });
      padBtn.addEventListener('touchcancel', function(e) { press(false); });
    });
  }

  // --- Поддержка управления WASD и альтернативных кнопок (JK) ---
  var KEY_TRANSLATIONS = {
    'KeyW': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    'KeyS': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    'KeyA': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    'KeyD': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    'KeyJ': { key: 'z', code: 'KeyZ', keyCode: 90 },
    'KeyK': { key: 'x', code: 'KeyX', keyCode: 88 },
  };

  function handleKeyTranslation(e, isDown) {
    if (e._synthesized) return;
    var mapping = KEY_TRANSLATIONS[e.code];
    if (mapping) {
      var ev = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
        key: mapping.key,
        code: mapping.code,
        keyCode: mapping.keyCode,
        which: mapping.keyCode,
        bubbles: true,
        cancelable: true,
      });
      ev._synthesized = true;
      window.dispatchEvent(ev);
      if (canvas) canvas.dispatchEvent(ev);

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
