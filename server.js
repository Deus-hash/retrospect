const express = require('express');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const path = require('path');
const morgan = require('morgan');
const config = require('./src/config');
const autoSeed = require('./src/utils/autoSeed');

const app = express();

const hbs = engine({
  extname: 'hbs',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  defaultLayout: 'main',
  helpers: {
    stars: function(rating) {
      const full = Math.min(5, Math.max(0, Math.round(rating || 0)));
      return '★'.repeat(full) + '☆'.repeat(5 - full);
    },
    entries: function(obj) {
      if (!obj) return [];
      return Object.keys(obj).map(key => ({ key, value: obj[key] }));
    },
    eq: function(a, b) { return a === b; },
    ne: function(a, b) { return a !== b; },
    gt: function(a, b) { return a > b; },
    lt: function(a, b) { return a < b; },
    add: function(a, b) { return a + b; },
    subtract: function(a, b) { return a - b; },
    join: function(arr, sep) { return arr ? arr.join(sep || ', ') : ''; },
    json: function(obj) { return JSON.stringify(obj); },
    paginationPages: function(current, total) {
      current = parseInt(current, 10) || 1;
      total = parseInt(total, 10) || 1;
      const delta = 2;
      const range = [];
      const rangeWithDots = [];
      let l;

      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
          range.push(i);
        }
      }

      for (const i of range) {
        if (l) {
          if (i - l === 2) {
            rangeWithDots.push({ page: l + 1, isCurrent: false, isEllipsis: false });
          } else if (i - l !== 1) {
            rangeWithDots.push({ page: null, isCurrent: false, isEllipsis: true });
          }
        }
        rangeWithDots.push({ page: i, isCurrent: i === current, isEllipsis: false });
        l = i;
      }
      return rangeWithDots;
    },
    pageUrl: function(filters, page) {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (filters) {
        if (filters.console) params.set('console', filters.console);
        if (filters.genre) params.set('genre', filters.genre);
        if (filters.search) params.set('search', filters.search);
        if (filters.playable) params.set('playable', filters.playable);
        if (filters.yearMin) params.set('yearMin', filters.yearMin);
        if (filters.yearMax) params.set('yearMax', filters.yearMax);
      }
      return '?' + params.toString();
    },
  },
});

app.engine('hbs', hbs);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));

// Static files from /public and /public/cores
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (/\.(nes|bin|sms|sfc|smc|pce|z64|a26|cue|psx|exe|zip)$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
  }
}));
app.use(express.static(path.join(__dirname, 'public', 'cores'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Маршруты
app.use('/', require('./src/routes/index'));
app.use('/games', require('./src/routes/games'));
app.use('/consoles', require('./src/routes/consoles'));
app.use('/accessories', require('./src/routes/accessories'));
app.use('/search', require('./src/routes/search'));
app.use('/api', require('./src/routes/api'));

// 404
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Страница не найдена' });
});

// 500
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).render('pages/500', { title: 'Ошибка сервера' });
});

// Запуск HTTP-сервера и подключение к MongoDB
if (require.main === module) {
  const primaryPort = config.port;
  const server = app.listen(primaryPort, '0.0.0.0', () => {
    console.log(`Retrospect успешно запущен на http://0.0.0.0:${primaryPort}`);
  });

  // Дополнительно слушаем резервный порт (8080 или 3000), чтобы прокси Railway и облачные балансировщики всегда получали ответ
  const fallbackPort = primaryPort === 8080 ? 3000 : 8080;
  try {
    const extraServer = app.listen(fallbackPort, '0.0.0.0', () => {
      console.log(`Retrospect дополнительно слушает порт http://0.0.0.0:${fallbackPort}`);
    });
    extraServer.on('error', (err) => {
      // Игнорируем ошибку, если порт уже занят
    });
  } catch (e) {
    // Игнорируем
  }

  mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 })
    .then(async () => {
      console.log('MongoDB подключена успешно!');
      await autoSeed();
    })
    .catch((err) => {
      console.warn('MongoDB не доступна, используется автономный режим (db-snapshot):', err.message);
    });
}

module.exports = app;
