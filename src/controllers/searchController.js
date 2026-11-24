const dataStore = require('../utils/dataStore');

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
        totalFound: 0,
      });
    }

    const { games, consoles, query } = await dataStore.searchAll(q);

    res.render('pages/search/results', {
      title: `Поиск: ${query}`,
      query,
      games,
      consoles,
      accessories: [],
      totalFound: games.length + consoles.length,
    });
  } catch (err) {
    next(err);
  }
};
