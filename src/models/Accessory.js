const mongoose = require('mongoose');

const accessorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  consoleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Console' }],
  description: { type: String, required: true },
  image: { type: String, default: '/images/accessories/placeholder.png' },
  gamesSupported: [{ type: String }],
});

module.exports = mongoose.model('Accessory', accessorySchema);
