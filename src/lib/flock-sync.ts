// ============================================================
// مزامنة القطيع العام مع سجلات الإنتاج اليومي والنفوق
// ============================================================

import { db } from './db';
import type { FlockGroup } from './types';

/**
 * حساب عدد الدجاج البياض النشط من مجموعات القطيع العام
 */
export function getActiveLayingHensFromFlock(flockGroups: FlockGroup[]): number {
  const layerGroups = flockGroups.filter(g => g.category === 'layers');
  if (layerGroups.length === 0) return 0;
  return layerGroups.reduce((sum, g) => sum + (g.femalesCount > 0 ? g.femalesCount : g.headCount), 0);
}

/**
 * خصم النفوق اليومي المسجل في الإنتاج من مجموعة الدجاج البياض وتوثيقه في تاريخ التحركات
 */
export async function applyDailyMortalityToFlock(
  mortalityCount: number,
  date: string,
  sourceNote: string = 'نفوق مسجل من الإنتاج اليومي'
): Promise<void> {
  if (!mortalityCount || mortalityCount <= 0) return;

  const groups = await db.flockGroups.toArray();
  const layerGroups = groups
    .filter(g => g.category === 'layers' && g.headCount > 0)
    .sort((a, b) => b.femalesCount - a.femalesCount);

  if (layerGroups.length === 0) return;

  let remainingToDeduct = mortalityCount;
  for (const g of layerGroups) {
    if (remainingToDeduct <= 0 || !g.id) break;
    const availableFemales = Math.max(0, g.femalesCount);
    const deductFemales = Math.min(availableFemales, remainingToDeduct);
    const nextFemales = Math.max(0, g.femalesCount - deductFemales);
    const nextHeadCount = Math.max(0, g.malesCount + nextFemales);

    if (deductFemales > 0) {
      await db.flockGroups.update(g.id, {
        femalesCount: nextFemales,
        headCount: nextHeadCount,
      });

      await db.flockMovements.add({
        date,
        flockGroupId: g.id,
        flockName: g.name,
        movementType: 'mortality',
        fromLocation: g.housing || g.name,
        malesCount: 0,
        femalesCount: deductFemales,
        totalCount: deductFemales,
        reason: sourceNote,
      });

      remainingToDeduct -= deductFemales;
    }
  }
}
