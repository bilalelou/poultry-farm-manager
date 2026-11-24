// ============================================================
// بذر البيانات الحقيقية وتحديث قاعدة البيانات
// ============================================================

import { db, DEFAULT_SETTINGS } from './db';
import type {
  IncubatorBatch,
  RearingBatch,
  DailyProduction,
  Expense,
  Settings,
} from './types';

export async function seedDatabase(forceReset: boolean = false) {
  const existingBatches = await db.incubatorBatches.count();
  
  // إذا لم نطلب إعادة تعيين إجبارية وكانت هناك دفعات مسبقاً، نتوقف
  if (existingBatches > 0 && !forceReset) return;

  console.log('🔄 جاري تنظيف وحقن البيانات الحقيقية...');

  // 1. تفريغ الجداول من البيانات التجريبية القديمة
  await db.incubatorBatches.clear();
  await db.rearingBatches.clear();
  await db.rearingWeeklyLogs.clear();
  await db.dailyProduction.clear();
  await db.sales.clear();
  await db.expenses.clear();
  await db.expansionPlans.clear();
  await db.expansionPlanMonths.clear();
  await db.alerts.clear();
  await db.settings.clear();

  // 2. تحديث الإعدادات الواقعية (سعر العلف 5 درهم، سعة الفقاسة...)
  const realSettings: Settings = {
    ...DEFAULT_SETTINGS,
    incubatorCapacity: 100, // سعة مناسبة لحجم الدفعة
    feedPrices: {
      starter: 5.5,
      grower: 5.0,
      preLayer: 5.0,
      layer: 5.0, // سعر العلف الحالي 5 درهم/كغ
    },
    dailyFeedConsumption: {
      starter: 25,
      grower: 65,
      preLayer: 90,
      layer: 110, // 110 غرام لكل دجاجة بياضة يومياً
    },
    sellingPrices: {
      egg: 1.5, // سعر بيع بيض البلدي/المائدة الحالي بالدرهم
      tray: 45,
      fertilizedEgg: 3.5,
      chick: 7.0,
      culledHen: 40,
      maleBroiler: 30,
      manure: 15,
    },
    marketReadyHenPrice: 75,
    targetRates: {
      fertility: 85,
      hatch: 80,
      production: 75,
      maxMortality: 5,
    },
    incubatorElectricityCost: 60,
    incubatorCleaningCost: 20,
    currency: 'MAD',
    currencySymbol: 'د.م',
  };

  await db.settings.add(realSettings);

  // 3. دفعة الفقاسة الأولى (18/11/2026)
  // 71 بيضة: 8 إنتاج داخلي + 63 بيض خارجي بسعر 3.5 درهم = 220.5 درهم
  const realBatch: IncubatorBatch = {
    batchCode: 'F2611-01',
    startDate: '2026-11-18',
    eggCount: 71,
    eggSource: 'external',
    eggCost: 63 * 3.5, // 220.5 درهم
    fertilizedCount: undefined, // في انتظار فحص اليوم 7 (25 نونبر)
    status: 'incubating',
    electricityCost: 60,
    cleaningCost: 20,
    notes: 'أول دفعة: 71 بيضة (8 من المزرعة + 63 شراء خارجي بسعر 3.5 درهم)',
    createdAt: '2026-11-18',
  };

  const batchId = await db.incubatorBatches.add(realBatch);

  // 4. دفعة العتوكة المشتراة قيد التجهيز (18 عتوكة متبقية ستدخل الإنتاج قريباً)
  const rearingBatch: RearingBatch = {
    batchCode: 'ATK-2611',
    startDate: '2026-10-20', // عمرها حالياً حوالي شهر وتستعد للإنتاج
    initialChickCount: 36,
    initialCostPerChick: 40, // 40 درهم للعتوكة
    status: 'rearing',
    notes: 'شراء 36 عتوكة بـ 40 درهم للحبة، نفق منها 14 وتبقى 18 حبة ستدخل الإنتاج خلال شهر',
    createdAt: '2026-10-20',
  };

  await db.rearingBatches.add(rearingBatch);

  // 5. سجل الإنتاج للقطيع البياض الحالي (10 دجاجات بياضة)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // نسجل نشاط الإنتاج لليوم الحالي للـ 10 دجاجات بنسبة إنتاج نموذجية (~70% = 7 بيضات)
  const currentProduction: DailyProduction = {
    date: todayStr,
    activeHenCount: 10,
    dailyMortality: 0,
    totalEggsCollected: 7,
    brokenEggs: 0,
    incubatorEggs: 0,
    personalUse: 1,
    netSaleableEggs: 6,
    productionRate: 70,
    notes: 'القطيع البياض الحالي: 10 دجاجات نشطة',
  };

  await db.dailyProduction.add(currentProduction);

  // 6. المصاريف الفعلية والتأسيسية المسجلة:
  const realExpenses: Expense[] = [
    // تكلفة الفقاسة
    {
      date: '2026-11-15',
      scope: 'foundation',
      type: 'capital',
      category: 'equipment',
      description: 'شراء الفقاسة',
      quantity: 1,
      unitPrice: 4100,
      total: 4100,
      notes: 'استثمار تأسيسي - معدات الفقاسة',
    },
    // تكلفة شراء العتوكة (36 عتوكة * 40 درهم = 1440 درهم)
    {
      date: '2026-10-20',
      scope: 'batch',
      type: 'operational',
      category: 'other',
      description: 'شراء 36 عتوكة (40 درهم للحبة)',
      quantity: 36,
      unitPrice: 40,
      total: 1440,
      notes: 'نفق منها 14 حبة وبقي 18 حبة ستدخل الإنتاج',
    },
    // تكلفة البيض الخارجي للفقاسة (63 بيضة * 3.5 درهم = 220.5 درهم)
    {
      date: '2026-11-18',
      scope: 'batch',
      batchId: batchId as number,
      batchType: 'incubator',
      type: 'operational',
      category: 'other',
      description: 'شراء 63 بيضة مخصبة للفقاسة (3.5 درهم للبيضة)',
      quantity: 63,
      unitPrice: 3.5,
      total: 220.5,
      notes: '8 بيضات أخرى تم توفيرها داخلياً من المزرعة',
    },
    // كيس علف بياض (50 كغ * 5 درهم = 250 درهم)
    {
      date: '2026-11-18',
      scope: 'general',
      type: 'operational',
      category: 'feed',
      description: 'علف بياض (5 درهم / كغ)',
      quantity: 50,
      unitPrice: 5,
      total: 250,
      notes: 'تغذية الدجاج البياض والعتوكة',
    },
  ];

  await db.expenses.bulkAdd(realExpenses);

  console.log('✅ تم إدخال البيانات الحقيقية وتحديث الخطة بنجاح');
}
