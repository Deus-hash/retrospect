const Console = require('../models/Console');
const Game = require('../models/Game');
const Accessory = require('../models/Accessory');

exports.list = async (req, res, next) => {
  try {
    const consoles = await Console.find().sort({ bitness: 1, year: 1 }).lean();
    const grouped = {
      8: consoles.filter(c => c.bitness === 8),
      16: consoles.filter(c => c.bitness === 16),
      32: consoles.filter(c => c.bitness >= 32),
    };
    res.render('pages/consoles/list', {
      title: 'Консоли',
      grouped,
      consoles,
    });
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const consoleDoc = await Console.findOne({ slug: req.params.slug }).lean();
    if (!consoleDoc) return res.status(404).render('pages/404', { title: 'Консоль не найдена' });

    const [games, accessories, featuredGame] = await Promise.all([
      Game.find({ consoleId: consoleDoc._id }).sort({ isPlayableOnline: -1, year: 1, title: 1 }).lean(),
      Accessory.find({ consoleIds: consoleDoc._id }).lean(),
      Game.findOne({ consoleId: consoleDoc._id, isPlayableOnline: true }).sort({ year: -1 }).lean(),
    ]);

    res.render('pages/consoles/detail', {
      title: consoleDoc.name,
      console: consoleDoc,
      games,
      accessories,
      featuredGame,
    });
  } catch (err) {
    next(err);
  }
};
