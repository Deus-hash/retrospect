require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PRIVATE_URL || 'mongodb://localhost:27017/retrospect',
  gamesPerPage: 20,
};
