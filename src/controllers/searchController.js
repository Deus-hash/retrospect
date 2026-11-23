const Game = require('../models/Game');
const Console = require('../models/Console');
const Accessory = require('../models/Accessory');

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.render('pages/search/results', {
        title: 'Поиск',
        query: '',
        games: [],
        consoles: [],
        accessories: [],
      });
    }

    const trimmed = q.trim();
    const escaped = escapeRegex(trimmed);
    const regex = { $regex: escaped, $options: 'i' };

    const [games, consoles, accessories] = await Promise.all([
      Game.find({
        $or: [
          { title: regex },
          { genre: regex },
          { publisher: regex },
          { developer: regex },
          { tags: regex },
          { description: regex },
        ],
      })
        .populate('consoleId')
        .sort({ isPlayableOnline: -1, rating: -1 })
        .limit(30)
        .lean(),

      Console.find({
        $or: [
          { name: regex },
          { manufacturer: regex },
          { description: regex },
        ],
      })
        .sort({ bitness: 1 })
        .limit(10)
        .lean(),

      Accessory.find({
        $or: [
          { name: regex },
          { description: regex },
        ],
      })
        .populate('consoleIds')
        .limit(10)
        .lean(),
    ]);

    res.render('pages/search/results', {
      title: `Поиск: ${trimmed}`,
      query: trimmed,
      games,
      consoles,
      accessories,
      totalFound: games.length + consoles.length + accessories.length,
    });
  } catch (err) {
    next(err);
  }
};
