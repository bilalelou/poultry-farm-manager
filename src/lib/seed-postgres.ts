import { prisma } from './prisma';

export async function seedPostgres() {
  const count = await prisma.incubatorBatch.count();
  if (count > 0) return; // تم ملؤها مسبقاً

  console.log('🌱 جاري حقن البيانات الحقيقية في PostgreSQL...');

  // 1. Settings
  await prisma.settings.create({
    data: {
      incubatorCapacity: 605,
      feedPrices: { starter: 5.5, grower: 5.0, preLayer: 5.0, layer: 5.0 },
      dailyFeedConsumption: { starter: 25, grower: 65, preLayer: 90, layer: 110 },
      sellingPrices: { egg: 2.0, tray: 60, fertilizedEgg: 3.5, chick: 7.0, culledHen: 40, maleBroiler: 30, manure: 15 },
      marketReadyHenPrice: 75,
      targetRates: { fertility: 85, hatch: 80, production: 75, maxMortality: 5 },
      housingDensity: 6,
      incubatorElectricityCost: 60,
      incubatorCleaningCost: 20,
      currency: 'MAD',
      currencySymbol: 'د.م',
    },
  });

  // 2. Incubator Batch F2611-01
  await prisma.incubatorBatch.create({
    data: {
      batchCode: 'F2611-01',
      startDate: '2026-11-18',
      eggCount: 71,
      eggSource: 'external',
      eggCost: 220.5,
      status: 'incubating',
      electricityCost: 60,
      cleaningCost: 20,
      notes: 'أول دفعة: 71 بيضة (8 من المزرعة + 63 شراء خارجي بسعر 3.5 درهم)',
    },
  });

  // 3. Rearing Batch ATK-2611 (العتوكة: 36 ابتدائية، 14 نفوق، 22 سليم متبقي)
  await prisma.rearingBatch.create({
    data: {
      batchCode: 'ATK-2611',
      startDate: '2026-10-20',
      initialChickCount: 36,
      initialCostPerChick: 40,
      currentHealthyCount: 22,
      mortalityCount: 14,
      malesCount: 2,
      currentAgeWeeks: 18,
      status: 'rearing',
      notes: 'شراء 36 عتوكة بـ 40 درهم للحبة، نفق منها 14 وتبقى 22 حبة سليمة (منها ذكور/ديوك) ستدخل الإنتاج قريباً',
    },
  });

  // 4. Daily Production
  await prisma.dailyProduction.createMany({
    data: [
      {
        date: '2026-11-20',
        activeHenCount: 10,
        dailyMortality: 0,
        totalEggsCollected: 7,
        brokenEggs: 0,
        incubatorEggs: 0,
        personalUse: 0,
        netSaleableEggs: 7,
        productionRate: 70,
        notes: 'إنتاج القطيع الحالي (10 دجاجات بياضة)',
      },
      {
        date: '2026-11-21',
        activeHenCount: 10,
        dailyMortality: 0,
        totalEggsCollected: 8,
        brokenEggs: 0,
        incubatorEggs: 0,
        personalUse: 0,
        netSaleableEggs: 8,
        productionRate: 80,
      },
      {
        date: '2026-11-22',
        activeHenCount: 10,
        dailyMortality: 0,
        totalEggsCollected: 6,
        brokenEggs: 0,
        incubatorEggs: 0,
        personalUse: 0,
        netSaleableEggs: 6,
        productionRate: 60,
      },
      {
        date: '2026-11-23',
        activeHenCount: 10,
        dailyMortality: 0,
        totalEggsCollected: 8,
        brokenEggs: 0,
        incubatorEggs: 0,
        personalUse: 0,
        netSaleableEggs: 8,
        productionRate: 80,
      },
    ],
  });

  // 5. Initial Expenses
  await prisma.expense.createMany({
    data: [
      {
        date: '2026-11-15',
        scope: 'foundation',
        type: 'capital',
        category: 'equipment',
        description: 'شراء فقاسة البيض الأوتوماتيكية',
        quantity: 1,
        unitPrice: 4100,
        total: 4100,
        notes: 'استثمار رأسمالي أساسي',
      },
      {
        date: '2026-10-20',
        scope: 'batch',
        type: 'capital',
        category: 'other',
        description: 'شراء دفعة عتوكة (36 حبة)',
        quantity: 36,
        unitPrice: 40,
        total: 1440,
        notes: 'دفعة ATK-2611',
      },
      {
        date: '2026-11-18',
        scope: 'batch',
        type: 'operational',
        category: 'other',
        description: 'شراء بيض مخصب للفقاسة (63 بيضة)',
        quantity: 63,
        unitPrice: 3.5,
        total: 220.5,
        notes: 'دفعة F2611-01',
      },
      {
        date: '2026-11-10',
        scope: 'general',
        type: 'operational',
        category: 'feed',
        description: 'علف بياض (كيس 50 كغ)',
        quantity: 1,
        unitPrice: 250,
        total: 250,
        notes: 'سعر الكيلو 5 دراهم',
      },
    ],
  });

  console.log('✅ تم حقن البيانات الحقيقية في PostgreSQL بنجاح.');
}
