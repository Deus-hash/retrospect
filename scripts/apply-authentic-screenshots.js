const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('retrospect');
  const gamesCol = db.collection('games');

  const pngFiles = fs.readdirSync(path.join(__dirname, '../public/images/games')).filter(f => f.endsWith('.png'));
  console.log(`Found ${pngFiles.length} PNG files in public/images/games`);

  // Build lookup dictionary
  // Keys: normalized slug or title
  const pngMap = {};
  pngFiles.forEach(f => {
    const raw = f.replace(/\.png$/, '');
    const clean = raw.replace(/^(nes|md|snes|sms|atari|pce|ps1|n64)-/, '').replace(/[^a-z0-9]/g, '');
    pngMap[clean] = `/images/games/${f}`;
    pngMap[raw.replace(/[^a-z0-9]/g, '')] = `/images/games/${f}`;
  });

  // Manual explicit mappings for games whose filenames differ from titles
  const manualOverrides = {
    '2048 NES': '/images/games/sms-2048sanqui.png',
    'Alter Ego': '/images/games/nes-cheril-the-goddess.png',
    'Super Tilt Bro.': '/images/games/nes-super-tilt-bro.png',
    'Nova the Squirrel': '/images/games/nes-novathesquirrel.png',
    'Driar': '/images/games/nes-driar.png',
    'Thwaite': '/images/games/nes-thwaite.png',
    'Flappy Bird NES': '/images/games/nes-flappybird.png',
    'Assimilate': '/images/games/nes-assimilate.png',
    'Old Towers': '/images/games/md-oldtowers.png',
    'Cave Story MD': '/images/games/md-cavestory.png',
    'Bomb X': '/images/games/md-bombx.png',
    'Rick Dangerous MD': '/images/games/md-rickdangerous.png',
    'Miniplanets': '/images/games/md-miniplanets.png',
    'Xump 2': '/images/games/md-xump2.png',
    'N-Warp Daisakusen': '/images/games/snes-nwarpdaisakusen.png',
    'Super Boss Gaiden': '/images/games/snes-superbossgaiden.png',
    'Astrohawk': '/images/games/snes-astrohawk.png',
    'Jet Pilot Rising': '/images/games/snes-jetpilotrising.png',
    'Uwol: Quest for Money (SNES)': '/images/games/snes-uwol.png',
    'Bacon Lettuce Tomato': '/images/games/snes-blt.png',
    'Astro Force': '/images/games/sms-astroforce.png',
    'Silver Valley': '/images/games/sms-silvervalley.png',
    '2048 Master System': '/images/games/sms-2048sanqui.png',
    'Galactic Revenge': '/images/games/sms-galacticrevenge.png',
    'SokoMaster': '/images/games/sms-sokomaster.png',
    '3D City': '/images/games/sms-3dcity.png',
    'Anguna: Scourge of the Goblin King': '/images/games/atari-anguna.png',
    'Bit-Quest': '/images/games/atari-bitquest.png',
    'Turtle Bay': '/images/games/atari-turtlebay.png',
    'Winter Fortress': '/images/games/atari-winterfortress.png',
    'Halo 2600': '/images/games/atari-halo2600.png',
    'Game of Life PCE': '/images/games/pce-gamelife.png',
    "Conway's Game of Life PCE": '/images/games/pce-gamelife.png',
    'Star Wave': '/images/games/pce-starwave.png',
    'Pizza Ball': '/images/games/pce-pizzaball.png',
    'Twintris 64': '/images/games/n64-twintris.png',
    'Takatron 2084': '/images/games/ps1-takatron.png',
    'Bare Knuckle Princess': '/images/games/md-bareknuckleprincesss.png',
    'Flappy the Duck': '/images/games/atari-flappyduck.png',
    'Pong 2 Players PD': '/images/games/nes-pong1k2p.png',
    'Cix SMS': '/images/games/sms-cix.png',
  };

  const allGames = await gamesCol.find().toArray();
  console.log(`Processing ${allGames.length} games in database...`);

  let updatedCount = 0;

  for (const game of allGames) {
    let matchedPng = manualOverrides[game.title];

    if (!matchedPng) {
      const cleanTitle = game.title.toLowerCase().replace(/^(nes|md|snes|sms|atari|pce|ps1|n64)/, '').replace(/[^a-z0-9]/g, '');
      const cleanSlug = game.slug.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const [key, filePath] of Object.entries(pngMap)) {
        if (cleanTitle === key || cleanSlug === key || (key.length > 4 && (cleanTitle.includes(key) || cleanSlug.includes(key)))) {
          matchedPng = filePath;
          break;
        }
      }
    }

    if (matchedPng) {
      // Put the authentic PNG first, keep previous screenshots as secondary
      const newScreens = [matchedPng];
      if (Array.isArray(game.screenshots)) {
        game.screenshots.forEach(s => {
          if (s && s !== matchedPng && !newScreens.includes(s) && !s.includes('placeholder.svg')) {
            newScreens.push(s);
          }
        });
      }
      await gamesCol.updateOne({ _id: game._id }, { $set: { screenshots: newScreens } });
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} games with authentic PNG screenshots.`);

  // Check playable games specifically
  const playable = await gamesCol.find({ isPlayableOnline: true }).toArray();
  const playableWithoutPng = playable.filter(g => !g.screenshots || !g.screenshots[0] || !g.screenshots[0].endsWith('.png'));
  console.log(`Playable games missing PNG primary (${playableWithoutPng.length}):`, playableWithoutPng.map(g => ({ title: g.title, slug: g.slug })));

  await client.close();
}

run().catch(console.error);
