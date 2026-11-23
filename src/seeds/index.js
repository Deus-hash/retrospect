require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');

const Console = require('../models/Console');
const Game = require('../models/Game');
const Accessory = require('../models/Accessory');

const consolesData = require('./consoles.seed');
const seedGames = require('./games.seed');
const { seedAccessories } = require('./accessories.seed');

async function seed() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to MongoDB');

    await Console.deleteMany({});
    await Game.deleteMany({});
    await Accessory.deleteMany({});
    console.log('Cleared all collections');

    const insertedConsoles = await Console.insertMany(consolesData);
    console.log(`Seeded ${insertedConsoles.length} consoles`);

    await seedGames(Console);

    await seedAccessories(Console);

    console.log('Seeding complete!');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
