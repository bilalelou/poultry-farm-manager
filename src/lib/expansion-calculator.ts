// ============================================================
// محرك حساب خطة التوسع الاستراتيجية بناءً على المعطيات الفعلية للمزرعة
// ============================================================

import type { Settings, ExpansionPlanMonth, ExpansionSource, ExpansionStrategy } from './types';

/** دفعة عتوكة قيد التربية مع تاريخ وعمر حقيقي */
export interface PendingRearingBatch {
  batchCode: string;
  startDate: string;         // تاريخ بداية التربية أو الشراء (ISO string)
  currentAgeWeeks?: number;  // العمر الفعلي بالأسابيع إن وجد (مثلاً 18 أسبوع)
  femalesCount: number;      // عدد الإناث
  malesCount: number;        // عدد الذكور
}

/** دفعة بيض في الفقاسة مع تاريخ حقيقي */
export interface ActiveIncubatorBatch {
  batchCode: string;
  startDate: string;         // تاريخ بدء التحضين (ISO string)
  eggCount: number;          // عدد البيض الموضوع
  fertilizedCount?: number;  // عدد البيض المخصب بعد فحص اليوم 7 (اختياري)
}

export interface FarmBaseline {
  settings: Settings;
  currentLayingHens: number;      // الدجاج البياض المنتج حالياً (مثلاً 10)
  currentRoosters: number;        // الديوك الحالية (مثلاً 5)
  pendingPulletsHens: number;     // إناث العتوكة الحالية (ATK-2611 = 20)
  pendingPulletsMales: number;    // ذكور العتوكة الحالية (ATK-2611 = 2)
  incubatingEggsCount: number;    // البيض الموجود حالياً بالفقاسة (F2611-01 = 71)
  incubatorCapacity: number;      // سعة الفقاسة الفعلية (مثلاً 605)
  rearingBatches: PendingRearingBatch[];    // دفعات التربية مع تواريخها وأعمارها
  incubatorBatches: ActiveIncubatorBatch[]; // دفعات الفقاسة مع تواريخها
  today: string;                   // تاريخ اليوم (ISO string)
}

export interface CalculatedMonthRow extends Omit<ExpansionPlanMonth, 'id' | 'planId'> {
  eggsSold: number;
  eggSalesRevenue: number;
  externalEggCost: number;
  roostersCount: number;
}

export interface ExpansionSummary {
  months: CalculatedMonthRow[];
  targetHensNeeded: number;
  netProfitPerHenMonth: number;
  finalActiveHens: number;
  finalMonthlyProfit: number;
  totalCumulativeProfit: number;
  maxWorkingCapitalGap: number; // أقصى عجز نقدي مؤقت خلال أشهر التربية
  breakEvenMonth: number | null;
  targetReachedMonth: number | null;
  totalIncubatorEggsUsed: number;
  totalMalesSoldRevenue: number;
}

/**
 * حساب تكلفة تربية كتكوت واحد شهرياً عبر الـ 5 أشهر الأولى (د.م)
 * باستخدام أسعار الأعلاف واستهلاك المراحل من الإعدادات
 */
function getMonthlyChickFeedCost(ageMonth: number, settings: Settings): number {
  const { feedPrices, dailyFeedConsumption } = settings;
  // شهر 1: علف بادي (25غ/يوم * 30 = 0.75 كغ)
  if (ageMonth === 1) return ((dailyFeedConsumption.starter * 30) / 1000) * feedPrices.starter + 0.5;
  // شهر 2: انتقال بادي/نامي (~45غ/يوم * 30 = 1.35 كغ)
  if (ageMonth === 2) return ((45 * 30) / 1000) * ((feedPrices.starter + feedPrices.grower) / 2) + 0.4;
  // شهر 3: علف نامي (65غ/يوم * 30 = 1.95 كغ)
  if (ageMonth === 3) return ((dailyFeedConsumption.grower * 30) / 1000) * feedPrices.grower + 0.3;
  // شهر 4: علف نامي (~70غ/يوم * 30 = 2.1 كغ) -> بين 3 و4 أشهر تُباع الذكور
  if (ageMonth === 4) return ((70 * 30) / 1000) * feedPrices.grower + 0.3;
  // شهر 5: علف ما قبل البيض (90غ/يوم * 30 = 2.7 كغ) -> للإناث فقط
  if (ageMonth === 5) return ((dailyFeedConsumption.preLayer * 30) / 1000) * feedPrices.preLayer + 0.4;
  return 0;
}

/**
 * حساب الربح الشهري التقريبي لكل دجاجة بياضة نشطة (مع احتساب نسبة الديوك 1:12)
 */
export function estimateMonthlyProfitPerHen(settings: Settings): number {
  const eggsPerHenMonth = 30 * (settings.targetRates.production / 100);
  const revPerHen = eggsPerHenMonth * settings.sellingPrices.egg;
  const layerFeedCostPerHen = ((settings.dailyFeedConsumption.layer * 30) / 1000) * settings.feedPrices.layer;
  const roosterFeedShare = layerFeedCostPerHen / 12; // 1 ديك لكل 12 دجاجة
  const overheadPerHen = 2; // كهرباء، ماء، فيتامينات، فرشة
  return revPerHen - (layerFeedCostPerHen + roosterFeedShare + overheadPerHen);
}

/**
 * حساب عدد الأسابيع بين تاريخين
 */
function weeksBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * حساب شهر الدخول الفعلي للعتوكة إلى الإنتاج الكامل بناءً على العمر بالأسابيع
 * مثال: عمر 18 أسبوعاً اليوم -> تصل أسبوع 20 خلال أسبوعين وتدخل الإنتاج الكامل في الشهر 2 (بين 1 و2 شهر)
 */
function computePulletArrivalMonth(effectiveAgeWeeks: number): number {
  if (effectiveAgeWeeks >= 20) return 1;
  const weeksToSteadyLay = Math.max(0, 22 - effectiveAgeWeeks);
  return Math.max(2, Math.ceil(weeksToSteadyLay / 4.33));
}

interface Cohort {
  label: string;
  hatchDayOffset: number; // يوم الفقس محسوباً من اليوم (0 = اليوم)
  hatchMonth: number;     // الشهر الذي تفقس فيه
  totalChicks: number;
  females: number;
  malesToSell: number;    // الذكور الموجهة للبيع (عمر 3.5-4 أشهر)
  malesKeptForBreeding: number; // ذكور منتقاة لتغطية التلقيح (1:12)
  arrivalMonth: number;   // الشهر الذي تدخل فيه الإناث للإنتاج (بعد 20 أسبوعاً من الفقس)
  maleSaleMonth: number;  // الشهر الذي تُباع فيه الذكور (عمر 3-4 أشهر = ~110 يوم من الفقس)
  extEggCost: number;
}

/**
 * توليد خطة توسع متكاملة وواقعية للوصول إلى صافي ربح شهري مستهدف (أو هدف 100 دجاجة + ملء الفقاسة 605)
 */
export function generateStrategicExpansionPlan(
  baseline: FarmBaseline,
  options: {
    targetMonthlyProfit?: number;
    durationMonths?: number;
    strategy?: ExpansionStrategy;
    fillIncubatorFull?: boolean;  // خيار ملء الفقاسة بالكامل (605 بيضة)
    monthlyPulletsAdd?: number;   // عدد العتوكة المضافة شهرياً في خطة التدرج (25-30)
    pulletTargetHens?: number;    // عتبة القطيع قبل أو مع الفقاسة (100 دجاجة)
  } = {}
): ExpansionSummary {
  const { settings } = baseline;
  const targetProfit = options.targetMonthlyProfit ?? 5000;
  const duration = options.durationMonths ?? 12;
  const strategy: ExpansionStrategy = options.strategy ?? 'incubator';
  const fillIncubatorFull = options.fillIncubatorFull ?? (strategy === 'pullets_100_full_inc');
  const monthlyPulletsAdd = Math.max(10, Math.min(60, options.monthlyPulletsAdd ?? 25));
  const pulletTargetHens = Math.max(20, options.pulletTargetHens ?? 100);
  const today = baseline.today || new Date().toISOString().split('T')[0];

  const fertilityRate = (settings.targetRates.fertility || 85) / 100;
  const hatchRate = (settings.targetRates.hatch || 80) / 100;
  // نسبة الفقس الفعلي من إجمالي البيض الموضوع = الإخصاب × الفقس
  const overallHatchOfSet = fertilityRate * hatchRate; // 0.85 * 0.80 = 0.68
  const survivalRate = 1 - Math.min(0.15, ((settings.targetRates.maxMortality || 5) + 3) / 100); // ~0.92
  const prodRate = (settings.targetRates.production || 75) / 100;
  const eggPrice = settings.sellingPrices.egg || 2.0;
  const malePrice = settings.sellingPrices.maleBroiler || 30;
  const fertEggPrice = settings.sellingPrices.fertilizedEgg || 3.5;
  const pulletBuyPrice = settings.marketReadyHenPrice || 75;
  const layerFeedG = settings.dailyFeedConsumption.layer || 110;
  const layerFeedPrice = settings.feedPrices.layer || 5.0;
  const incBatchOverhead = (settings.incubatorElectricityCost || 60) + (settings.incubatorCleaningCost || 20);
  const density = settings.housingDensity || 6;
  const incCapacity = Math.max(50, baseline.incubatorCapacity || settings.incubatorCapacity || 605);

  const netProfitPerHenMonth = Math.max(5, estimateMonthlyProfitPerHen(settings));
  // هامش أمان 5% لتعويض النفوق الشهري وضمان البقاء فوق الهدف
  const targetHensNeeded = Math.ceil((targetProfit * 1.05) / netProfitPerHenMonth);

  // ===== 1) تحليل الأصول الحالية =====
  const rearingBatches = baseline.rearingBatches || [];
  const rearingPlanEntries: {
    batchCode: string;
    effectiveAgeWeeks: number;
    femalesCount: number;
    malesCount: number;
    arrivalMonth: number;
    maleSaleMonth: number;
  }[] = [];

  let totalPendingHens = 0;
  for (const rb of rearingBatches) {
    const effectiveAgeWeeks =
      rb.currentAgeWeeks && rb.currentAgeWeeks > 0
        ? rb.currentAgeWeeks
        : Math.max(1, weeksBetween(rb.startDate, today));
    const arrivalMonth = computePulletArrivalMonth(effectiveAgeWeeks);
    // الذكور تُباع بين 3 و4 أشهر (13-16 أسبوعاً)؛ إن بلغت 15 أسبوعاً أو أكثر تُباع في الشهر 1
    const weeksToMaleSale = Math.max(0, 15 - effectiveAgeWeeks);
    const maleSaleMonth = weeksToMaleSale === 0 ? 1 : Math.ceil(weeksToMaleSale / 4.33);

    totalPendingHens += rb.femalesCount;
    rearingPlanEntries.push({
      batchCode: rb.batchCode,
      effectiveAgeWeeks,
      femalesCount: rb.femalesCount,
      malesCount: rb.malesCount,
      arrivalMonth,
      maleSaleMonth,
    });
  }

  // --- دفعات الفقاسة القائمة (مثل F2611-01: 71 بيضة موضوعة منذ ~7 أيام) ---
  const incBatches = baseline.incubatorBatches || [];
  const existingIncDrafts: {
    label: string;
    daysToHatch: number;
    hatchMonth: number;
    totalChicks: number;
    females: number;
    totalMales: number;
    maleSaleMonth: number;
    arrivalMonth: number;
  }[] = [];

  for (const ib of incBatches) {
    const incStartDate = new Date(ib.startDate);
    const todayDate = new Date(today);
    const daysSinceStart = Math.max(0, Math.floor((todayDate.getTime() - incStartDate.getTime()) / (24 * 60 * 60 * 1000)));
    const daysToHatch = Math.max(0, 21 - daysSinceStart);
    const hatchMonth = Math.max(1, Math.ceil(Math.max(1, daysToHatch) / 30));

    const expectedHatched =
      ib.fertilizedCount && ib.fertilizedCount > 0
        ? ib.fertilizedCount * hatchRate
        : ib.eggCount * overallHatchOfSet;

    const totalChicks = Math.round(expectedHatched * survivalRate);
    const females = Math.round(totalChicks * 0.5);
    const totalMales = Math.max(0, totalChicks - females);

    const maleSaleMonth = Math.max(hatchMonth + 3, Math.ceil((daysToHatch + 110) / 30));
    const arrivalMonth = Math.max(hatchMonth + 5, Math.ceil((daysToHatch + 140) / 30));

    existingIncDrafts.push({
      label: ib.batchCode,
      daysToHatch,
      hatchMonth,
      totalChicks,
      females,
      totalMales,
      maleSaleMonth,
      arrivalMonth,
    });
  }

  // ===== 2) حساب الإناث المتوقعة من الأصول الحالية =====
  const existingIncFemales = existingIncDrafts.reduce((s, c) => s + c.females, 0);
  const startingProjectedHens = Math.round(
    (baseline.currentLayingHens + totalPendingHens + existingIncFemales) * 0.96
  );
  const additionalHensNeeded = Math.max(0, targetHensNeeded - startingProjectedHens);

  // ===== 3) جدولة الدفعات (شراء عتوكة + تفقيس) بناءً على الاستراتيجية =====
  const incubatorPlacements: Record<number, { eggs: number }> = {};
  const purchasedArrivals: Record<number, number> = {};

  // نسبة الإناث السالمة لكل بيضة موضوعة = الإخصاب × الفقس × 50% إناث × البقاء
  const femalesPerEgg = overallHatchOfSet * 0.5 * survivalRate; // ~0.3128

  if (strategy === 'pullets_100_full_inc') {
    // 1) إضافة 25-30 عتوكة جاهزة كل شهر حتى الوصول إلى عتبة 100 دجاجة لتوفير سيولة وتخفيف العبء المالي
    let simHens = baseline.currentLayingHens;
    let milestoneMonth = 0;

    for (let m = 1; m <= duration; m++) {
      const mort = m === 1 ? 0 : Math.round(simHens * 0.005);
      const atkAdded = rearingPlanEntries
        .filter(r => r.arrivalMonth === m)
        .reduce((s, r) => s + r.femalesCount, 0);
      const incAdded = existingIncDrafts
        .filter(c => c.arrivalMonth === m)
        .reduce((s, c) => s + c.females, 0);

      simHens = Math.max(0, simHens - mort + atkAdded + incAdded);

      if (simHens < pulletTargetHens) {
        purchasedArrivals[m] = monthlyPulletsAdd;
        simHens += monthlyPulletsAdd;
      }
      if (milestoneMonth === 0 && simHens >= pulletTargetHens) {
        milestoneMonth = m;
      }
    }

    // 2) خيار ملء الفقاسة بالكامل (605 بيضة) بمجرد بلوغ ~100 دجاجة (تمويل ذاتي 100% من بيض المزرعة)
    if (fillIncubatorFull) {
      const firstIncMonth = Math.min(
        Math.max(incBatches.length > 0 ? 2 : 1, milestoneMonth || 3),
        Math.max(2, duration - 5)
      );
      incubatorPlacements[firstIncMonth] = { eggs: incCapacity };

      // إذا كان الهدف الربحي أعلى مما توفره دورة 605 واحدة (~310 دجاجة)، نضيف دورات ممتلئة أخرى
      let projectedWithInc = simHens + Math.round(incCapacity * femalesPerEgg);
      let nextSlot = firstIncMonth + 3;
      const maxSlot = Math.max(2, duration - 5);
      while (projectedWithInc < targetHensNeeded && nextSlot <= maxSlot) {
        incubatorPlacements[nextSlot] = { eggs: incCapacity };
        projectedWithInc += Math.round(incCapacity * femalesPerEgg);
        nextSlot += 3;
      }
    }
  } else if (additionalHensNeeded > 0) {
    if (strategy === 'incubator') {
      const firstMonth = incBatches.length > 0 ? 2 : 1;
      const maxPlacementMonth = Math.max(firstMonth, duration - 5);

      if (fillIncubatorFull) {
        // ملء الفقاسة بالكامل (605 بيضة) في أقل عدد ممكن من الدورات (شامل البيض الخارجي إذا لزم)
        const totalEggsNeeded = Math.ceil(additionalHensNeeded / femalesPerEgg);
        let remainingEggs = Math.max(incCapacity, totalEggsNeeded);
        for (let m = firstMonth; m <= maxPlacementMonth && remainingEggs > 0; m += 2) {
          const batchEggs = remainingEggs >= incCapacity ? incCapacity : Math.min(incCapacity, remainingEggs);
          incubatorPlacements[m] = { eggs: batchEggs };
          remainingEggs = Math.max(0, remainingEggs - batchEggs);
        }
      } else {
        // تفقيس تدريجي ذاتي لتقليل رأس المال المؤقت والاعتماد على بيض المزرعة
        let batchMonths =
          duration <= 12
            ? [firstMonth, firstMonth + 2, firstMonth + 4].filter(m => m <= maxPlacementMonth)
            : [firstMonth, firstMonth + 2, firstMonth + 4, firstMonth + 7, firstMonth + 10].filter(m => m <= maxPlacementMonth);

        if (batchMonths.length === 0) batchMonths = [firstMonth];

        const totalEggsNeeded = Math.ceil(additionalHensNeeded / femalesPerEgg);
        if (totalEggsNeeded > batchMonths.length * incCapacity) {
          const extraMonths: number[] = [];
          for (let m = firstMonth; m <= maxPlacementMonth; m++) {
            extraMonths.push(m);
          }
          batchMonths = extraMonths;
        }

        let remainingEggs = totalEggsNeeded;
        for (let idx = 0; idx < batchMonths.length && remainingEggs > 0; idx++) {
          const bm = batchMonths[idx];
          const slotsLeft = batchMonths.length - idx;
          const suggested = Math.ceil(remainingEggs / slotsLeft);
          const batchEggs = Math.min(incCapacity, Math.max(60, suggested));
          incubatorPlacements[bm] = { eggs: batchEggs };
          remainingEggs = Math.max(0, remainingEggs - batchEggs);
        }
      }
    } else if (strategy === 'hybrid') {
      const incShare = Math.ceil(additionalHensNeeded * 0.65);
      const buyShare = Math.max(0, additionalHensNeeded - incShare);
      if (fillIncubatorFull) {
        incubatorPlacements[2] = { eggs: incCapacity };
        const remainAfterInc = Math.max(0, additionalHensNeeded - Math.round(incCapacity * femalesPerEgg));
        if (remainAfterInc > 0) {
          purchasedArrivals[3] = Math.ceil(remainAfterInc / 2);
          purchasedArrivals[5] = Math.floor(remainAfterInc / 2);
        }
      } else {
        const eggsPerBatch = Math.ceil(incShare / femalesPerEgg / 2);
        incubatorPlacements[2] = { eggs: Math.min(incCapacity, eggsPerBatch) };
        incubatorPlacements[4] = { eggs: Math.min(incCapacity, eggsPerBatch) };
        if (buyShare > 0) {
          purchasedArrivals[3] = Math.ceil(buyShare / 2);
          purchasedArrivals[5] = Math.floor(buyShare / 2);
        }
      }
    } else {
      const perStep = Math.ceil(additionalHensNeeded / 4);
      purchasedArrivals[2] = perStep;
      purchasedArrivals[4] = perStep;
      purchasedArrivals[6] = perStep;
      purchasedArrivals[8] = Math.max(0, additionalHensNeeded - perStep * 3);
    }
  }

  // ===== 4) تجهيز الكوهورتات وحساب احتياج الديوك وفق الحجم الفعلي المتوقع للقطيع =====
  const plannedIncFemales = Object.values(incubatorPlacements).reduce(
    (s, cfg) => s + Math.round(Math.round(cfg.eggs * overallHatchOfSet * survivalRate) * 0.5),
    0
  );
  const totalPurchasedHens = Object.values(purchasedArrivals).reduce((s, n) => s + n, 0);
  const peakProjectedHens = Math.max(
    targetHensNeeded,
    startingProjectedHens + totalPurchasedHens + plannedIncFemales
  );
  const targetRoostersTotal = Math.max(baseline.currentRoosters, Math.ceil(peakProjectedHens / 12));
  let roostersRemainingToAcquire = Math.max(0, targetRoostersTotal - baseline.currentRoosters);

  const cohorts: Cohort[] = [];

  for (const d of existingIncDrafts) {
    const keepForBreeding = Math.min(d.totalMales, Math.min(4, roostersRemainingToAcquire));
    roostersRemainingToAcquire = Math.max(0, roostersRemainingToAcquire - keepForBreeding);
    cohorts.push({
      label: d.label,
      hatchDayOffset: d.daysToHatch,
      hatchMonth: d.hatchMonth,
      totalChicks: d.totalChicks,
      females: d.females,
      malesToSell: Math.max(0, d.totalMales - keepForBreeding),
      malesKeptForBreeding: keepForBreeding,
      arrivalMonth: d.arrivalMonth,
      maleSaleMonth: d.maleSaleMonth,
      extEggCost: 0,
    });
  }

  const plannedEntries = Object.entries(incubatorPlacements).sort((a, b) => Number(a[0]) - Number(b[0]));
  plannedEntries.forEach(([mStr, cfg], idx) => {
    const pm = Number(mStr);
    const setDayOffset = (pm - 1) * 30;
    const hatchDayOffset = setDayOffset + 21;
    const hatchMonth = pm;

    const totalChicks = Math.round(cfg.eggs * overallHatchOfSet * survivalRate);
    const females = Math.round(totalChicks * 0.5);
    const totalMales = Math.max(0, totalChicks - females);

    const remainingBatches = plannedEntries.length - idx;
    const desiredKeep = remainingBatches <= 1 ? roostersRemainingToAcquire : Math.ceil(roostersRemainingToAcquire / remainingBatches);
    const keepForBreeding = Math.min(totalMales, desiredKeep);
    roostersRemainingToAcquire = Math.max(0, roostersRemainingToAcquire - keepForBreeding);
    const malesToSell = Math.max(0, totalMales - keepForBreeding);

    // الذكور تُباع بين 3 و4 أشهر بعد الفقس (110 يوم ≈ 3.7 أشهر)
    const maleSaleMonth = Math.ceil((hatchDayOffset + 110) / 30);
    // الإناث تدخل الإنتاج بعد 20 أسبوعاً من الفقس (140 يوم)
    const arrivalMonth = Math.min(duration, Math.ceil((hatchDayOffset + 140) / 30));

    cohorts.push({
      label: `دفعة فقاسة شهر ${pm}`,
      hatchDayOffset,
      hatchMonth,
      totalChicks,
      females,
      malesToSell,
      malesKeptForBreeding: keepForBreeding,
      arrivalMonth,
      maleSaleMonth,
      extEggCost: 0,
    });
  });

  // ===== 5) محاكاة شهرية دقيقة =====
  const months: CalculatedMonthRow[] = [];
  let activeHens = baseline.currentLayingHens;
  let cumProfit = 0;
  let minCumCash = 0;
  let breakEvenMonth: number | null = null;
  let targetReachedMonth: number | null = null;
  let milestone100Noted = activeHens >= 100;
  let totalIncubatorEggsUsed = 0;
  let totalMalesSoldRevenue = 0;

  for (let m = 1; m <= duration; m++) {
    let addedHens = 0;
    let source: ExpansionSource = 'incubator';
    const notesParts: string[] = [];

    if (m === 1 && incBatches.length > 0) {
      for (const ib of incBatches) {
        const dLeft = Math.max(0, 21 - Math.max(0, Math.floor((new Date(today).getTime() - new Date(ib.startDate).getTime()) / 86400000)));
        notesParts.push(`فقس دفعة ${ib.batchCode} (${ib.eggCount} بيضة خلال ${dLeft} يوم)`);
      }
    }

    // (أ) دخول العتوكة القائمة (ATK-2611)
    for (const rp of rearingPlanEntries) {
      if (rp.arrivalMonth === m && rp.femalesCount > 0) {
        addedHens += rp.femalesCount;
        notesParts.push(`انضمام ${rp.femalesCount} دجاجة من ${rp.batchCode} إلى الإنتاج`);
      }
    }

    // (ب) دخول إناث دفعات الفقاسة بعد 20 أسبوعاً
    for (const c of cohorts) {
      if (c.arrivalMonth === m) {
        addedHens += c.females;
        notesParts.push(`دخول ${c.females} دجاجة من ${c.label}`);
      }
    }

    // (ج) شراء عتوكة جاهزة
    const boughtThisMonth = purchasedArrivals[m] || 0;
    if (boughtThisMonth > 0) {
      addedHens += boughtThisMonth;
      source = 'purchased';
      notesParts.push(`إضافة ${boughtThisMonth} عتوكة جاهزة`);
    }

    // 2) النفوق الشهري للقطيع البياض (~0.5%)
    const mortality = m === 1 ? 0 : Math.round(activeHens * 0.005);
    activeHens = Math.max(0, activeHens - mortality + addedHens);

    if (!milestone100Noted && activeHens >= 100) {
      milestone100Noted = true;
      notesParts.push(`✅ بلوغ عتبة +100 دجاجة بياضة`);
    }

    // 3) إنتاج البيض والبيض المحول للفقاسة (حتى 605 بيضة)
    const expectedEggProduction = Math.round(activeHens * 30 * prodRate);
    const incPlan = incubatorPlacements[m];
    const eggsForInc = incPlan ? incPlan.eggs : 0;
    totalIncubatorEggsUsed += eggsForInc;

    // أقصى ما يُجمع من المزرعة في 10 أيام قبل التحضين = ثلث إنتاج الشهر
    const maxInternal10Days = Math.floor(expectedEggProduction / 3);
    const internalEggsDiverted = Math.min(eggsForInc, maxInternal10Days);
    const externalEggsToBuy = Math.max(0, eggsForInc - internalEggsDiverted);
    const externalEggCost = externalEggsToBuy * fertEggPrice;

    if (eggsForInc > 0) {
      const fullTag = eggsForInc >= incCapacity ? ' (ملء الفقاسة 100%)' : '';
      notesParts.push(
        externalEggsToBuy > 0
          ? `تفقيس ${eggsForInc} بيضة${fullTag} (${internalEggsDiverted} من المزرعة + ${externalEggsToBuy} شراء)`
          : `تفقيس ${eggsForInc} بيضة${fullTag} من إنتاج المزرعة (0 د.م شراء)`
      );
    }

    const eggsSold = Math.max(0, expectedEggProduction - internalEggsDiverted);
    const eggSalesRevenue = eggsSold * eggPrice;

    // 4) مبيعات الذكور (عند عمر 3-4 أشهر)
    let maleSalesRevenue = 0;

    for (const rp of rearingPlanEntries) {
      if (rp.maleSaleMonth === m && rp.malesCount > 0) {
        const rev = rp.malesCount * malePrice;
        maleSalesRevenue += rev;
        notesParts.push(`بيع ${rp.malesCount} ديك من ${rp.batchCode} (+${Math.round(rev)} د.م)`);
      }
    }

    for (const c of cohorts) {
      if (c.maleSaleMonth === m && c.malesToSell > 0) {
        const rev = c.malesToSell * malePrice;
        maleSalesRevenue += rev;
        notesParts.push(`بيع ${c.malesToSell} ديك بعمر 3.5-4 أشهر من ${c.label} (+${Math.round(rev)} د.م)`);
      }
    }

    // 5) تكاليف التربية الشهرية (علف الكتاكيت + شراء العتوكة + تكلفة البيض الخارجي إن وجد)
    let rearingCost = externalEggCost + (eggsForInc > 0 ? incBatchOverhead : 0);

    for (const c of cohorts) {
      const monthStartDay = (m - 1) * 30;
      const monthEndDay = m * 30;
      if (monthEndDay <= c.hatchDayOffset || m >= c.arrivalMonth) continue;

      const daysAliveInMonth = Math.min(30, monthEndDay - Math.max(monthStartDay, c.hatchDayOffset));
      const fractionOfMonth = Math.max(0, daysAliveInMonth / 30);
      const avgAgeDays = (Math.max(monthStartDay, c.hatchDayOffset) + monthEndDay) / 2 - c.hatchDayOffset;
      const ageMonth = Math.min(5, Math.max(1, Math.ceil(avgAgeDays / 30)));

      const birdsToFeed = m > c.maleSaleMonth ? c.females + c.malesKeptForBreeding : c.totalChicks;
      rearingCost += birdsToFeed * getMonthlyChickFeedCost(ageMonth, settings) * fractionOfMonth;
    }

    for (const rp of rearingPlanEntries) {
      if (m < rp.arrivalMonth) {
        const futureAgeWeeks = rp.effectiveAgeWeeks + (m - 1) * 4.33;
        const ageM = futureAgeWeeks >= 18 ? 5 : Math.min(5, Math.max(1, Math.ceil(futureAgeWeeks / 4.33)));
        const birds = rp.femalesCount + (m <= rp.maleSaleMonth ? rp.malesCount : 0);
        rearingCost += birds * getMonthlyChickFeedCost(ageM, settings);
      }
    }

    if (boughtThisMonth > 0) {
      rearingCost += boughtThisMonth * pulletBuyPrice;
    }

    totalMalesSoldRevenue += maleSalesRevenue;

    // 6) تكاليف قطيع البياض والديوك النشطة
    const maturedRetainedRoosters = cohorts
      .filter(c => c.arrivalMonth <= m)
      .reduce((s, c) => s + c.malesKeptForBreeding, 0);
    const roostersCount = Math.max(
      baseline.currentRoosters,
      Math.min(baseline.currentRoosters + maturedRetainedRoosters, Math.max(baseline.currentRoosters, Math.ceil(activeHens / 12)))
    );

    const monthlyFeedKg = ((activeHens + roostersCount) * layerFeedG * 30) / 1000;
    const feedCost = monthlyFeedKg * layerFeedPrice;
    const layerOverhead = activeHens * 2;
    const operationalCost = feedCost + layerOverhead + rearingCost;

    const expectedRevenue = eggSalesRevenue + maleSalesRevenue;
    const expectedProfit = expectedRevenue - operationalCost;
    cumProfit += expectedProfit;

    if (cumProfit < minCumCash) minCumCash = cumProfit;
    if (breakEvenMonth === null && m > 1 && minCumCash < 0 && cumProfit > 0) breakEvenMonth = m;
    if (targetReachedMonth === null && expectedProfit >= targetProfit) {
      targetReachedMonth = m;
      notesParts.push(`🎯 تحقيق هدف +${formatShortNum(targetProfit)} د.م/شهر`);
    }

    const requiredSpaceM2 = Math.ceil((activeHens + roostersCount) / density);
    const selfFinancingGap = expectedProfit < 0 ? Math.abs(expectedProfit) : 0;

    months.push({
      month: m,
      addedHens,
      incubatorEggsUsed: eggsForInc,
      source,
      estimatedMortality: mortality,
      netActiveHens: activeHens,
      requiredSpaceM2,
      monthlyFeedKg: Math.round(monthlyFeedKg * 10) / 10,
      feedCost: Math.round(feedCost),
      rearingCost: Math.round(rearingCost),
      expectedEggProduction,
      eggsSold,
      eggSalesRevenue: Math.round(eggSalesRevenue),
      externalEggCost: Math.round(externalEggCost),
      maleSalesRevenue: Math.round(maleSalesRevenue),
      expectedRevenue: Math.round(expectedRevenue),
      operationalCost: Math.round(operationalCost),
      expectedProfit: Math.round(expectedProfit),
      cumulativeProfit: Math.round(cumProfit),
      selfFinancingGap: Math.round(selfFinancingGap),
      roostersCount,
      milestoneNote: notesParts.join(' • ') || 'إنتاج ومبيعات مستقرة',
    });
  }

  const lastMonth = months[months.length - 1];

  return {
    months,
    targetHensNeeded,
    netProfitPerHenMonth: Math.round(netProfitPerHenMonth * 10) / 10,
    finalActiveHens: lastMonth ? lastMonth.netActiveHens : activeHens,
    finalMonthlyProfit: lastMonth ? lastMonth.expectedProfit : 0,
    totalCumulativeProfit: Math.round(cumProfit),
    maxWorkingCapitalGap: Math.round(Math.abs(minCumCash)),
    breakEvenMonth,
    targetReachedMonth,
    totalIncubatorEggsUsed,
    totalMalesSoldRevenue: Math.round(totalMalesSoldRevenue),
  };
}

function formatShortNum(n: number): string {
  return n.toLocaleString('en-US');
}
