const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Console = require('../models/Console');
const Game = require('../models/Game');
const Accessory = require('../models/Accessory');

let snapshotCache = null;

function loadSnapshot() {
  if (!snapshotCache) {
    try {
      const snapPath = path.join(__dirname, '../data/db-snapshot.json');
      const raw = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
      const consoleMap = new Map((raw.consoles || []).map(c => [String(c._id), c]));
      const games = (raw.games || []).map(g => ({
        ...g,
        consoleId: consoleMap.get(String(g.consoleId)) || { name: 'Unknown', slug: 'unknown' }
      }));
      snapshotCache = {
        consoles: raw.consoles || [],
        games,
        accessories: raw.accessories || [],
        consoleMap
      };
    } catch (e) {
      console.error('Failed to load db-snapshot.json:', e);
      snapshotCache = { consoles: [], games: [], accessories: [], consoleMap: new Map() };
    }
  }
  return snapshotCache;
}

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

module.exports = {
  isDbConnected,
  loadSnapshot,

  async getHomeData() {
    if (isDbConnected()) {
      try {
        const [consoles, playableGames, totalGamesCount, totalConsolesCount, playableCount, activeEmulators] = await Promise.all([
          Console.find().sort({ bitness: 1, year: 1 }).lean(),
          Game.find({ isPlayableOnline: true }).populate('consoleId').limit(8).lean(),
          Game.countDocuments(),
          Console.countDocuments(),
          Game.countDocuments({ isPlayableOnline: true }),
          Console.countDocuments({ hasEmulator: true }),
        ]);

        const grouped = { 8: [], 16: [], 32: [] };
        consoles.forEach(c => {
          if (c.bitness <= 8) grouped[8].push(c);
          else if (c.bitness <= 16) grouped[16].push(c);
          else grouped[32].push(c);
        });

        let gameOfDay = null;
        if (playableGames.length > 0) {
          gameOfDay = playableGames[Math.floor(Math.random() * playableGames.length)];
        }

        return {
          grouped,
          consoles,
          playableGames,
          gameOfDay,
          stats: {
            totalGames: totalGamesCount,
            totalConsoles: totalConsolesCount,
            playableCount,
            activeEmulators,
          }
        };
      } catch (err) {
        console.warn('MongoDB home query failed, using snapshot fallback:', err.message);
      }
    }

    // Snapshot Fallback
    const snap = loadSnapshot();
    const consoles = [...snap.consoles].sort((a, b) => (a.bitness - b.bitness) || (a.year - b.year));
    const grouped = { 8: [], 16: [], 32: [] };
    consoles.forEach(c => {
      if (c.bitness <= 8) grouped[8].push(c);
      else if (c.bitness <= 16) grouped[16].push(c);
      else grouped[32].push(c);
    });

    const playable = snap.games.filter(g => g.isPlayableOnline);
    const playableGames = playable.slice(0, 8);
    const gameOfDay = playableGames[0] || snap.games[0] || null;

    return {
      grouped,
      consoles,
      playableGames,
      gameOfDay,
      stats: {
        totalGames: snap.games.length,
        totalConsoles: consoles.length,
        playableCount: playable.length,
        activeEmulators: consoles.filter(c => c.hasEmulator).length,
      }
    };
  },

  async getGamesList(query) {
    const { console: consoleSlug, genre, yearMin, yearMax, search, playable, page = 1 } = query;
    const limit = 20;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * limit;

    if (isDbConnected()) {
      try {
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
          const escaped = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          filter.$or = [
            { title: { $regex: escaped, $options: 'i' } },
            { tags: { $regex: escaped, $options: 'i' } },
            { publisher: { $regex: escaped, $options: 'i' } },
          ];
        }

        const [games, total, consoles, genres] = await Promise.all([
          Game.find(filter).populate('consoleId').sort({ isPlayableOnline: -1, year: -1, title: 1 }).skip(skip).limit(limit).lean(),
          Game.countDocuments(filter),
          Console.find().sort({ bitness: 1, name: 1 }).lean(),
          Game.distinct('genre'),
        ]);

        return {
          games,
          total,
          consoles,
          genres: genres.sort(),
          currentPage: pageNum,
          totalPages: Math.ceil(total / limit) || 1,
        };
      } catch (err) {
        console.warn('MongoDB games query failed, using snapshot fallback:', err.message);
      }
    }

    // Fallback
    const snap = loadSnapshot();
    let filtered = [...snap.games];

    if (consoleSlug) {
      filtered = filtered.filter(g => g.consoleId && g.consoleId.slug === consoleSlug);
    }
    if (genre) {
      filtered = filtered.filter(g => g.genre === genre);
    }
    if (playable === '1') {
      filtered = filtered.filter(g => g.isPlayableOnline);
    }
    if (yearMin) {
      filtered = filtered.filter(g => g.year >= parseInt(yearMin, 10));
    }
    if (yearMax) {
      filtered = filtered.filter(g => g.year <= parseInt(yearMax, 10));
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(g =>
        (g.title && g.title.toLowerCase().includes(q)) ||
        (g.publisher && g.publisher.toLowerCase().includes(q)) ||
        (g.tags && g.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    filtered.sort((a, b) => {
      if (a.isPlayableOnline !== b.isPlayableOnline) return b.isPlayableOnline ? 1 : -1;
      return (b.year || 0) - (a.year || 0);
    });

    const total = filtered.length;
    const games = filtered.slice(skip, skip + limit);
    const genres = Array.from(new Set(snap.games.map(g => g.genre).filter(Boolean))).sort();

    return {
      games,
      total,
      consoles: snap.consoles,
      genres,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getGameBySlug(slug) {
    if (isDbConnected()) {
      try {
        const game = await Game.findOne({ slug }).populate('consoleId').lean();
        if (game) {
          const related = await Game.find({ consoleId: game.consoleId._id, _id: { $ne: game._id } }).limit(4).lean();
          return { game, related };
        }
      } catch (e) {}
    }
    const snap = loadSnapshot();
    const game = snap.games.find(g => g.slug === slug);
    if (!game) return null;
    const related = snap.games.filter(g => g.consoleId && game.consoleId && g.consoleId.slug === game.consoleId.slug && g.slug !== slug).slice(0, 4);
    return { game, related };
  },

  async getConsolesList() {
    if (isDbConnected()) {
      try {
        const consoles = await Console.find().sort({ bitness: 1, year: 1 }).lean();
        return {
          consoles,
          grouped: {
            8: consoles.filter(c => c.bitness === 8),
            16: consoles.filter(c => c.bitness === 16),
            32: consoles.filter(c => c.bitness >= 32),
          }
        };
      } catch (e) {}
    }
    const snap = loadSnapshot();
    const consoles = [...snap.consoles].sort((a, b) => (a.bitness - b.bitness) || (a.year - b.year));
    return {
      consoles,
      grouped: {
        8: consoles.filter(c => c.bitness === 8),
        16: consoles.filter(c => c.bitness === 16),
        32: consoles.filter(c => c.bitness >= 32),
      }
    };
  },

  async getConsoleDetail(slug) {
    if (isDbConnected()) {
      try {
        const consoleDoc = await Console.findOne({ slug }).lean();
        if (consoleDoc) {
          const [games, accessories, featuredGame] = await Promise.all([
            Game.find({ consoleId: consoleDoc._id }).sort({ isPlayableOnline: -1, year: 1, title: 1 }).lean(),
            Accessory.find({ consoleIds: consoleDoc._id }).lean(),
            Game.findOne({ consoleId: consoleDoc._id, isPlayableOnline: true }).sort({ year: -1 }).lean(),
          ]);
          return { consoleDoc, games, accessories, featuredGame };
        }
      } catch (e) {}
    }
    const snap = loadSnapshot();
    const consoleDoc = snap.consoles.find(c => c.slug === slug);
    if (!consoleDoc) return null;
    const games = snap.games.filter(g => g.consoleId && g.consoleId.slug === slug).sort((a, b) => (b.isPlayableOnline ? 1 : -1));
    const accessories = snap.accessories.filter(a => (a.consoleIds || []).map(String).includes(String(consoleDoc._id)));
    const featuredGame = games.find(g => g.isPlayableOnline) || games[0] || null;
    return { consoleDoc, games, accessories, featuredGame };
  },

  async getAccessoriesList() {
    if (isDbConnected()) {
      try {
        const accessories = await Accessory.find().populate('consoleIds').lean();
        const consoles = await Console.find().lean();
        return { accessories, consoles };
      } catch (e) {}
    }
    const snap = loadSnapshot();
    return { accessories: snap.accessories, consoles: snap.consoles };
  },

  async searchAll(q) {
    if (!q || !q.trim()) return { games: [], consoles: [], query: '' };
    const cleanQ = q.trim();

    if (isDbConnected()) {
      try {
        const escaped = cleanQ.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const [games, consoles] = await Promise.all([
          Game.find({
            $or: [
              { title: { $regex: escaped, $options: 'i' } },
              { publisher: { $regex: escaped, $options: 'i' } },
              { tags: { $regex: escaped, $options: 'i' } },
            ]
          }).populate('consoleId').limit(30).lean(),
          Console.find({
            $or: [
              { name: { $regex: escaped, $options: 'i' } },
              { manufacturer: { $regex: escaped, $options: 'i' } },
            ]
          }).limit(10).lean()
        ]);
        return { games, consoles, query: cleanQ };
      } catch (e) {}
    }

    const snap = loadSnapshot();
    const lower = cleanQ.toLowerCase();
    const games = snap.games.filter(g =>
      (g.title && g.title.toLowerCase().includes(lower)) ||
      (g.publisher && g.publisher.toLowerCase().includes(lower)) ||
      (g.tags && g.tags.some(t => t.toLowerCase().includes(lower)))
    ).slice(0, 30);
    const consoles = snap.consoles.filter(c =>
      (c.name && c.name.toLowerCase().includes(lower)) ||
      (c.manufacturer && c.manufacturer.toLowerCase().includes(lower))
    ).slice(0, 10);

    return { games, consoles, query: cleanQ };
  }
};
