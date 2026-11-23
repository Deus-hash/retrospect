const accessories = [
  {
    name: 'NES Controller',
    slug: 'nes-controller',
    consoleSlugs: ['dendy-nes'],
    description: 'Стандартный прямоугольный геймпад с крестовиной и кнопками A/B для консоли Dendy.',
    gamesSupported: [],
  },
  {
    name: 'NES Zapper',
    slug: 'nes-zapper',
    consoleSlugs: ['dendy-nes'],
    description: 'Световой пистолет для тиров, совместимый с Duck Hunt и другими играми на Dendy.',
    gamesSupported: ['Duck Hunt', 'Hogan\'s Alley'],
  },
  {
    name: 'NES Advantage',
    slug: 'nes-advantage',
    consoleSlugs: ['dendy-nes'],
    description: 'Аркадный джойстик большого размера с турбо-кнопками для Dendy.',
    gamesSupported: [],
  },
  {
    name: 'Power Glove',
    slug: 'power-glove',
    consoleSlugs: ['dendy-nes'],
    description: 'Перчатка для управления жестами — амбициозный аксессуар для NES.',
    gamesSupported: [],
  },
  {
    name: 'Sega Mega Drive Controller (6-button)',
    slug: 'sega-6-button-controller',
    consoleSlugs: ['sega-mega-drive'],
    description: 'Геймпад с 6 кнопками для Sega Mega Drive, необходим для файтингов.',
    gamesSupported: ['Street Fighter II', 'Mortal Kombat'],
  },
  {
    name: 'Sega Mega Drive Multitap',
    slug: 'sega-multitap',
    consoleSlugs: ['sega-mega-drive'],
    description: 'Адаптер на 4 игрока для многопользовательских игр на Sega Mega Drive.',
    gamesSupported: ['Micro Machines', 'NBA Jam'],
  },
  {
    name: 'SNES Controller',
    slug: 'snes-controller',
    consoleSlugs: ['snes'],
    description: 'Геймпад Super Nintendo с эргономичным дизайном и плечевыми кнопками.',
    gamesSupported: [],
  },
  {
    name: 'SNES Mouse',
    slug: 'snes-mouse',
    consoleSlugs: ['snes'],
    description: 'Мышь для стратегий и редакторов, совместимая с Super Nintendo.',
    gamesSupported: ['Mario Paint', 'SimCity'],
  },
  {
    name: 'PlayStation DualShock',
    slug: 'ps1-dualshock',
    consoleSlugs: ['playstation'],
    description: 'Геймпад с вибрацией и двумя аналоговыми стиками для PlayStation.',
    gamesSupported: [],
  },
  {
    name: 'PlayStation Memory Card',
    slug: 'ps1-memory-card',
    consoleSlugs: ['playstation'],
    description: 'Карта памяти для сохранений игрового прогресса на PlayStation.',
    gamesSupported: [],
  },
  {
    name: 'N64 Controller',
    slug: 'n64-controller',
    consoleSlugs: ['nintendo-64'],
    description: 'Трёхрогий геймпад Nintendo 64 с аналоговым стиком в центре.',
    gamesSupported: [],
  },
  {
    name: 'N64 Rumble Pak',
    slug: 'n64-rumble-pak',
    consoleSlugs: ['nintendo-64'],
    description: 'Вибропакет для геймпада, создающий тактильную обратную связь в играх.',
    gamesSupported: ['The Legend of Zelda: Ocarina of Time', 'Star Fox 64'],
  },
  {
    name: 'N64 Transfer Pak',
    slug: 'n64-transfer-pak',
    consoleSlugs: ['nintendo-64'],
    description: 'Переходник для Game Boy, позволяющий переносить данные между консолями.',
    gamesSupported: ['Pokémon Stadium', 'Mario Golf'],
  },
  {
    name: 'Saturn Controller',
    slug: 'saturn-controller',
    consoleSlugs: ['sega-saturn'],
    description: 'Геймпад Sega Saturn с шестью кнопками для файтингов и аркад.',
    gamesSupported: [],
  },
  {
    name: 'Sega Saturn Multitap',
    slug: 'saturn-multitap',
    consoleSlugs: ['sega-saturn'],
    description: 'Адаптер на 6 игроков для многопользовательских игр на Saturn.',
    gamesSupported: ['Saturn Bomberman'],
  },
];

async function seedAccessories(Console) {
  await Console.db.model('Accessory').insertMany(
    accessories.map((a) => ({ ...a, consoleIds: [] }))
  );

  for (const acc of accessories) {
    const consoleIds = [];
    for (const slug of acc.consoleSlugs) {
      const consoleDoc = await Console.findOne({ slug });
      if (consoleDoc) {
        consoleIds.push(consoleDoc._id);
      }
    }
    await Console.db.model('Accessory').findOneAndUpdate(
      { slug: acc.slug },
      { consoleIds }
    );
  }

  console.log(`Seeded ${accessories.length} accessories`);
}

module.exports = { seedAccessories, accessories };
