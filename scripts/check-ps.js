const mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:27017/retrospect").then(async () => {
  const Game = mongoose.model("Game", new mongoose.Schema({}, { strict: false }));
  const psGames = await Game.find({ title: { $in: ["Takatron 2084", "Tetrade"] } });
  console.log(psGames.map(g => ({ title: g.title, year: g.year, isPlayableOnline: g.isPlayableOnline, romFile: g.romFile })));
  process.exit(0);
});
