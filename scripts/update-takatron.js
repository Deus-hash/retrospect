const { MongoClient } = require('mongodb');

async function update() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('retrospect');
  const r = await db.collection('games').updateOne(
    { title: 'Takatron 2084' },
    {
      $set: {
        romFile: '/roms/playstation/takatron.exe',
        screenshots: ['/images/games/ps1-takatron.png', '/images/screenshots/playstation-takatron-2084-scene-1.svg']
      }
    }
  );
  console.log('Updated Takatron 2084:', r.modifiedCount);
  await client.close();
}

update().catch(console.error);
