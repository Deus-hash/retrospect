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
    const consoles = await Console.find({ hasEmulator: true }).sort({ bitness: 1, year: 1 }).lean();
    
    let activeConsole = null;
    if (consoleSlug) {
      activeConsole = consoles.find(c => c.slug === consoleSlug);
    }
    if (!activeConsole && consoles.length > 0) {
      activeConsole = consoles[0];
    }

    const [gamesForConsole, allPlayableGames, totalGamesForConsole] = await Promise.all([
      Game.find({ consoleId: activeConsole ? activeConsole._id : null, isPlayableOnline: true }).sort({ rating: -1, year: -1, title: 1 }).lean(),
      Game.find({ isPlayableOnline: true }).populate('consoleId').lean(),
      Game.countDocuments({ consoleId: activeConsole ? activeConsole._id : null }),
    ]);

    let featuredGame = null;
    if (gameSlug) {
      featuredGame = gamesForConsole.find(g => g.slug === gameSlug) || allPlayableGames.find(g => g.slug === gameSlug);
    }
    if (!featuredGame && gamesForConsole.length > 0) {
      featuredGame = gamesForConsole[0];
    }

    res.render('pages/emulators', {
      title: 'Лаборатория эмуляторов',
      consoles,
      activeConsole,
      gamesForConsole,
      allPlayableGames,
      featuredGame,
      totalGamesForConsole,
    });
  } catch (err) {
    next(err);
  }
});

// Открытые технологии и библиотеки
router.get('/legal', async (req, res, next) => {
  try {
    const playableGames = await Game.find({ isPlayableOnline: true }).populate('consoleId').lean();

    res.render('pages/legal', {
      title: 'Открытые технологии и компоненты',
      playableGames,
    });
  } catch (err) {
    next(err);
  }
});

// О проекте
router.get('/about', async (req, res, next) => {
  try {
    const [totalGames, totalConsoles, playableGames] = await Promise.all([
      Game.countDocuments(),
      Console.countDocuments(),
      Game.countDocuments({ isPlayableOnline: true }),
    ]);

    res.render('pages/about', {
      title: 'О проекте Retrospect',
      totalGames,
      totalConsoles,
      playableGames,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
