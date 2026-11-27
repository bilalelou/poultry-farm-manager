// ============================================================
// دالة موحدة لنقل دفعة التربية المكتملة إلى قطيع الإنتاج + القطيع العام + التقييم
// ============================================================

import { db } from './db';
import type { RearingBatch } from './types';
import { getDynamicAgeWeeks, todayISO } from './utils';
import { logSystemEvent } from './logger';

export interface TransferResult {
  femalesTransferred: number;
  malesIsolated: number;
  newActiveLayerCount: number;
}

/**
 * نقل الإناث السليمة فقط من دفعة تربية إلى الإنتاج وتحديث الجداول المرتبطة تلقائياً:
 * 1) rearingBatches -> transferred
 * 2) dailyProduction -> إضافة الإناث فقط إلى activeHenCount
 * 3) flockGroups -> خصم الإناث من العتوكة وإضافتها للقطيع البياض
 * 4) valuationItems -> تحديث قيمة قطيع البياض والعتوكة
 */
export async function transferRearingBatchToProduction(
  batch: RearingBatch,
  remainingOverride?: number
): Promise<TransferResult> {
  if (!batch.id) {
    throw new Error('معرّف الدفعة غير موجود');
  }

  const initial = batch.initialChickCount || 0;
  const mortality = batch.mortalityCount ?? 0;
  const healthyCount =
    remainingOverride !== undefined
      ? remainingOverride
      : batch.currentHealthyCount ?? Math.max(0, initial - mortality);
  const malesCount = batch.malesCount ?? 0;
  const femalesCount = Math.max(0, healthyCount - malesCount);

  // 1) تحديث حالة دفعة التربية
  await db.rearingBatches.update(batch.id, { status: 'transferred' });

  // 2) تحديث سجل الإنتاج اليومي بالإناث البياضة فقط
  const prods = await db.dailyProduction.orderBy('date').reverse().toArray();
  const currentActive = prods.length > 0 ? Math.max(0, prods[0].activeHenCount - prods[0].dailyMortality) : 10;
  const newTotal = currentActive + femalesCount;
  const today = todayISO();
  const existingToday = prods.find(p => p.date === today);

  if (existingToday && existingToday.id) {
    await db.dailyProduction.update(existingToday.id, {
      activeHenCount: existingToday.activeHenCount + femalesCount,
      notes:
        (existingToday.notes ? existingToday.notes + ' | ' : '') +
        `انضمام ${femalesCount} إناث بياضة من ${batch.batchCode} (${malesCount} ذكور تم عزلها)`,
    });
  } else {
    await db.dailyProduction.add({
      date: today,
      activeHenCount: newTotal,
      dailyMortality: 0,
      totalEggsCollected: 0,
      brokenEggs: 0,
      incubatorEggs: 0,
      personalUse: 0,
      netSaleableEggs: 0,
      productionRate: 0,
      notes: `انضمام ${femalesCount} إناث بياضة من الدفعة ${batch.batchCode} إلى قطيع الإنتاج (${malesCount} ذكور معزولة) — المجموع: ${newTotal} دجاجة`,
    });
  }

  // 3) مزامنة القطيع العام (flockGroups)
  try {
    const flocks = await db.flockGroups.toArray();
    const pulletGroup =
      flocks.find(f => f.category === 'pullets' && (f.notes?.includes(batch.batchCode) || f.name.includes(batch.batchCode))) ||
      flocks.find(f => f.category === 'pullets');

    if (pulletGroup?.id) {
      const remFemales = Math.max(0, pulletGroup.femalesCount - femalesCount);
      const remMales = pulletGroup.malesCount; // الذكور المعزولة تبقى أو تُدار ضمن قسم الذكور
      if (remFemales === 0 && remMales === 0) {
        await db.flockGroups.delete(pulletGroup.id);
      } else {
        await db.flockGroups.update(pulletGroup.id, {
          femalesCount: remFemales,
          headCount: remFemales + remMales,
          notes: `تم نقل ${femalesCount} إناث إلى البياض من ${batch.batchCode} (المتبقي: ${remFemales} إناث + ${remMales} ذكور)`,
        });
      }
    }

    const layerGroup = flocks.find(f => f.category === 'layers');
    if (layerGroup?.id) {
      const updatedFemales = layerGroup.femalesCount + femalesCount;
      await db.flockGroups.update(layerGroup.id, {
        femalesCount: updatedFemales,
        headCount: updatedFemales + layerGroup.malesCount,
        notes: `${layerGroup.notes ? layerGroup.notes + ' • ' : ''}انضمام +${femalesCount} من ${batch.batchCode}`,
      });
    } else if (femalesCount > 0) {
      await db.flockGroups.add({
        name: 'القطيع البياض الرئيسي',
        category: 'layers',
        breed: 'بلدي',
        headCount: femalesCount,
        malesCount: 0,
        femalesCount,
        ageWeeks: 21,
        ageReferenceDate: todayISO(),
        housing: 'عنبر 1 - البياضات',
        healthStatus: 'ممتازة',
        notes: `منقول من الدفعة ${batch.batchCode}`,
      });
    }
  } catch (err) {
    console.warn('Flock sync warning during transfer:', err);
  }

  // 4) مزامنة أصول التقييم (valuationItems) في صفحة المستثمرين
  try {
    const vals = await db.valuationItems.toArray();
    const layerVal = vals.find(v => v.category === 'livestock' && v.name.includes('بياض'));
    if (layerVal?.id && femalesCount > 0) {
      const newQty = layerVal.quantity + femalesCount;
      await db.valuationItems.update(layerVal.id, {
        quantity: newQty,
        totalValue: newQty * layerVal.unitValue,
        name: `قطيع دجاج بياض منتج (${newQty} دجاجة)`,
      });
    }

    const pulletVal = vals.find(
      v => v.category === 'livestock' && (v.name.includes('عتوكة') || v.notes?.includes(batch.batchCode))
    );
    if (pulletVal?.id) {
      const remQty = Math.max(0, pulletVal.quantity - femalesCount);
      await db.valuationItems.update(pulletVal.id, {
        quantity: remQty,
        totalValue: remQty * pulletVal.unitValue,
        name: remQty > 0 ? `قطيع عتوكة متبقي (${remQty} طير)` : 'قطيع عتوكة (تم النقل للبياض)',
      });
    }
  } catch (err) {
    console.warn('Valuation sync warning during transfer:', err);
  }

  return {
    femalesTransferred: femalesCount,
    malesIsolated: malesCount,
    newActiveLayerCount: newTotal,
  };
}

let autoTransferLock: Promise<string[]> | null = null;

/**
 * فحص دفعات التربية التي أتمت الأسبوع 21 مع تفعيل النقل التلقائي ونقلها تلقائياً للإنتاج
 */
export async function checkAndRunAutoTransfers(): Promise<string[]> {
  if (autoTransferLock) return autoTransferLock;

  autoTransferLock = (async () => {
    const transferredCodes: string[] = [];
    try {
      const batches = await db.rearingBatches.toArray();
      for (const b of batches) {
        if (b.status === 'transferred') continue;
        if (b.autoTransferToProduction === false) continue;

        const week = getDynamicAgeWeeks(b.currentAgeWeeks, b.ageReferenceDate || b.createdAt, b.startDate);
        if (week >= 21) {
          const res = await transferRearingBatchToProduction(b);
          transferredCodes.push(b.batchCode);
          await logSystemEvent({
            level: 'info',
            source: 'ui',
            page: '/rearing',
            message: `تم النقل التلقائي للدفعة ${b.batchCode} إلى الإنتاج عند إتمام الأسبوع ${week} (+${res.femalesTransferred} أنثى)`,
          });
        }
      }
    } catch (err) {
      console.error('Auto-transfer check failed:', err);
    } finally {
      autoTransferLock = null;
    }
    return transferredCodes;
  })();

  return autoTransferLock;
}

