// ============================================================
// محرك حساب خطة التوسع الاستراتيجية بناءً على المعطيات الفعلية للمزرعة
// ============================================================

import type { Settings, ExpansionPlanMonth, ExpansionSource } from './types';

export interface FarmBaseline {
  settings: Settings;
  currentLayingHens: number;      // الدجاج البياض المنتج حالياً (مثلاً 10)
  currentRoosters: number;        // الديوك الحالية (مثلاً 5)
  pendingPulletsHens: number;     // إناث العتوكة الجاهزة تقريباً (ATK-2611 = 18)
  pendingPulletsMales: number;    // ذكور العتوكة الحالية (ATK-2611 = 4)
  incubatingEggsCount: number;    // البيض الموجود حالياً بالفقاسة (F2611-01 = 71)
  incubatorCapacity: number;      // سعة الفقاسة الفعلية (مثلاً 605)
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

interface Cohort {
  hatchMonth: number;
  totalChicks: number;
  females: number;
  males: number;
  arrivalMonth: number;
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

  // حساب كم دجاجة متوقعة من الأصول الموجودة أصلاً (القطيع الحالي + ATK-2611 + F2611-01)
  const f1Females = Math.round(baseline.incubatingEggsCount * hatchRate * 0.5 * survivalRate);
  const f1Males = Math.round(baseline.incubatingEggsCount * hatchRate * 0.5 * survivalRate);
  const startingProjectedHens = Math.round((baseline.currentLayingHens + baseline.pendingPulletsHens + f1Females) * 0.96);

  const additionalHensNeeded = Math.max(0, targetHensNeeded - startingProjectedHens);

  // جدولة الدفعات بناءً على الاستراتيجية المختارة
  const incubatorPlacements: Record<number, { eggs: number; internalMaxRatio: number; note?: string }> = {};
  const purchasedArrivals: Record<number, number> = {};

  // دائماً: الدفعة القائمة أصلاً (F2611-01) تدخل في الشهر 6، و ATK-2611 تدخل في الشهر 1
  const cohorts: Cohort[] = [];
  if (baseline.incubatingEggsCount > 0) {
    cohorts.push({
      hatchMonth: 1, // بدأت في نوفمبر وتفقس في ديسمبر (الشهر 1)
      totalChicks: f1Females + f1Males,
      females: f1Females,
      males: f1Males,
      arrivalMonth: 6,
      extEggCost: 0, // تكلفتها مدفوعة مسبقاً
    });
  }

  // عدد الإناث لكل 100 بيضة في الفقاسة
  const femalesPerEgg = hatchRate * 0.5 * survivalRate; // ~0.368

  if (additionalHensNeeded > 0) {
    if (strategy === 'incubator') {
      // توزيع الدفعات في الأشهر 2، 4، 6 (تصل للإنتاج في الأشهر 7، 9، 11)
      // وإذا كانت المدة 24 شهراً نوزع حتى الشهر 18 إذا دعت الحاجة
      const batchMonths = duration <= 12 ? [2, 4, 6] : [2, 4, 6, 9, 12];
      const totalEggsNeeded = Math.ceil(additionalHensNeeded / femalesPerEgg);
      const eggsPerBatch = Math.ceil(totalEggsNeeded / batchMonths.length);

      for (const bm of batchMonths) {
        incubatorPlacements[bm] = {
          eggs: Math.min(baseline.incubatorCapacity || 605, Math.max(60, eggsPerBatch)),
          internalMaxRatio: 1,
        };
      }
    } else if (strategy === 'hybrid') {
      // نصف العدد من الفقاسة (أشهر 2 و 4) والنصف بشراء عتوكة جاهزة (شهور 3 و 5 و 7)
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
      // شراء عتوكة جاهزة مباشرة على دفعات
      const perStep = Math.ceil(additionalHensNeeded / 4);
      purchasedArrivals[2] = perStep;
      purchasedArrivals[4] = perStep;
      purchasedArrivals[6] = perStep;
      purchasedArrivals[8] = Math.max(0, additionalHensNeeded - perStep * 3);
    }
  }

  // تجهيز الكوهورتات من دفعات الفقاسة المخططة
  Object.entries(incubatorPlacements).forEach(([mStr, cfg]) => {
    const pm = Number(mStr);
    const totalChicks = Math.round(cfg.eggs * hatchRate * survivalRate);
    const females = Math.round(totalChicks * 0.5);
    const males = totalChicks - females;
    cohorts.push({
      hatchMonth: pm, // يوضع أول الشهر ويفقس في الأسبوع 3 من نفس الشهر
      totalChicks,
      females,
      males,
      arrivalMonth: pm + 5, // يدخل الإنتاج بعد 20 أسبوعاً (الشهر pm + 5)
      extEggCost: 0, // يُحسب ديناميكياً إذا تجاوز إنتاج المزرعة في 10 أيام
    });
  });

  // محاكاة شهرية دقيقة
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

    if (m === 1 && baseline.pendingPulletsHens > 0) {
      addedHens += baseline.pendingPulletsHens;
      notesParts.push(`انضمام ${baseline.pendingPulletsHens} دجاجة من دفعة ATK-2611`);
    }

    for (const c of cohorts) {
      if (c.arrivalMonth === m) {
        addedHens += c.females;
        notesParts.push(
          c.hatchMonth === 1 && baseline.incubatingEggsCount > 0
            ? `بداية إنتاج ${c.females} دجاجة من فقاسة F2611-01`
            : `دخول ${c.females} دجاجة من دفعة فقاسة شهر ${c.hatchMonth}`
        );
      }
    }

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

    // 4) مبيعات الذكور (ذكور ATK-2611 في الشهر 2، وذكور الدفعات في الشهر الرابع من عمرها)
    let maleSalesRevenue = 0;
    if (m === 2 && baseline.pendingPulletsMales > 0) {
      maleSalesRevenue += baseline.pendingPulletsMales * malePrice;
      notesParts.push(`بيع ${baseline.pendingPulletsMales} ديوك من ATK-2611`);
    }

    // 5) حساب تكلفة تربية الكتاكيت قيد النمو هذا الشهر
    let rearingCost = externalEggCost + (eggsForInc > 0 ? incBatchOverhead : 0);
    for (const c of cohorts) {
      const ageM = m - c.hatchMonth + 1;
      if (ageM >= 1 && ageM <= 4) {
        rearingCost += c.totalChicks * getMonthlyChickFeedCost(ageM, settings);
        if (ageM === 4) {
          maleSalesRevenue += c.males * malePrice;
          notesParts.push(`بيع ${c.males} ديك (+${Math.round(c.males * malePrice)} د.م)`);
        }
      } else if (ageM === 5) {
        // الإناث فقط في الشهر الخامس
        rearingCost += c.females * getMonthlyChickFeedCost(5, settings);
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
