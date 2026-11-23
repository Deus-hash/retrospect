const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('retrospect');
  await db.collection('games').updateOne(
    { slug: 'playstation-240p-test-suite' },
    { $set: { year: 2025 } }
  );
  console.log('Set 240p Test Suite year to 2025!');
  await client.close();
}

run().catch(console.error);
