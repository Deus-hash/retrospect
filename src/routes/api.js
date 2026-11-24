const { Router } = require('express');
const dataStore = require('../utils/dataStore');

const router = Router();

router.get('/games', async (req, res, next) => {
  try {
    const data = await dataStore.getGamesList(req.query);
    res.json({ games: data.games, total: data.total, page: data.currentPage, totalPages: data.totalPages });
  } catch (err) {
    next(err);
  }
});

router.get('/games/:slug', async (req, res, next) => {
  try {
    const data = await dataStore.getGameBySlug(req.params.slug);
    if (!data || !data.game) return res.status(404).json({ error: 'Not found' });
    res.json(data.game);
  } catch (err) {
    next(err);
  }
});

router.get('/consoles', async (req, res, next) => {
  try {
    const data = await dataStore.getConsolesList();
    res.json(data.consoles);
  } catch (err) {
    next(err);
  }
});

router.get('/consoles/:slug', async (req, res, next) => {
  try {
    const data = await dataStore.getConsoleDetail(req.params.slug);
    if (!data || !data.consoleDoc) return res.status(404).json({ error: 'Console not found' });
    res.json(data.consoleDoc);
  } catch (err) {
    next(err);
  }
});

router.get('/accessories', async (req, res, next) => {
  try {
    const data = await dataStore.getAccessoriesList();
    res.json(data.accessories);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const homeData = await dataStore.getHomeData();
    res.json({
      totalGames: homeData.stats.totalGames,
      totalConsoles: homeData.stats.totalConsoles,
      playableGames: homeData.stats.playableCount,
      totalAccessories: 15,
      supportedEmulators: 9,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
