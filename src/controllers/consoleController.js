const dataStore = require('../utils/dataStore');

exports.list = async (req, res, next) => {
  try {
    const data = await dataStore.getConsolesList();
    res.render('pages/consoles/list', {
      title: 'Консоли',
      grouped: data.grouped,
      consoles: data.consoles,
    });
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const data = await dataStore.getConsoleDetail(req.params.slug);
    if (!data || !data.consoleDoc) {
      return res.status(404).render('pages/404', { title: 'Консоль не найдена' });
    }

    res.render('pages/consoles/detail', {
      title: data.consoleDoc.name,
      console: data.consoleDoc,
      games: data.games,
      accessories: data.accessories,
      featuredGame: data.featuredGame,
    });
  } catch (err) {
    next(err);
  }
};
