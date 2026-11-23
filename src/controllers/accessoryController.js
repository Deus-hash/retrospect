const Accessory = require('../models/Accessory');
const Console = require('../models/Console');
const Game = require('../models/Game');

exports.list = async (req, res, next) => {
  try {
    const { console: consoleSlug } = req.query;
    const filter = {};

    if (consoleSlug) {
      const consoleDoc = await Console.findOne({ slug: consoleSlug });
      if (consoleDoc) filter.consoleIds = consoleDoc._id;
    }

    const [accessories, consoles] = await Promise.all([
      Accessory.find(filter).populate('consoleIds').lean(),
      Console.find().sort({ bitness: 1, name: 1 }).lean(),
    ]);

    res.render('pages/accessories/list', {
      title: 'Аксессуары',
      accessories,
      consoles,
      selectedConsole: consoleSlug || '',
    });
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const accessory = await Accessory.findOne({ slug: req.params.slug }).populate('consoleIds').lean();
    if (!accessory) return res.status(404).render('pages/404', { title: 'Аксессуар не найден' });

    const games = await Game.find({ consoleId: { $in: accessory.consoleIds.map(c => c._id) } })
      .populate('consoleId')
      .sort({ title: 1 })
      .lean();

    res.render('pages/accessories/detail', {
      title: accessory.name,
      accessory,
      games,
    });
  } catch (err) {
    next(err);
  }
};
