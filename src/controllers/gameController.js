const Game = require('../models/Game');
const Console = require('../models/Console');
const config = require('../config');

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

exports.list = async (req, res, next) => {
  try {
    const { console: consoleSlug, genre, yearMin, yearMax, search, playable, page = 1 } = req.query;
    const limit = config.gamesPerPage || 20;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * limit;
    const filter = {};

    if (consoleSlug) {
      const consoleDoc = await Console.findOne({ slug: consoleSlug });
      if (consoleDoc) filter.consoleId = consoleDoc._id;
    }
    if (genre) filter.genre = genre;
    if (playable === '1') filter.isPlayableOnline = true;
    if (yearMin || yearMax) {
      filter.year = {};
      if (yearMin) filter.year.$gte = parseInt(yearMin, 10);
      if (yearMax) filter.year.$lte = parseInt(yearMax, 10);
    }
    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { publisher: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [games, total, consoles, genres] = await Promise.all([
      Game.find(filter)
        .populate('consoleId')
        .sort({ isPlayableOnline: -1, year: -1, title: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Game.countDocuments(filter),
      Console.find().sort({ bitness: 1, name: 1 }).lean(),
      Game.distinct('genre'),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.render('pages/games/list', {
      title: 'Игры',
      games,
      consoles,
      genres: genres.sort(),
      currentPage: pageNum,
      totalPages,
      total,
      filters: {
        console: consoleSlug || '',
        genre: genre || '',
        yearMin: yearMin || '',
        yearMax: yearMax || '',
        search: search || '',
        playable: playable || '',
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const game = await Game.findOne({ slug: req.params.slug }).populate('consoleId').lean();
    if (!game) return res.status(404).render('pages/404', { title: 'Игра не найдена' });

    const similarGames = await Game.find({
      consoleId: game.consoleId._id,
      _id: { $ne: game._id },
      genre: game.genre,
    }).limit(4).lean();

    res.render('pages/games/detail', {
      title: game.title,
      game,
      similarGames,
    });
  } catch (err) {
    next(err);
  }
};
