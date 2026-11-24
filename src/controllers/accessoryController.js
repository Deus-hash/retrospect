const dataStore = require('../utils/dataStore');

exports.list = async (req, res, next) => {
  try {
    const { console: consoleSlug } = req.query;
    const data = await dataStore.getAccessoriesList();
    let accessories = data.accessories || [];
    if (consoleSlug) {
      const consoleDoc = (data.consoles || []).find(c => c.slug === consoleSlug);
      if (consoleDoc) {
        accessories = accessories.filter(a => (a.consoleIds || []).map(String).includes(String(consoleDoc._id)));
      }
    }

    res.render('pages/accessories/list', {
      title: 'Аксессуары',
      accessories,
      consoles: data.consoles || [],
      selectedConsole: consoleSlug || '',
    });
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const data = await dataStore.getAccessoriesList();
    const accessory = (data.accessories || []).find(a => a.slug === req.params.slug);
    if (!accessory) return res.status(404).render('pages/404', { title: 'Аксессуар не найден' });

    res.render('pages/accessories/detail', {
      title: accessory.name,
      accessory,
      games: [],
    });
  } catch (err) {
    next(err);
  }
};
