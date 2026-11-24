// ============================================================
// محرك حساب خطة التوسع الاستراتيجية بناءً على المعطيات الفعلية للمزرعة
// ============================================================

import type { Settings, ExpansionPlanMonth, ExpansionSource } from './types';

/** دفعة عتوكة قيد التربية مع تاريخ حقيقي */
export interface PendingRearingBatch {
  batchCode: string;
  startDate: string;         // تاريخ بداية التربية (ISO string)
  femalesCount: number;      // عدد الإناث
  malesCount: number;        // عدد الذكور
}

/** دفعة بيض في الفقاسة مع تاريخ حقيقي */
export interface ActiveIncubatorBatch {
  batchCode: string;
  startDate: string;         // تاريخ بدء التحضين (ISO string)
  eggCount: number;          // عدد البيض
}

export interface FarmBaseline {
  settings: Settings;
  currentLayingHens: number;      // الدجاج البياض المنتج حالياً (مثلاً 10)
  currentRoosters: number;        // الديوك الحالية (مثلاً 5)
  pendingPulletsHens: number;     // إناث العتوكة الجاهزة تقريباً (ATK-2611 = 18)
  pendingPulletsMales: number;    // ذكور العتوكة الحالية (ATK-2611 = 4)
  incubatingEggsCount: number;    // البيض الموجود حالياً بالفقاسة (F2611-01 = 71)
  incubatorCapacity: number;      // سعة الفقاسة الفعلية (مثلاً 605)
  // بيانات التوقيت الحقيقية
  rearingBatches: PendingRearingBatch[];  // دفعات التربية مع تواريخها
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
  if (ageMonth === 1) return (dailyFeedConsumption.starter * 30 / 1000) * feedPrices.starter + 0.5;
  // شهر 2: نصف بادي ونصف نامي (~45غ/يوم * 30 = 1.35 كغ)
  if (ageMonth === 2) return (45 * 30 / 1000) * ((feedPrices.starter + feedPrices.grower) / 2) + 0.4;
  // شهر 3: علف نامي (65غ/يوم * 30 = 1.95 كغ)
  if (ageMonth === 3) return (dailyFeedConsumption.grower * 30 / 1000) * feedPrices.grower + 0.3;
  // شهر 4: علف نامي (~70غ/يوم * 30 = 2.1 كغ) -> نهاية الشهر 4 تُباع الذكور
  if (ageMonth === 4) return (70 * 30 / 1000) * feedPrices.grower + 0.3;
  // شهر 5: علف ما قبل البيض (90غ/يوم * 30 = 2.7 كغ) -> للإناث فقط
  if (ageMonth === 5) return (dailyFeedConsumption.preLayer * 30 / 1000) * feedPrices.preLayer + 0.4;
  return 0;
}

/**
 * حساب الربح الشهري التقريبي لكل دجاجة بياضة نشطة (مع الأخذ بعين الاعتبار نسبة الديوك 1:12)
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
 * حساب الفرق بالأشهر بين تاريخين
 */
function monthsBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * حساب عدد الأسابيع بين تاريخين
 */
function weeksBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return Math.floor((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

interface Cohort {
  label: string;         // وصف المصدر (مثلاً "F2611-01" أو "دفعة شهر 4")
  hatchMonth: number;
  totalChicks: number;
  females: number;
  males: number;
  arrivalMonth: number;  // الشهر الذي تدخل فيه الإناث للإنتاج
  maleSaleMonth: number; // الشهر الذي تُباع فيه الذكور (عمر 3-4 أشهر)
  extEggCost: number;
}

/**
 * توليد خطة توسع متكاملة وواقعية للوصول إلى صافي ربح شهري مستهدف (الافتراضي: 5000 د.م/شهر)
 */
export function generateStrategicExpansionPlan(
  baseline: FarmBaseline,
  options: {
    targetMonthlyProfit?: number;
    durationMonths?: number;
    strategy?: 'incubator' | 'hybrid' | 'purchased';
  } = {}
): ExpansionSummary {
  const { settings } = baseline;
  const targetProfit = options.targetMonthlyProfit ?? 5000;
  const duration = options.durationMonths ?? 12;
  const strategy = options.strategy ?? 'incubator';
  const today = baseline.today || new Date().toISOString().split('T')[0];

  const hatchRate = (settings.targetRates.hatch || 80) / 100;
  const survivalRate = 1 - Math.min(0.15, ((settings.targetRates.maxMortality || 5) + 3) / 100); // ~92% survival to week 20
  const prodRate = (settings.targetRates.production || 75) / 100;
  const eggPrice = settings.sellingPrices.egg || 2.0;
  const malePrice = settings.sellingPrices.maleBroiler || 30;
  const fertEggPrice = settings.sellingPrices.fertilizedEgg || 3.5;
  const pulletBuyPrice = settings.marketReadyHenPrice || 75;
  const layerFeedG = settings.dailyFeedConsumption.layer || 110;
  const layerFeedPrice = settings.feedPrices.layer || 5.0;
  const incBatchOverhead = (settings.incubatorElectricityCost || 60) + (settings.incubatorCleaningCost || 20);
  const density = settings.housingDensity || 6;

  const netProfitPerHenMonth = Math.max(5, estimateMonthlyProfitPerHen(settings));
  // هامش أمان 5% لتعويض النفوق الشهري وضمان البقاء فوق الهدف
  const targetHensNeeded = Math.ceil((targetProfit * 1.05) / netProfitPerHenMonth);

  // ===== 1) بناء الكوهورتات من الأصول الحقيقية =====
  const cohorts: Cohort[] = [];

  // --- (أ) دفعات التربية الحقيقية (مثل ATK-2611) ---
  // حساب شهر دخول الإنتاج بناءً على عمرها الحالي وعمر الإنتاج (20 أسبوع)
  const rearingBatches = baseline.rearingBatches || [];
  let totalPendingHens = 0;
  let totalPendingMales = 0;
  const pendingMaleSales: { month: number; count: number; label: string }[] = [];

  for (const rb of rearingBatches) {
    const currentAgeWeeks = weeksBetween(rb.startDate, today);
    const weeksToProduction = Math.max(0, 20 - currentAgeWeeks);
    // الشهر الذي تدخل فيه الإنتاج (من اليوم): ceil(الأسابيع المتبقية / 4.33)
    const arrivalMonth = Math.max(1, Math.ceil(weeksToProduction / 4.33));

    totalPendingHens += rb.femalesCount;
    totalPendingMales += rb.malesCount;

    // حساب شهر بيع الذكور: عندما يبلغ عمر الذكور ~16 أسبوع (4 أشهر)
    const weeksToMaleSale = Math.max(0, 16 - currentAgeWeeks);
    const maleSaleMonth = Math.max(1, Math.ceil(weeksToMaleSale / 4.33));

    if (rb.malesCount > 0) {
      pendingMaleSales.push({
        month: maleSaleMonth,
        count: rb.malesCount,
        label: rb.batchCode,
      });
    }

    // ملاحظة: دفعات التربية لا تُضاف كـ cohort لأنها ليست من الفقاسة
    // بل تُضاف مباشرة كدجاجات جديدة في شهر الدخول
  }

  // --- (ب) دفعات الفقاسة الحقيقية (مثل F2611-01) ---
  const incBatches = baseline.incubatorBatches || [];

  for (const ib of incBatches) {
    const incStartDate = new Date(ib.startDate);
    const todayDate = new Date(today);
    const daysSinceStart = Math.floor((todayDate.getTime() - incStartDate.getTime()) / (24 * 60 * 60 * 1000));
    const daysToHatch = Math.max(0, 21 - daysSinceStart);
    // الشهر الذي تفقس فيه (من اليوم)
    const hatchMonth = daysToHatch <= 15 ? 1 : Math.ceil(daysToHatch / 30);

    const totalChicks = Math.round(ib.eggCount * hatchRate * survivalRate);
    const females = Math.round(totalChicks * 0.5);
    const males = totalChicks - females;

    // بعد الفقس، 5 أشهر تربية حتى الإنتاج
    const arrivalMonth = hatchMonth + 5;
    // الذكور تُباع بعد 4 أشهر من الفقس
    const maleSaleMonth = hatchMonth + 4;

    cohorts.push({
      label: ib.batchCode,
      hatchMonth,
      totalChicks,
      females,
      males,
      arrivalMonth,
      maleSaleMonth,
      extEggCost: 0, // تكلفتها مدفوعة مسبقاً
    });
  }

  // ===== 2) حساب الإناث المتوقعة من الأصول الحالية =====
  const f1Females = cohorts.reduce((s, c) => s + c.females, 0);
  const startingProjectedHens = Math.round(
    (baseline.currentLayingHens + totalPendingHens + f1Females) * 0.96
  );
  const additionalHensNeeded = Math.max(0, targetHensNeeded - startingProjectedHens);

  // ===== 3) جدولة دفعات الفقاسة المخططة =====
  const incubatorPlacements: Record<number, { eggs: number; internalMaxRatio: number; note?: string }> = {};
  const purchasedArrivals: Record<number, number> = {};

  const femalesPerEgg = hatchRate * 0.5 * survivalRate; // ~0.368

  if (additionalHensNeeded > 0) {
    if (strategy === 'incubator') {
      // تحديد الأشهر الممكنة للتفقيس (تجنب الشهر الأول إذا الفقاسة مشغولة)
      const firstAvailableMonth = incBatches.length > 0 ? 2 : 1;
      const batchMonths = duration <= 12
        ? [firstAvailableMonth, firstAvailableMonth + 2, firstAvailableMonth + 4].filter(m => m <= duration - 5)
        : [firstAvailableMonth, firstAvailableMonth + 2, firstAvailableMonth + 4, firstAvailableMonth + 7, firstAvailableMonth + 10].filter(m => m <= duration - 5);

      if (batchMonths.length === 0) batchMonths.push(firstAvailableMonth);

      const totalEggsNeeded = Math.ceil(additionalHensNeeded / femalesPerEgg);
      const eggsPerBatch = Math.ceil(totalEggsNeeded / batchMonths.length);

      for (const bm of batchMonths) {
        incubatorPlacements[bm] = {
          eggs: Math.min(baseline.incubatorCapacity || 605, Math.max(60, eggsPerBatch)),
          internalMaxRatio: 1,
        };
      }
    } else if (strategy === 'hybrid') {
      const incShare = Math.ceil(additionalHensNeeded * 0.65);
      const buyShare = Math.max(0, additionalHensNeeded - incShare);
      const eggsPerBatch = Math.ceil((incShare / femalesPerEgg) / 2);
      incubatorPlacements[2] = { eggs: Math.min(baseline.incubatorCapacity || 605, eggsPerBatch), internalMaxRatio: 1 };
      incubatorPlacements[4] = { eggs: Math.min(baseline.incubatorCapacity || 605, eggsPerBatch), internalMaxRatio: 1 };
      if (buyShare > 0) {
        purchasedArrivals[3] = Math.ceil(buyShare / 2);
        purchasedArrivals[5] = Math.floor(buyShare / 2);
      }
    } else {
      const perStep = Math.ceil(additionalHensNeeded / 4);
      purchasedArrivals[2] = perStep;
      purchasedArrivals[4] = perStep;
      purchasedArrivals[6] = perStep;
      purchasedArrivals[8] = Math.max(0, additionalHensNeeded - perStep * 3);
    }
  }

  // ===== 4) تجهيز الكوهورتات من دفعات الفقاسة المخططة =====
  Object.entries(incubatorPlacements).forEach(([mStr, cfg]) => {
    const pm = Number(mStr);
    const totalChicks = Math.round(cfg.eggs * hatchRate * survivalRate);
    const females = Math.round(totalChicks * 0.5);
    const males = totalChicks - females;
    cohorts.push({
      label: `دفعة فقاسة شهر ${pm}`,
      hatchMonth: pm,
      totalChicks,
      females,
      males,
      arrivalMonth: pm + 5,
      maleSaleMonth: pm + 4, // الذكور تُباع بعد 4 أشهر من الفقس
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
  let totalIncubatorEggsUsed = 0;
  let totalMalesSoldRevenue = 0;

  for (let m = 1; m <= duration; m++) {
    // 1) الدجاجات الجديدة التي تدخل الإنتاج هذا الشهر
    let addedHens = 0;
    let source: ExpansionSource = 'incubator';
    const notesParts: string[] = [];

    // (أ) العتوكة الحقيقية (ATK-2611 وغيرها) - تدخل الإنتاج في الشهر المحسوب
    for (const rb of rearingBatches) {
      const currentAgeWeeks = weeksBetween(rb.startDate, today);
      const weeksToProduction = Math.max(0, 20 - currentAgeWeeks);
      const arrivalMonth = Math.max(1, Math.ceil(weeksToProduction / 4.33));

      if (m === arrivalMonth && rb.femalesCount > 0) {
        addedHens += rb.femalesCount;
        notesParts.push(`انضمام ${rb.femalesCount} دجاجة من دفعة ${rb.batchCode} (عمر 20 أسبوع)`);
      }
    }

    // (ب) كوهورتات الفقاسة (حالية ومخططة) - تدخل الإنتاج بعد 5 أشهر من الفقس
    for (const c of cohorts) {
      if (c.arrivalMonth === m) {
        addedHens += c.females;
        notesParts.push(
          `بداية إنتاج ${c.females} دجاجة من ${c.label}`
        );
      }
    }

    // (ج) شراء عتوكة جاهزة
    const boughtThisMonth = purchasedArrivals[m] || 0;
    if (boughtThisMonth > 0) {
      addedHens += boughtThisMonth;
      source = 'purchased';
      notesParts.push(`شراء ${boughtThisMonth} عتوكة جاهزة`);
    }

    // 2) النفوق الشهري (~0.5% للقطيع البياض)
    const mortality = m === 1 ? 0 : Math.round(activeHens * 0.005);
    activeHens = Math.max(0, activeHens - mortality + addedHens);

    // 3) البيض المنتج والبيض المحول للفقاسة
    const expectedEggProduction = Math.round(activeHens * 30 * prodRate);
    const incPlan = incubatorPlacements[m];
    const eggsForInc = incPlan ? incPlan.eggs : 0;
    totalIncubatorEggsUsed += eggsForInc;

    // أقصى ما يمكن جمعه من بيض المزرعة المخصب في 10 أيام قبل التحضين هو ثلث إنتاج الشهر
    const maxInternal10Days = Math.floor(expectedEggProduction / 3);
    const internalEggsDiverted = Math.min(eggsForInc, maxInternal10Days);
    const externalEggsToBuy = Math.max(0, eggsForInc - internalEggsDiverted);
    const externalEggCost = externalEggsToBuy * fertEggPrice;

    if (eggsForInc > 0) {
      notesParts.push(
        externalEggsToBuy > 0
          ? `تفقيس ${eggsForInc} بيضة (${internalEggsDiverted} من المزرعة + ${externalEggsToBuy} شراء)`
          : `تفقيس ${eggsForInc} بيضة من إنتاج المزرعة (0 د.م شراء)`
      );
    }

    const eggsSold = Math.max(0, expectedEggProduction - internalEggsDiverted);
    const eggSalesRevenue = eggsSold * eggPrice;

    // 4) مبيعات الذكور
    let maleSalesRevenue = 0;

    // (أ) ذكور العتوكة الحقيقية (ATK-2611 وغيرها) - تُباع عند عمر ~16 أسبوع
    for (const pms of pendingMaleSales) {
      if (pms.month === m) {
        maleSalesRevenue += pms.count * malePrice;
        notesParts.push(`بيع ${pms.count} ديك من ${pms.label} (+${Math.round(pms.count * malePrice)} د.م)`);
      }
    }

    // (ب) ذكور كوهورتات الفقاسة - تُباع في maleSaleMonth (4 أشهر بعد الفقس)
    for (const c of cohorts) {
      if (c.maleSaleMonth === m && c.males > 0) {
        maleSalesRevenue += c.males * malePrice;
        notesParts.push(`بيع ${c.males} ديك من ${c.label} (+${Math.round(c.males * malePrice)} د.م)`);
      }
    }

    // 5) حساب تكلفة تربية الكتاكيت قيد النمو هذا الشهر
    let rearingCost = externalEggCost + (eggsForInc > 0 ? incBatchOverhead : 0);

    // تكلفة تربية كوهورتات الفقاسة
    for (const c of cohorts) {
      const ageM = m - c.hatchMonth + 1;
      if (ageM >= 1 && ageM <= 4) {
        // الشهور 1-4: كل الكتاكيت (ذكور + إناث)
        const chicksAlive = ageM <= c.maleSaleMonth - c.hatchMonth + 1 ? c.totalChicks : c.females;
        rearingCost += chicksAlive * getMonthlyChickFeedCost(ageM, settings);
      } else if (ageM === 5) {
        // الشهر 5: الإناث فقط (الذكور بيعت)
        rearingCost += c.females * getMonthlyChickFeedCost(5, settings);
      }
    }

    // تكلفة تربية العتوكة الحقيقية (إن كانت لا تزال في مرحلة التربية)
    for (const rb of rearingBatches) {
      const currentAgeWeeks = weeksBetween(rb.startDate, today);
      const arrivalMonth = Math.max(1, Math.ceil(Math.max(0, 20 - currentAgeWeeks) / 4.33));
      // هل لا تزال في مرحلة التربية خلال هذا الشهر؟
      if (m < arrivalMonth) {
        const ageAtMonth = currentAgeWeeks + (m * 4.33);
        const ageMonth = Math.ceil(ageAtMonth / 4.33);
        const feedAgeM = Math.min(5, Math.max(1, ageMonth));
        const totalBirds = rb.femalesCount + rb.malesCount;
        // تكلفة علف مخفضة لأنهم أكبر سناً
        rearingCost += totalBirds * getMonthlyChickFeedCost(feedAgeM, settings);
      }
    }

    if (boughtThisMonth > 0) {
      rearingCost += boughtThisMonth * pulletBuyPrice;
    }

    totalMalesSoldRevenue += maleSalesRevenue;

    // 6) تكاليف قطيع البياض والديوك
    const roostersCount = Math.max(baseline.currentRoosters, Math.ceil(activeHens / 12));
    const monthlyFeedKg = ((activeHens + roostersCount) * layerFeedG * 30) / 1000;
    const feedCost = monthlyFeedKg * layerFeedPrice;
    const layerOverhead = activeHens * 2;
    const operationalCost = feedCost + layerOverhead + rearingCost;

    const expectedRevenue = eggSalesRevenue + maleSalesRevenue;
    const expectedProfit = expectedRevenue - operationalCost;
    cumProfit += expectedProfit;

    if (cumProfit < minCumCash) minCumCash = cumProfit;
    if (breakEvenMonth === null && m > 4 && cumProfit > 0) breakEvenMonth = m;
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
