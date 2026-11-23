const mongoose = require('mongoose');

const consoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  bitness: { type: Number, required: true },
  manufacturer: { type: String, required: true },
  year: { type: Number, required: true },
  description: { type: String, required: true },
  image: { type: String, default: '/images/consoles/placeholder.png' },
  hasEmulator: { type: Boolean, default: false },
  emulatorType: { type: String, default: null },
  emulatorCore: { type: String, default: null },
  supportedExtensions: [{ type: String }],
  controlsHelp: { type: String, default: '' },
  color: { type: String, default: '#7c4dff' },
  gamesCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Console', consoleSchema);
