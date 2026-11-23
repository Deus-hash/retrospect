const { Router } = require('express');
const Game = require('../models/Game');
const Console = require('../models/Console');
const Accessory = require('../models/Accessory');

const router = Router();

router.get('/games', async (req, res, next) => {
  try {
    const { console: consoleSlug, genre, yearMin, yearMax, search, playable, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (consoleSlug) {
      const c = await Console.findOne({ slug: consoleSlug });
      if (c) filter.consoleId = c._id;
    }
    if (genre) filter.genre = genre;
    if (playable === '1' || playable === 'true') filter.isPlayableOnline = true;
    if (yearMin || yearMax) {
      filter.year = {};
      if (yearMin) filter.year.$gte = parseInt(yearMin);
      if (yearMax) filter.year.$lte = parseInt(yearMax);
    }
    if (search) filter.title = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [games, total] = await Promise.all([
      Game.find(filter).populate('consoleId').sort({ year: -1 }).skip(skip).limit(parseInt(limit)),
      Game.countDocuments(filter),
    ]);

    res.json({ games, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
});

router.get('/games/:slug', async (req, res, next) => {
  try {
    const game = await Game.findOne({ slug: req.params.slug }).populate('consoleId');
    if (!game) return res.status(404).json({ error: 'Not found' });
    res.json(game);
  } catch (err) {
    next(err);
  }
});

router.get('/consoles', async (req, res, next) => {
  try {
    const consoles = await Console.find().sort({ bitness: 1, year: 1 });
    res.json(consoles);
  } catch (err) {
    next(err);
  }
});

router.get('/consoles/:slug', async (req, res, next) => {
  try {
    const consoleDoc = await Console.findOne({ slug: req.params.slug });
    if (!consoleDoc) return res.status(404).json({ error: 'Console not found' });
    res.json(consoleDoc);
  } catch (err) {
    next(err);
  }
});

router.get('/accessories', async (req, res, next) => {
  try {
    const accessories = await Accessory.find().populate('consoleIds');
    res.json(accessories);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [totalGames, totalConsoles, playableGames, totalAccessories] = await Promise.all([
      Game.countDocuments(),
      Console.countDocuments(),
      Game.countDocuments({ isPlayableOnline: true }),
      Accessory.countDocuments(),
    ]);
    res.json({
      totalGames,
      totalConsoles,
      playableGames,
      totalAccessories,
      supportedEmulators: 9,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
