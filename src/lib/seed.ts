// ============================================================
// بيانات تجريبية واقعية لاختبار التطبيق
// ============================================================

import { db, DEFAULT_SETTINGS } from './db';
import type {
  IncubatorBatch,
  RearingBatch,
  RearingWeeklyLog,
  DailyProduction,
  Sale,
  Expense,
} from './types';

export async function seedDatabase() {
  // تحقق إذا كانت البيانات موجودة مسبقاً
  const existingBatches = await db.incubatorBatches.count();
  if (existingBatches > 0) return;

  console.log('🌱 بذر البيانات التجريبية...');

  // === 1. الإعدادات ===
  const existingSettings = await db.settings.count();
  if (existingSettings === 0) {
    await db.settings.add(DEFAULT_SETTINGS);
  }

  // === 2. دفعات الفقاسة ===
  const batch1: IncubatorBatch = {
    batchCode: 'F2609-01',
    startDate: '2026-09-01',
    eggCount: 176,
    eggSource: 'external',
    eggCost: 440, // 2.5 درهم/بيضة
    fertilizedCount: 152,
    fertilityRate: 86.4,
    hatchedChicks: 128,
    spoiledEggs: 24,
    hatchRate: 84.2,
    electricityCost: 50,
    cleaningCost: 20,
    totalCost: 510,
    costPerChick: 3.98,
    status: 'transferred',
    notes: 'أول دفعة - بيض من مزرعة الحاج عمر',
    createdAt: '2026-09-01',
  };

  const batch2: IncubatorBatch = {
    batchCode: 'F2610-01',
    startDate: '2026-10-10',
    eggCount: 176,
    eggSource: 'external',
    eggCost: 440,
    fertilizedCount: 158,
    fertilityRate: 89.8,
    hatchedChicks: 135,
    spoiledEggs: 18,
    hatchRate: 85.4,
    electricityCost: 50,
    cleaningCost: 20,
    totalCost: 510,
    costPerChick: 3.78,
    status: 'transferred',
    notes: 'دفعة ثانية',
    createdAt: '2026-10-10',
  };

  const batch3: IncubatorBatch = {
    batchCode: 'F2611-01',
    startDate: '2026-11-15',
    eggCount: 176,
    eggSource: 'internal',
    eggCost: 0,
    fertilizedCount: undefined,
    status: 'incubating',
    electricityCost: 50,
    cleaningCost: 20,
    notes: 'بيض من إنتاجنا الداخلي',
    createdAt: '2026-11-15',
  };

  const [b1Id, b2Id, b3Id] = await db.incubatorBatches.bulkAdd([batch1, batch2, batch3], { allKeys: true });

  // === 3. دفعات التربية ===
  const rearing1: RearingBatch = {
    batchCode: 'T2609-01',
    incubatorBatchId: b1Id as number,
    startDate: '2026-09-22',
    initialChickCount: 128,
    initialCostPerChick: 3.98,
    status: 'completed',
    notes: 'نقل من الدفعة الأولى',
    createdAt: '2026-09-22',
  };

  const rearing2: RearingBatch = {
    batchCode: 'T2610-01',
    incubatorBatchId: b2Id as number,
    startDate: '2026-10-31',
    initialChickCount: 135,
    initialCostPerChick: 3.78,
    status: 'rearing',
    notes: 'نقل من الدفعة الثانية',
    createdAt: '2026-10-31',
  };

  const [r1Id, r2Id] = await db.rearingBatches.bulkAdd([rearing1, rearing2], { allKeys: true });

  // === 4. سجلات التربية الأسبوعية (دفعة 1 مكتملة - 20 أسبوع) ===
  const weeklyLogs1: RearingWeeklyLog[] = [];
  let remaining1 = 128;
  let totalCost1 = 128 * 3.98; // تكلفة أولية
  const feedConsumptionByWeek = [
    15, 20, 25, 35, 45, 55, // بادي
    65, 70, 75, 78, 80, 82, 85, 87, 88, 90, 92, 95, // نامي
    100, 110, // ما قبل البيض
  ];

  for (let w = 1; w <= 20; w++) {
    const mortality = w <= 3 ? Math.floor(Math.random() * 3) + 1 : w <= 6 ? Math.floor(Math.random() * 2) : Math.random() < 0.3 ? 1 : 0;
    remaining1 -= mortality;
    const feedPhase = w <= 6 ? 'starter' : w <= 18 ? 'grower' : 'preLayer';
    const feedPrice = feedPhase === 'starter' ? 5.5 : feedPhase === 'grower' ? 4.8 : 5.0;
    const feedPerBird = feedConsumptionByWeek[w - 1] || 80;
    const feedConsumed = (remaining1 * feedPerBird * 7) / 1000;
    const feedCost = feedConsumed * feedPrice;
    const heatingCost = w <= 4 ? 30 : w <= 8 ? 15 : 0;
    const beddingCost = w === 1 ? 50 : w % 4 === 0 ? 20 : 0;
    const vaccinationCost = [1, 2, 3, 4, 6, 8, 10, 12, 16, 18].includes(w) ? 15 : 0;
    const malesSold = w === 10 ? Math.floor(remaining1 * 0.45) : 0;
    const malesSaleValue = malesSold * 25;

    if (malesSold > 0) remaining1 -= malesSold;

    const totalWeeklyCost = feedCost + heatingCost + beddingCost + vaccinationCost + 5; // 5 درهم أخرى
    totalCost1 += totalWeeklyCost;

    weeklyLogs1.push({
      rearingBatchId: r1Id as number,
      weekNumber: w,
      feedPhase: feedPhase as 'starter' | 'grower' | 'preLayer',
      remainingCount: remaining1,
      weeklyMortality: mortality,
      cumulativeMortalityRate: ((128 - remaining1 - (w >= 10 ? Math.floor(128 * 0.45) : 0)) / 128) * 100,
      feedConsumed,
      feedCost,
      heatingCost,
      lightingCost: 10,
      beddingCost,
      vaccinationCost,
      medicineCost: w === 5 ? 20 : 0,
      otherCosts: 5,
      totalWeeklyCost,
      malesSold,
      malesSaleValue,
    });
  }

  await db.rearingWeeklyLogs.bulkAdd(weeklyLogs1);

  // سجلات للدفعة 2 (4 أسابيع فقط - جارية)
  const weeklyLogs2: RearingWeeklyLog[] = [];
  let remaining2 = 135;

  for (let w = 1; w <= 4; w++) {
    const mortality = w <= 2 ? 2 : 1;
    remaining2 -= mortality;
    const feedPerBird = feedConsumptionByWeek[w - 1] || 25;
    const feedConsumed = (remaining2 * feedPerBird * 7) / 1000;
    const feedCost = feedConsumed * 5.5;

    weeklyLogs2.push({
      rearingBatchId: r2Id as number,
      weekNumber: w,
      feedPhase: 'starter',
      remainingCount: remaining2,
      weeklyMortality: mortality,
      cumulativeMortalityRate: ((135 - remaining2) / 135) * 100,
      feedConsumed,
      feedCost,
      heatingCost: 30,
      lightingCost: 10,
      beddingCost: w === 1 ? 50 : 0,
      vaccinationCost: 15,
      medicineCost: 0,
      otherCosts: 5,
      totalWeeklyCost: feedCost + 30 + 10 + (w === 1 ? 50 : 0) + 15 + 5,
      malesSold: 0,
      malesSaleValue: 0,
    });
  }

  await db.rearingWeeklyLogs.bulkAdd(weeklyLogs2);

  // === 5. الإنتاج اليومي (دفعة 1 بدأت الإنتاج) ===
  // الدجاج البياض من الدفعة 1: ~ 56 دجاجة (بعد إزالة الذكور والنفوق)
  const hensFromBatch1 = weeklyLogs1[weeklyLogs1.length - 1].remainingCount;
  const dailyProds: DailyProduction[] = [];
  const startProdDate = new Date('2026-11-01');

  for (let d = 0; d < 24; d++) {
    const date = new Date(startProdDate);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    // نسبة إنتاج تتزايد تدريجياً (بداية الإنتاج)
    const baseRate = Math.min(30 + d * 2.5, 72);
    const jitter = (Math.random() - 0.5) * 10;
    const rate = Math.max(10, Math.min(baseRate + jitter, 85));
    const totalEggs = Math.round(hensFromBatch1 * rate / 100);
    const broken = Math.floor(Math.random() * 2);
    const incubatorEggs = d > 10 ? Math.floor(Math.random() * 3) : 0;
    const personalUse = Math.floor(Math.random() * 3) + 1;
    const mortality = Math.random() < 0.05 ? 1 : 0;

    dailyProds.push({
      date: dateStr,
      activeHenCount: hensFromBatch1 - dailyProds.reduce((s, p) => s + p.dailyMortality, 0),
      dailyMortality: mortality,
      totalEggsCollected: totalEggs,
      brokenEggs: broken,
      incubatorEggs: incubatorEggs,
      personalUse: personalUse,
      netSaleableEggs: Math.max(0, totalEggs - broken - incubatorEggs - personalUse),
      productionRate: rate,
    });
  }

  await db.dailyProduction.bulkAdd(dailyProds);

  // === 6. المبيعات ===
  const sales: Sale[] = [];

  // بيع بيض
  for (let w = 0; w < 3; w++) {
    const weekStart = new Date('2026-11-01');
    weekStart.setDate(weekStart.getDate() + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const totalWeekEggs = dailyProds
      .filter(p => {
        const pd = new Date(p.date);
        return pd >= weekStart && pd <= weekEnd;
      })
      .reduce((s, p) => s + p.netSaleableEggs, 0);

    const trays = Math.floor(totalWeekEggs / 30);
    if (trays > 0) {
      sales.push({
        date: weekEnd.toISOString().split('T')[0],
        type: 'eggs',
        quantity: trays,
        unitType: 'tray',
        unitPrice: 36,
        total: trays * 36,
        buyerName: 'سوق المدينة',
      });
    }
    // بيع وحدات متبقية
    const remainingEggs = totalWeekEggs % 30;
    if (remainingEggs > 0) {
      sales.push({
        date: weekEnd.toISOString().split('T')[0],
        type: 'eggs',
        quantity: remainingEggs,
        unitType: 'unit',
        unitPrice: 1.2,
        total: remainingEggs * 1.2,
      });
    }
  }

  // بيع ذكور
  sales.push({
    date: '2026-11-25',
    type: 'males',
    quantity: Math.floor(128 * 0.45),
    unitType: 'unit',
    unitPrice: 25,
    total: Math.floor(128 * 0.45) * 25,
    buyerName: 'الحاج إبراهيم',
  });

  await db.sales.bulkAdd(sales);

  // === 7. المصاريف ===
  const expenses: Expense[] = [
    // مصاريف تأسيسية
    {
      date: '2026-08-15',
      scope: 'foundation',
      type: 'capital',
      category: 'equipment',
      description: 'شراء فقاسة 176 بيضة',
      quantity: 1,
      unitPrice: 2500,
      total: 2500,
    },
    {
      date: '2026-08-20',
      scope: 'foundation',
      type: 'capital',
      category: 'equipment',
      description: 'تجهيز العنبر الأول',
      quantity: 1,
      unitPrice: 5000,
      total: 5000,
    },
    {
      date: '2026-08-20',
      scope: 'foundation',
      type: 'capital',
      category: 'equipment',
      description: 'مسقيات وعلافات (10 قطع)',
      quantity: 10,
      unitPrice: 80,
      total: 800,
    },
    {
      date: '2026-08-25',
      scope: 'foundation',
      type: 'capital',
      category: 'equipment',
      description: 'مصابيح تدفئة (3 قطع)',
      quantity: 3,
      unitPrice: 150,
      total: 450,
    },
    // مصاريف تشغيلية شهرية
    {
      date: '2026-09-30',
      scope: 'general',
      type: 'operational',
      category: 'feed',
      description: 'علف بادي شهر 9',
      quantity: 50,
      unitPrice: 5.5,
      total: 275,
    },
    {
      date: '2026-10-31',
      scope: 'general',
      type: 'operational',
      category: 'feed',
      description: 'علف بادي/نامي شهر 10',
      quantity: 120,
      unitPrice: 5.0,
      total: 600,
    },
    {
      date: '2026-11-15',
      scope: 'general',
      type: 'operational',
      category: 'feed',
      description: 'علف نامي/بياض شهر 11',
      quantity: 200,
      unitPrice: 4.8,
      total: 960,
    },
    {
      date: '2026-10-15',
      scope: 'general',
      type: 'operational',
      category: 'electricity',
      description: 'فاتورة كهرباء شهر 10',
      quantity: 1,
      unitPrice: 180,
      total: 180,
    },
    {
      date: '2026-11-15',
      scope: 'general',
      type: 'operational',
      category: 'electricity',
      description: 'فاتورة كهرباء شهر 11',
      quantity: 1,
      unitPrice: 200,
      total: 200,
    },
    {
      date: '2026-10-01',
      scope: 'general',
      type: 'operational',
      category: 'vaccination',
      description: 'تحصينات شهر 10',
      quantity: 1,
      unitPrice: 100,
      total: 100,
    },
    {
      date: '2026-11-01',
      scope: 'general',
      type: 'operational',
      category: 'vaccination',
      description: 'تحصينات شهر 11',
      quantity: 1,
      unitPrice: 80,
      total: 80,
    },
    {
      date: '2026-11-10',
      scope: 'general',
      type: 'operational',
      category: 'bedding',
      description: 'فرشة للعنبر',
      quantity: 5,
      unitPrice: 20,
      total: 100,
    },
    {
      date: '2026-11-01',
      scope: 'general',
      type: 'operational',
      category: 'water',
      description: 'فاتورة ماء',
      quantity: 1,
      unitPrice: 50,
      total: 50,
    },
  ];

  await db.expenses.bulkAdd(expenses);

  console.log('✅ تم بذر البيانات التجريبية بنجاح');
}
