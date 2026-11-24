'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { RearingBatch, RearingWeeklyLog, Settings } from '@/lib/types';
import { DEFAULT_VACCINATION_SCHEDULE } from '@/lib/types';
import { formatCurrency, formatPercent, formatDate, getFeedPhase, getFeedPhaseName, getRearingWeek, cn } from '@/lib/utils';
import { ArrowRight, Plus, Syringe, Truck, DollarSign } from 'lucide-react';

export default function RearingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [batch, setBatch] = useState<RearingBatch | null>(null);
  const [logs, setLogs] = useState<RearingWeeklyLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const [logForm, setLogForm] = useState({
    weeklyMortality: 0, feedConsumed: 0, feedCost: 0,
    heatingCost: 0, lightingCost: 10, beddingCost: 0,
    vaccinationCost: 0, medicineCost: 0, otherCosts: 0,
    malesSold: 0, malesSaleValue: 0,
  });

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const s = await getSettings();
    setSettings(s);
    const b = await db.rearingBatches.get(Number(id));
    if (b) {
      setBatch(b);
      const l = await db.rearingWeeklyLogs.where('rearingBatchId').equals(b.id!).sortBy('weekNumber');
      setLogs(l);
    }
    setLoading(false);
  }

  const nextWeek = logs.length > 0 ? logs[logs.length - 1].weekNumber + 1 : 1;
  const lastRemaining = logs.length > 0 ? logs[logs.length - 1].remainingCount : (batch?.initialChickCount || 0);
  const feedPhase = getFeedPhase(nextWeek);

  async function saveWeeklyLog() {
    if (!batch?.id) return;
    const remaining = lastRemaining - logForm.weeklyMortality - logForm.malesSold;
    const totalMortality = (batch.initialChickCount - remaining + logForm.malesSold);
    const totalMalesSold = logs.reduce((s, l) => s + l.malesSold, 0) + logForm.malesSold;
    const cumMortRate = ((batch.initialChickCount - remaining - totalMalesSold) / batch.initialChickCount) * 100;
    const totalWeeklyCost = logForm.feedCost + logForm.heatingCost + logForm.lightingCost + logForm.beddingCost + logForm.vaccinationCost + logForm.medicineCost + logForm.otherCosts;

    await db.rearingWeeklyLogs.add({
      rearingBatchId: batch.id,
      weekNumber: nextWeek,
      feedPhase,
      remainingCount: remaining,
      weeklyMortality: logForm.weeklyMortality,
      cumulativeMortalityRate: Math.round(cumMortRate * 10) / 10,
      feedConsumed: logForm.feedConsumed,
      feedCost: logForm.feedCost,
      heatingCost: logForm.heatingCost,
      lightingCost: logForm.lightingCost,
      beddingCost: logForm.beddingCost,
      vaccinationCost: logForm.vaccinationCost,
      medicineCost: logForm.medicineCost,
      otherCosts: logForm.otherCosts,
      totalWeeklyCost,
      malesSold: logForm.malesSold,
      malesSaleValue: logForm.malesSaleValue,
    });

    if (nextWeek >= 20) {
      await db.rearingBatches.update(batch.id, { status: 'completed' });
    }

    setShowLogForm(false);
    setLogForm({ weeklyMortality: 0, feedConsumed: 0, feedCost: 0, heatingCost: 0, lightingCost: 10, beddingCost: 0, vaccinationCost: 0, medicineCost: 0, otherCosts: 0, malesSold: 0, malesSaleValue: 0 });
    loadData();
  }

  async function transferToProduction() {
    if (!batch?.id) return;
    await db.rearingBatches.update(batch.id, { status: 'transferred' });
    setShowTransfer(false);
    router.push('/production');
  }

  if (loading || !batch) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const totalRearingCost = (batch.initialChickCount * batch.initialCostPerChick) + logs.reduce((s, l) => s + l.totalWeeklyCost, 0);
  const totalMalesSaleValue = logs.reduce((s, l) => s + l.malesSaleValue, 0);
  const totalMalesSold = logs.reduce((s, l) => s + l.malesSold, 0);
  const finalRemaining = logs.length > 0 ? logs[logs.length - 1].remainingCount : batch.initialChickCount;
  const netCostPerHen = finalRemaining > 0 ? (totalRearingCost - totalMalesSaleValue) / finalRemaining : 0;
  const marketPrice = settings?.marketReadyHenPrice || 80;
  const savings = marketPrice - netCostPerHen;

  return (
    <AppShell>
      <button onClick={() => router.push('/rearing')} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium">
        <ArrowRight className="w-4 h-4" />
        العودة للقائمة
      </button>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">الدفعة {batch.batchCode}</h1>
        <Badge color={batch.status === 'rearing' ? 'amber' : batch.status === 'completed' ? 'green' : 'blue'}>
          {batch.status === 'rearing' ? 'قيد التربية' : batch.status === 'completed' ? 'مكتمل' : 'تم النقل'}
        </Badge>
        <Badge color={feedPhase === 'starter' ? 'amber' : feedPhase === 'grower' ? 'blue' : 'purple'}>
          {getFeedPhaseName(feedPhase)}
        </Badge>
      </div>

      {/* Batch Info */}
      <Card className="p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div><p className="text-xs text-slate-500">العدد الابتدائي</p><p className="text-xl font-bold">{batch.initialChickCount}</p></div>
          <div><p className="text-xs text-slate-500">المتبقي حالياً</p><p className="text-xl font-bold text-blue-600">{finalRemaining}</p></div>
          <div><p className="text-xs text-slate-500">الأسبوع الحالي</p><p className="text-xl font-bold">{Math.min(getRearingWeek(batch.startDate), 20)} / 20</p></div>
          <div><p className="text-xs text-slate-500">الذكور المباعة</p><p className="text-xl font-bold text-emerald-600">{totalMalesSold}</p></div>
        </div>
      </Card>

      {/* Add Weekly Log */}
      {batch.status === 'rearing' && nextWeek <= 20 && (
        <div className="mb-6">
          <button onClick={() => setShowLogForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
            <Plus className="w-5 h-5" />
            تسجيل الأسبوع {nextWeek}
          </button>
        </div>
      )}

      {/* Weekly Logs Table */}
      <Card className="mb-6 overflow-x-auto">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">📋 السجل الأسبوعي</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>الأسبوع</th>
              <th>المرحلة</th>
              <th>المتبقي</th>
              <th>النفوق</th>
              <th>النفوق %</th>
              <th>العلف (كغ)</th>
              <th>ت. العلف</th>
              <th>تكاليف أخرى</th>
              <th>الإجمالي</th>
              <th>ذكور</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td className="font-bold">{log.weekNumber}</td>
                <td><Badge color={log.feedPhase === 'starter' ? 'amber' : log.feedPhase === 'grower' ? 'blue' : 'purple'}>{getFeedPhaseName(log.feedPhase)}</Badge></td>
                <td>{log.remainingCount}</td>
                <td className={log.weeklyMortality > 0 ? 'text-red-600 font-medium' : ''}>{log.weeklyMortality}</td>
                <td>{formatPercent(log.cumulativeMortalityRate)}</td>
                <td>{log.feedConsumed.toFixed(1)}</td>
                <td>{formatCurrency(log.feedCost, sym)}</td>
                <td>{formatCurrency(log.heatingCost + log.beddingCost + log.vaccinationCost + log.medicineCost + log.otherCosts, sym)}</td>
                <td className="font-bold">{formatCurrency(log.totalWeeklyCost, sym)}</td>
                <td>{log.malesSold > 0 ? <span className="text-emerald-600">{log.malesSold} ({formatCurrency(log.malesSaleValue, sym)})</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Vaccination Schedule */}
      <Card className="mb-6">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Syringe className="w-5 h-5 text-blue-600" />جدول التحصينات</h3>
        </div>
        <table className="data-table">
          <thead><tr><th>الأسبوع</th><th>اللقاح</th><th>النوع</th><th>طريقة الإعطاء</th></tr></thead>
          <tbody>
            {DEFAULT_VACCINATION_SCHEDULE.map(v => (
              <tr key={v.weekNumber} className={cn(v.weekNumber === nextWeek ? 'bg-blue-50 font-bold' : '', v.weekNumber < nextWeek ? 'text-slate-400' : '')}>
                <td className="font-bold">{v.weekNumber}</td>
                <td>{v.vaccineName}</td>
                <td>{v.vaccineType}</td>
                <td>{v.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Month 5 Summary */}
      {(batch.status === 'completed' || batch.status === 'transferred') && (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" />ملخص الشهر الخامس</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">إجمالي تكاليف التربية</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(totalRearingCost, sym)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-xs text-emerald-600">عائد بيع الذكور</p>
              <p className="text-lg font-bold text-emerald-700">- {formatCurrency(totalMalesSaleValue, sym)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600">تكلفة الدجاجة الجاهزة</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(netCostPerHen, sym)}</p>
            </div>
          </div>

          {/* Comparison Card */}
          <div className="bg-gradient-to-l from-emerald-50 to-blue-50 rounded-xl p-5">
            <h4 className="font-bold text-slate-800 mb-3">📊 مقارنة التكلفة مع السوق</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500">تكلفة إنتاجك</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(netCostPerHen, sym)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">سعر السوق</p>
                <p className="text-xl font-bold text-slate-700">{formatCurrency(marketPrice, sym)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">التوفير / الدجاجة</p>
                <p className={cn('text-xl font-bold', savings > 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {savings > 0 ? '✓' : '✗'} {formatCurrency(Math.abs(savings), sym)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Transfer Button */}
      {batch.status === 'completed' && (
        <Card className="p-5 bg-gradient-to-l from-emerald-50 to-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800">نقل الإناث الجاهزة إلى القطيع البياض</h3>
              <p className="text-sm text-slate-500">{finalRemaining} دجاجة جاهزة للإنتاج</p>
            </div>
            <button onClick={() => setShowTransfer(true)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition">
              <Truck className="w-5 h-5" />
              نقل إلى القطيع البياض
            </button>
          </div>
        </Card>
      )}

      {/* Add Weekly Log Modal */}
      <Modal isOpen={showLogForm} onClose={() => setShowLogForm(false)} title={`تسجيل الأسبوع ${nextWeek} — ${getFeedPhaseName(feedPhase)}`} size="lg">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-3 bg-blue-50 rounded-lg p-3 text-center text-sm text-blue-700 font-medium">
            العدد الحالي: {lastRemaining} | المرحلة: {getFeedPhaseName(feedPhase)}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">النفوق الأسبوعي</label>
            <input type="number" value={logForm.weeklyMortality} onChange={e => setLogForm(p => ({ ...p, weeklyMortality: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">العلف المستهلك (كغ)</label>
            <input type="number" step="0.1" value={logForm.feedConsumed} onChange={e => setLogForm(p => ({ ...p, feedConsumed: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة العلف ({sym})</label>
            <input type="number" step="0.1" value={logForm.feedCost} onChange={e => setLogForm(p => ({ ...p, feedCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التدفئة</label>
            <input type="number" value={logForm.heatingCost} onChange={e => setLogForm(p => ({ ...p, heatingCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الإضاءة</label>
            <input type="number" value={logForm.lightingCost} onChange={e => setLogForm(p => ({ ...p, lightingCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الفرشة</label>
            <input type="number" value={logForm.beddingCost} onChange={e => setLogForm(p => ({ ...p, beddingCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التحصينات</label>
            <input type="number" value={logForm.vaccinationCost} onChange={e => setLogForm(p => ({ ...p, vaccinationCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الأدوية</label>
            <input type="number" value={logForm.medicineCost} onChange={e => setLogForm(p => ({ ...p, medicineCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">مصاريف أخرى</label>
            <input type="number" value={logForm.otherCosts} onChange={e => setLogForm(p => ({ ...p, otherCosts: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ذكور مباعة</label>
            <input type="number" value={logForm.malesSold} onChange={e => setLogForm(p => ({ ...p, malesSold: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">قيمة البيع ({sym})</label>
            <input type="number" value={logForm.malesSaleValue} onChange={e => setLogForm(p => ({ ...p, malesSaleValue: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="flex items-end">
            <div className="bg-red-50 rounded-lg p-2 w-full text-center text-sm text-red-700 font-bold">
              الإجمالي: {formatCurrency(logForm.feedCost + logForm.heatingCost + logForm.lightingCost + logForm.beddingCost + logForm.vaccinationCost + logForm.medicineCost + logForm.otherCosts, sym)}
            </div>
          </div>
        </div>
        <button onClick={saveWeeklyLog} className="mt-5 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
          حفظ سجل الأسبوع {nextWeek}
        </button>
      </Modal>

      <ConfirmDialog isOpen={showTransfer} onClose={() => setShowTransfer(false)} onConfirm={transferToProduction} title="تأكيد النقل" message={`سيتم نقل ${finalRemaining} دجاجة إلى القطيع البياض. هل تريد المتابعة؟`} confirmLabel="نقل" />
    </AppShell>
  );
}
