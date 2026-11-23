const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  consoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Console', required: true },
  year: { type: Number, required: true },
  publisher: { type: String, required: true },
  developer: { type: String, default: '' },
  genre: { type: String, required: true },
  description: { type: String, required: true },
  shortDescription: { type: String, default: '' },
  players: { type: String, default: '1' },
  screenshots: [{ type: String }],
  romFile: { type: String, default: null },
  romPath: { type: String, default: null },
  rating: { type: Number, default: 0 },
  licenseType: { type: String, default: 'Commercial (Wiki Only / ст. 1274 ГК РФ)' },
  licenseAuthor: { type: String, default: '' },
  licenseUrl: { type: String, default: '' },
  isPlayableOnline: { type: Boolean, default: false },
  isHomebrew: { type: Boolean, default: false },
  accessories: [{
    name: { type: String },
    description: { type: String },
  }],
  tags: [{ type: String }],
});

module.exports = mongoose.model('Game', gameSchema);
