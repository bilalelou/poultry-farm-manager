// ============================================================
// محرك التنبيهات الذكية المبني على البيانات الحية للمزرعة
// ============================================================

import { db, getSettings } from './db';
import { DEFAULT_VACCINATION_SCHEDULE } from './types';
import { getIncubatorDay, getDynamicAgeWeeks } from './utils';
import { computeFeedInventory } from './feed-inventory';
import { checkAndRunAutoTransfers } from './transfer-helpers';

export interface SmartAlert {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  category: 'incubator' | 'rearing' | 'vaccination' | 'production' | 'feed';
  title: string;
  message: string;
  href: string;
}

/**
 * استخراج قائمة التنبيهات الحالية مباشرة من حالة الفقاسة والتربية والإنتاج واللقاحات
 */
export async function computeFarmAlerts(): Promise<SmartAlert[]> {
  // فحص وتنفيذ النقل التلقائي للدفعات التي أتمت الأسبوع 21 قبل حساب التنبيهات
  const autoTransferred = await checkAndRunAutoTransfers();

  const [settings, incBatches, rearingBatches, productions, logs, feedMovements, flockGroups] = await Promise.all([
    getSettings(),
    db.incubatorBatches.toArray(),
    db.rearingBatches.toArray(),
    db.dailyProduction.toArray(),
    db.rearingWeeklyLogs.toArray(),
    db.feedMovements.toArray(),
    db.flockGroups.toArray(),
  ]);

  const alerts: SmartAlert[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  for (const code of autoTransferred) {
    alerts.push({
      id: `rear-autotrans-${code}-${todayStr}`,
      type: 'success',
      category: 'rearing',
      title: `تم النقل التلقائي للدفعة ${code} للإنتاج`,
      message: `أتمت الدفعة الأسبوع 21 ولم تُنقل يدوياً، فتم تحويل الإناث السليمة تلقائياً إلى قطيع الإنتاج.`,
      href: '/rearing',
    });
  }

  // 1) تنبيهات الفقاسة (اليوم 7 فحص ضوئي، اليوم 18 إيقاف التقليب، اليوم 21 فقس، جاهزية النقل)
  for (const b of incBatches) {
    if (b.status === 'incubating') {
      const day = getIncubatorDay(b.startDate);
      if (day >= 7 && day < 18 && (b.fertilizedCount === undefined || b.fertilizedCount === null)) {
        alerts.push({
          id: `inc-candling-${b.id}`,
          type: 'warning',
          category: 'incubator',
          title: `فحص الإخصاب الضوئي — ${b.batchCode}`,
          message: `اليوم ${day} من 21: حان وقت فحص ${b.eggCount} بيضة وتسجيل عدد المخصب.`,
          href: `/incubator/${b.id}`,
        });
      }
      if (day >= 18 && day < 21) {
        alerts.push({
          id: `inc-day18-${b.id}`,
          type: 'danger',
          category: 'incubator',
          title: `إيقاف التقليب ورفع الرطوبة — ${b.batchCode}`,
          message: `اليوم ${day} من 21: أوقف التقليب وارفع الرطوبة إلى 65-75% استعداداً للفقس.`,
          href: `/incubator/${b.id}`,
        });
      }
      if (day >= 21) {
        alerts.push({
          id: `inc-hatch-${b.id}`,
          type: 'success',
          category: 'incubator',
          title: `موعد الفقس — ${b.batchCode}`,
          message: `اليوم ${day}: يرجى عد الكتاكيت وتسجيل نتائج الفقس في الدفعة.`,
          href: `/incubator/${b.id}`,
        });
      }
    } else if (b.status === 'hatched') {
      alerts.push({
        id: `inc-transfer-${b.id}`,
        type: 'info',
        category: 'incubator',
        title: `تحويل ${b.batchCode} إلى التربية`,
        message: `${b.hatchedChicks || 0} كتكوت فقس وبانتظار النقل إلى قسم التربية.`,
        href: `/incubator/${b.id}`,
      });
    }
  }

  // 2) تنبيهات دفعات التربية (الانتقال في الأسبوع 20، التلقيح، ارتفاع النفوق)
  const maxMort = settings.targetRates?.maxMortality ?? 5;
  for (const r of rearingBatches) {
    if (r.status !== 'rearing') continue;
    const week = getDynamicAgeWeeks(r.currentAgeWeeks, r.ageReferenceDate || r.createdAt, r.startDate);
    const healthy = r.currentHealthyCount ?? Math.max(0, r.initialChickCount - (r.mortalityCount || 0));
    const females = Math.max(0, healthy - (r.malesCount || 0));

    if (week >= 20) {
      const autoOn = r.autoTransferToProduction !== false;
      alerts.push({
        id: `rear-ready-${r.id}-w${week}`,
        type: autoOn ? 'warning' : 'success',
        category: 'rearing',
        title: `دفعة ${r.batchCode} جاهزة للنقل للإنتاج (الأسبوع ${week})`,
        message: autoOn
          ? `تضم ${females} أنثى سليمة — يمكنك نقلها يدوياً الآن، وإذا لم تُنقل خلال أسبوع سيتم نقلها تلقائياً عند إتمام الأسبوع 21.`
          : `بلغت الأسبوع ${week} (${females} أنثى سليمة) — يرجى نقلها يدوياً للإنتاج (النقل التلقائي معطّل).`,
        href: `/rearing`,
      });
    } else if (week >= 17) {
      alerts.push({
        id: `rear-soon-${r.id}`,
        type: 'warning',
        category: 'rearing',
        title: `اقتراب دخول ${r.batchCode} للإنتاج`,
        message: `العمر الحالي ${week} أسبوعاً (باقي ${21 - week} أسابيع للنقل التلقائي). جهّز عنبر البياض للـ ${females} أنثى.`,
        href: `/rearing/${r.id}`,
      });
    }

    // تذكير اللقاح المطابق للأسبوع الحالي أو الأسبوع المقبل
    const batchLogs = logs.filter(l => l.rearingBatchId === r.id);
    const loggedWeeks = new Set(batchLogs.map(l => l.weekNumber));
    const dueVax = DEFAULT_VACCINATION_SCHEDULE.find(
      v => (v.weekNumber === week || v.weekNumber === week + 1) && !loggedWeeks.has(v.weekNumber)
    );
    if (dueVax) {
      alerts.push({
        id: `rear-vax-${r.id}-w${dueVax.weekNumber}`,
        type: 'info',
        category: 'vaccination',
        title: `تذكير لقاح (أسبوع ${dueVax.weekNumber}) — ${r.batchCode}`,
        message: `${dueVax.vaccineName} عبر ${dueVax.method}.`,
        href: `/rearing/${r.id}`,
      });
    }

    // تنبيه نسبة النفوق
    const deaths =
      r.mortalityCount !== undefined && r.mortalityCount !== null
        ? r.mortalityCount
        : Math.max(0, r.initialChickCount - healthy);
    const mortPct = r.initialChickCount > 0 ? (deaths / r.initialChickCount) * 100 : 0;
    if (mortPct > maxMort) {
      alerts.push({
        id: `rear-mort-${r.id}`,
        type: 'danger',
        category: 'rearing',
        title: `نسبة نفوق مرتفعة — ${r.batchCode}`,
        message: `بلغ النفوق ${mortPct.toFixed(1)}% (${deaths} من ${r.initialChickCount}) متجاوزاً الحد (${maxMort}%).`,
        href: `/rearing/${r.id}`,
      });
    }
  }

  // 3) تذكير تسجيل الإنتاج اليومي إذا لم يُسجَّل لليوم
  const hasTodayProd = productions.some(p => p.date === todayStr);
  if (!hasTodayProd) {
    alerts.push({
      id: `prod-missing-${todayStr}`,
      type: 'info',
      category: 'production',
      title: 'لم يُسجَّل جمع البيض لليوم',
      message: `سجّل إنتاج اليوم (${todayStr}) لتحديث المخزون والمؤشرات في لوحة القيادة.`,
      href: '/production',
    });
  }

  // 4) تنبيه انخفاض مخزون العلف
  const feedInv = computeFeedInventory(feedMovements, flockGroups, settings);
  if (feedInv.currentStockKg <= 20 || (feedInv.daysRemaining !== null && feedInv.daysRemaining <= 5)) {
    alerts.push({
      id: `feed-low-${Math.floor(feedInv.currentStockKg)}`,
      type: feedInv.currentStockKg <= 10 || (feedInv.daysRemaining !== null && feedInv.daysRemaining <= 2) ? 'danger' : 'warning',
      category: 'feed',
      title: 'تنبيه مخزون العلف منخفض',
      message:
        feedInv.daysRemaining !== null
          ? `المتبقي ${feedInv.currentStockKg} كغ فقط (يكفي لـ ${feedInv.daysRemaining} أيام حسب استهلاك القطيع ${feedInv.dailyFlockConsumptionKg} كغ/يوم).`
          : `المتبقي في المخزون ${feedInv.currentStockKg} كغ فقط — يرجى التزود بالعلف قريباً.`,
      href: '/expenses',
    });
  }

  return alerts;
}

