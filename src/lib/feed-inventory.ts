// ============================================================
// حساب مخزون العلف والاستهلاك اليومي المتوقع للقطيع
// ============================================================

import type { FeedMovement, FeedStockType, FlockGroup, Settings } from './types';
import { getDynamicAgeWeeks } from './utils';

export interface FeedInventorySummary {
  currentStockKg: number;
  totalPurchasedKg: number;
  totalConsumedKg: number;
  stockByType: Record<FeedStockType, number>;
  dailyFlockConsumptionKg: number;
  dailyByTypeKg: Record<FeedStockType, number>;
  daysRemaining: number | null;
  estimatedStockValue: number;
}

/**
 * تحديد نوع العلف المناسب لمجموعة قطيع حسب التصنيف والعمر
 */
export function getFlockFeedType(group: FlockGroup): FeedStockType {
  if (group.category === 'layers' || group.category === 'roosters') return 'layer';
  if (group.category === 'chicks') return 'starter';
  if (group.category === 'broilers') return 'grower';
  // pullets
  const liveAgeWeeks = getDynamicAgeWeeks(group.ageWeeks, group.ageReferenceDate || group.createdAt);
  if (liveAgeWeeks <= 6) return 'starter';
  if (liveAgeWeeks <= 18) return 'grower';
  return 'preLayer';
}

/**
 * حساب ملخص مخزون العلف الحالي والاستهلاك اليومي
 */
export function computeFeedInventory(
  movements: FeedMovement[],
  flockGroups: FlockGroup[],
  settings: Settings
): FeedInventorySummary {
  const stockByType: Record<FeedStockType, number> = {
    starter: 0,
    grower: 0,
    preLayer: 0,
    layer: 0,
  };

  let totalPurchasedKg = 0;
  let totalConsumedKg = 0;

  for (const m of movements) {
    const type: FeedStockType = m.feedType || 'layer';
    if (m.movementType === 'purchase') {
      stockByType[type] += m.quantityKg;
      totalPurchasedKg += m.quantityKg;
    } else if (m.movementType === 'consumption') {
      stockByType[type] -= m.quantityKg;
      totalConsumedKg += m.quantityKg;
    } else {
      // adjustment: quantityKg can be positive or negative
      stockByType[type] += m.quantityKg;
    }
  }

  for (const k of Object.keys(stockByType) as FeedStockType[]) {
    stockByType[k] = Math.max(0, Math.round(stockByType[k] * 100) / 100);
  }

  const currentStockKg = Math.max(
    0,
    Math.round((stockByType.starter + stockByType.grower + stockByType.preLayer + stockByType.layer) * 100) / 100
  );

  // الاستهلاك اليومي المقدر من القطيع العام
  const dailyByTypeKg: Record<FeedStockType, number> = {
    starter: 0,
    grower: 0,
    preLayer: 0,
    layer: 0,
  };

  for (const g of flockGroups) {
    const fType = getFlockFeedType(g);
    const gramsPerBird = settings.dailyFeedConsumption?.[fType] ?? 110;
    dailyByTypeKg[fType] += (g.headCount * gramsPerBird) / 1000;
  }

  for (const k of Object.keys(dailyByTypeKg) as FeedStockType[]) {
    dailyByTypeKg[k] = Math.round(dailyByTypeKg[k] * 100) / 100;
  }

  const dailyFlockConsumptionKg = Math.round(
    (dailyByTypeKg.starter + dailyByTypeKg.grower + dailyByTypeKg.preLayer + dailyByTypeKg.layer) * 100
  ) / 100;

  const daysRemaining =
    dailyFlockConsumptionKg > 0 ? Math.floor(currentStockKg / dailyFlockConsumptionKg) : null;

  const estimatedStockValue = Math.round(
    (stockByType.starter * (settings.feedPrices?.starter ?? 5.5) +
      stockByType.grower * (settings.feedPrices?.grower ?? 5) +
      stockByType.preLayer * (settings.feedPrices?.preLayer ?? 5) +
      stockByType.layer * (settings.feedPrices?.layer ?? 5)) *
      100
  ) / 100;

  return {
    currentStockKg,
    totalPurchasedKg: Math.round(totalPurchasedKg * 100) / 100,
    totalConsumedKg: Math.round(totalConsumedKg * 100) / 100,
    stockByType,
    dailyFlockConsumptionKg,
    dailyByTypeKg,
    daysRemaining,
    estimatedStockValue,
  };
}
