const { Router } = require('express');
const dataStore = require('../utils/dataStore');

const router = Router();

// Главная страница
router.get('/', async (req, res, next) => {
  try {
    const homeData = await dataStore.getHomeData();
    res.render('pages/home', {
      title: 'Главная',
      ...homeData
    });
  } catch (err) {
    next(err);
  }
});

// Лаборатория эмуляторов
router.get('/emulators', async (req, res, next) => {
  try {
    const { console: consoleSlug, game: gameSlug } = req.query;
    const emulatorsData = await dataStore.getEmulatorsData(consoleSlug, gameSlug);

    res.render('pages/emulators', {
      title: 'Лаборатория эмуляторов',
      ...emulatorsData,
    });
  } catch (err) {
    next(err);
  }
});

// Открытые технологии и библиотеки
router.get('/legal', async (req, res, next) => {
  try {
    const legalData = await dataStore.getLegalData();
    res.render('pages/legal', {
      title: 'Открытые технологии и компоненты',
      ...legalData,
    });
  } catch (err) {
    next(err);
  }
});

// О проекте
router.get('/about', async (req, res, next) => {
  try {
    const aboutData = await dataStore.getAboutData();
    res.render('pages/about', {
      title: 'О проекте Retrospect',
      ...aboutData,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
