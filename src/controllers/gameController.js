const dataStore = require('../utils/dataStore');

exports.list = async (req, res, next) => {
  try {
    const data = await dataStore.getGamesList(req.query);
    const { console: consoleSlug, genre, yearMin, yearMax, search, playable } = req.query;

    res.render('pages/games/list', {
      title: 'Игры',
      games: data.games,
      consoles: data.consoles,
      genres: data.genres,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      total: data.total,
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
    const data = await dataStore.getGameBySlug(req.params.slug);
    if (!data || !data.game) {
      return res.status(404).render('pages/404', { title: 'Игра не найдена' });
    }

    res.render('pages/games/detail', {
      title: data.game.title,
      game: data.game,
      similarGames: data.related,
    });
  } catch (err) {
    next(err);
  }
};
