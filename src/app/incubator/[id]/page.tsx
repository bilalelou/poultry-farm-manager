'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { IncubatorBatch, Settings, BatchStatus } from '@/lib/types';
import { BATCH_STATUS_LABELS, INCUBATOR_STANDARDS } from '@/lib/types';
import { formatCurrency, formatDate, formatPercent, getIncubatorDay, getIncubatorPhase, addDays, generateBatchCode, todayISO, cn } from '@/lib/utils';
import { ArrowRight, Thermometer, Droplets, RotateCcw, Eye, AlertTriangle, CheckCircle2, Truck, Edit2, Trash2 } from 'lucide-react';

export default function IncubatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [batch, setBatch] = useState<IncubatorBatch | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCandling, setShowCandling] = useState(false);
  const [showHatch, setShowHatch] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Forms
  const [candlingForm, setCandlingForm] = useState({ fertilizedCount: 0 });
  const [hatchForm, setHatchForm] = useState({ hatchedChicks: 0, spoiledEggs: 0 });
  const [editForm, setEditForm] = useState({
    batchCode: '',
    startDate: '',
    eggCount: 0,
    eggSource: 'external' as 'internal' | 'external',
    eggCost: 0,
    electricityCost: 0,
    cleaningCost: 0,
    status: 'incubating' as BatchStatus,
    fertilizedCount: undefined as number | undefined,
    hatchedChicks: undefined as number | undefined,
    spoiledEggs: undefined as number | undefined,
    notes: '',
  });

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const s = await getSettings();
    setSettings(s);
    const b = await db.incubatorBatches.get(Number(id));
    if (b) {
      setBatch(b);
      setCandlingForm({ fertilizedCount: b.fertilizedCount || 0 });
      setHatchForm({ hatchedChicks: b.hatchedChicks || 0, spoiledEggs: b.spoiledEggs || 0 });
      setEditForm({
        batchCode: b.batchCode,
        startDate: b.startDate,
        eggCount: b.eggCount,
        eggSource: b.eggSource,
        eggCost: b.eggCost,
        electricityCost: b.electricityCost,
        cleaningCost: b.cleaningCost,
        status: b.status,
        fertilizedCount: b.fertilizedCount,
        hatchedChicks: b.hatchedChicks,
        spoiledEggs: b.spoiledEggs,
        notes: b.notes || '',
      });
    }
    setLoading(false);
  }

  async function saveCandling() {
    if (!batch?.id) return;
    const fertilityRate = (candlingForm.fertilizedCount / batch.eggCount) * 100;
    await db.incubatorBatches.update(batch.id, {
      fertilizedCount: candlingForm.fertilizedCount,
      fertilityRate: Math.round(fertilityRate * 10) / 10,
    });
    setShowCandling(false);
    loadData();
  }

  async function saveHatch() {
    if (!batch?.id) return;
    const fertilized = batch.fertilizedCount || batch.eggCount;
    const hatchRate = (hatchForm.hatchedChicks / fertilized) * 100;
    const totalCost = (batch.eggCost || 0) + batch.electricityCost + batch.cleaningCost;
    const costPerChick = hatchForm.hatchedChicks > 0 ? totalCost / hatchForm.hatchedChicks : 0;
    await db.incubatorBatches.update(batch.id, {
      hatchedChicks: hatchForm.hatchedChicks,
      spoiledEggs: hatchForm.spoiledEggs,
      hatchRate: Math.round(hatchRate * 10) / 10,
      totalCost,
      costPerChick: Math.round(costPerChick * 100) / 100,
      status: 'hatched',
    });
    setShowHatch(false);
    loadData();
  }

  async function saveEdit() {
    if (!batch?.id) return;
    const fertilized = editForm.fertilizedCount !== undefined ? Number(editForm.fertilizedCount) : undefined;
    const fertilityRate = fertilized !== undefined && editForm.eggCount > 0 ? (fertilized / editForm.eggCount) * 100 : undefined;
    const hatched = editForm.hatchedChicks !== undefined ? Number(editForm.hatchedChicks) : undefined;
    const hatchRate = hatched !== undefined && fertilized ? (hatched / fertilized) * 100 : undefined;
    const totalCost = Number(editForm.eggCost) + Number(editForm.electricityCost) + Number(editForm.cleaningCost);
    const costPerChick = hatched && hatched > 0 ? totalCost / hatched : undefined;

    await db.incubatorBatches.update(batch.id, {
      batchCode: editForm.batchCode,
      startDate: editForm.startDate,
      eggCount: Number(editForm.eggCount),
      eggSource: editForm.eggSource,
      eggCost: Number(editForm.eggCost),
      electricityCost: Number(editForm.electricityCost),
      cleaningCost: Number(editForm.cleaningCost),
      status: editForm.status,
      fertilizedCount: fertilized,
      fertilityRate: fertilityRate !== undefined ? Math.round(fertilityRate * 10) / 10 : undefined,
      hatchedChicks: hatched,
      spoiledEggs: editForm.spoiledEggs !== undefined ? Number(editForm.spoiledEggs) : undefined,
      hatchRate: hatchRate !== undefined ? Math.round(hatchRate * 10) / 10 : undefined,
      totalCost,
      costPerChick: costPerChick !== undefined ? Math.round(costPerChick * 100) / 100 : undefined,
      notes: editForm.notes,
    });

    setShowEdit(false);
    loadData();
  }

  async function deleteBatch() {
    if (!batch?.id) return;
    await db.incubatorBatches.delete(batch.id);
    router.push('/incubator');
  }

  async function transferToRearing() {
    if (!batch?.id || !batch.hatchedChicks) return;
    const rearingId = await db.rearingBatches.add({
      batchCode: generateBatchCode('T'),
      incubatorBatchId: batch.id,
      startDate: todayISO(),
      initialChickCount: batch.hatchedChicks,
      initialCostPerChick: batch.costPerChick || 0,
      status: 'rearing',
      createdAt: todayISO(),
    });
    await db.incubatorBatches.update(batch.id, {
      status: 'transferred',
      linkedRearingBatchId: rearingId as number,
    });
    setShowTransfer(false);
    router.push('/rearing');
  }

  if (loading || !batch) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const day = getIncubatorDay(batch.startDate);
  const totalCost = (batch.eggCost || 0) + batch.electricityCost + batch.cleaningCost;
  const day7 = addDays(batch.startDate, 6);
  const day18 = addDays(batch.startDate, 17);
  const day21 = addDays(batch.startDate, 20);

  const phaseInfo = day <= 18 ? INCUBATOR_STANDARDS.phase1 : INCUBATOR_STANDARDS.phase2;

  return (
    <AppShell>
      {/* Back button & Actions Bar */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/incubator')} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium">
          <ArrowRight className="w-4 h-4" />
          العودة لقائمة الفقاسة
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
          >
            <Edit2 className="w-4 h-4" />
            تعديل المعطيات
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition"
          >
            <Trash2 className="w-4 h-4" />
            حذف الدفعة
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">الدفعة {batch.batchCode}</h1>
        <Badge color={batch.status === 'incubating' ? 'amber' : batch.status === 'hatched' ? 'green' : 'blue'}>
          {BATCH_STATUS_LABELS[batch.status]}
        </Badge>
      </div>

      {/* Timeline */}
      {batch.status === 'incubating' && day <= 21 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">الشريط الزمني</h2>
            <span className="text-lg font-bold text-blue-600">اليوم {day} / 21</span>
          </div>
          <div className="relative mb-4">
            <div className="w-full bg-slate-100 rounded-full h-4">
              <div
                className={cn('h-4 rounded-full transition-all', day <= 18 ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${Math.min((day / 21) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>اليوم 1</span>
              <span className={cn(day >= 7 ? 'text-blue-600 font-bold' : '')}>فحص (7)</span>
              <span className={cn(day >= 18 ? 'text-amber-600 font-bold' : '')}>إيقاف (18)</span>
              <span className={cn(day >= 21 ? 'text-emerald-600 font-bold' : '')}>فقس (21)</span>
            </div>
          </div>
          <div className="text-center text-lg font-bold text-slate-700">
            ⏳ {Math.max(0, 21 - day)} يوم متبقي للفقس
          </div>
        </Card>
      )}

      {/* Current Phase Info */}
      {batch.status === 'incubating' && day <= 21 && (
        <Card className="p-5 mb-6">
          <h2 className="font-bold text-slate-800 mb-3">
            {day <= 18 ? 'المرحلة الأولى (الأيام 1-18)' : 'مرحلة التفقيس (الأيام 19-21)'}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <Thermometer className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-sm text-slate-600">الحرارة</p>
              <p className="text-lg font-bold text-red-700">
                {`${phaseInfo.temperature.min}°C - ${phaseInfo.temperature.max}°C`}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <Droplets className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="text-sm text-slate-600">الرطوبة</p>
              <p className="text-lg font-bold text-blue-700">{phaseInfo.humidity.min}% - {phaseInfo.humidity.max}%</p>
            </div>
            <div className={cn('rounded-xl p-4 text-center', phaseInfo.turning ? 'bg-green-50' : 'bg-orange-50')}>
              <RotateCcw className={cn('w-6 h-6 mx-auto mb-1', phaseInfo.turning ? 'text-green-500' : 'text-orange-500')} />
              <p className="text-sm text-slate-600">التقليب</p>
              <p className={cn('text-lg font-bold', phaseInfo.turning ? 'text-green-700' : 'text-orange-700')}>
                {phaseInfo.turning ? 'مفعل ✓' : 'متوقف ✗'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Checkpoints */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Day 7 - Candling */}
        <Card className={cn('p-4 border-2', batch.fertilizedCount !== undefined ? 'border-green-200 bg-green-50/50' : day >= 7 ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <Eye className={cn('w-5 h-5', batch.fertilizedCount !== undefined ? 'text-green-600' : 'text-blue-600')} />
            <h3 className="font-bold text-slate-800">الفحص الضوئي (اليوم 7)</h3>
          </div>
          <p className="text-xs text-slate-500 mb-2">📅 {formatDate(day7)}</p>
          {batch.fertilizedCount !== undefined ? (
            <div>
              <p className="text-sm">مخصب: <span className="font-bold text-emerald-700">{batch.fertilizedCount}</span> / {batch.eggCount}</p>
              <p className="text-sm">نسبة الإخصاب: <span className="font-bold text-blue-700">{formatPercent(batch.fertilityRate || 0)}</span></p>
              <button onClick={() => setShowCandling(true)} className="mt-2 text-xs text-blue-600 hover:underline font-medium">
                تعديل نتيجة الفحص
              </button>
            </div>
          ) : (
            <button onClick={() => setShowCandling(true)} className="mt-2 w-full py-2 rounded-lg text-sm font-medium transition bg-blue-600 text-white hover:bg-blue-700">
              تسجيل نتائج الفحص
            </button>
          )}
        </Card>

        {/* Day 18 - Stop Turning */}
        <Card className={cn('p-4 border-2', day >= 18 || batch.status !== 'incubating' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-800">إيقاف التقليب (اليوم 18)</h3>
          </div>
          <p className="text-xs text-slate-500 mb-2">📅 {formatDate(day18)}</p>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>✓ إيقاف التقليب</li>
            <li>✓ رفع الرطوبة إلى 65-75%</li>
            <li>✓ خفض الحرارة إلى 37.2-37.5°C</li>
            <li>✓ نقل البيض لسلال الفقس</li>
          </ul>
        </Card>

        {/* Day 21 - Hatch */}
        <Card className={cn('p-4 border-2', batch.hatchedChicks !== undefined ? 'border-green-200 bg-green-50/50' : day >= 21 ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className={cn('w-5 h-5', batch.hatchedChicks !== undefined ? 'text-green-600' : 'text-slate-400')} />
            <h3 className="font-bold text-slate-800">الفقس (اليوم 21)</h3>
          </div>
          <p className="text-xs text-slate-500 mb-2">📅 {formatDate(day21)}</p>
          {batch.hatchedChicks !== undefined ? (
            <div>
              <p className="text-sm">🐣 كتاكيت سليمة: <span className="font-bold text-emerald-700">{batch.hatchedChicks}</span></p>
              <p className="text-sm">❌ بيض تالف: <span className="font-bold text-red-600">{batch.spoiledEggs || 0}</span></p>
              <p className="text-sm">نسبة الفقس: <span className="font-bold text-blue-700">{formatPercent(batch.hatchRate || 0)}</span></p>
              <button onClick={() => setShowHatch(true)} className="mt-2 text-xs text-emerald-600 hover:underline font-medium">
                تعديل نتيجة الفقس
              </button>
            </div>
          ) : (
            <button onClick={() => setShowHatch(true)} className="mt-2 w-full py-2 rounded-lg text-sm font-medium transition bg-emerald-600 text-white hover:bg-emerald-700">
              تسجيل نتائج الفقس
            </button>
          )}
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="p-5 mb-6">
        <h2 className="font-bold text-slate-800 mb-4">💰 الحساب المالي للدفعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">تكلفة البيض</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(batch.eggCost || 0, sym)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">الكهرباء</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(batch.electricityCost, sym)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">التنظيف</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(batch.cleaningCost, sym)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">إجمالي التكلفة</p>
            <p className="text-lg font-bold text-blue-800">{formatCurrency(totalCost, sym)}</p>
          </div>
        </div>
        {batch.hatchedChicks && batch.hatchedChicks > 0 && (
          <div className="mt-4 bg-emerald-50 rounded-lg p-4 text-center">
            <p className="text-sm text-emerald-700">تكلفة الكتكوت الواحد في اليوم الأول</p>
            <p className="text-2xl font-bold text-emerald-800">{formatCurrency(batch.costPerChick || totalCost / batch.hatchedChicks, sym)}</p>
          </div>
        )}
      </Card>

      {/* Transfer Button */}
      {batch.status === 'hatched' && batch.hatchedChicks && (
        <Card className="p-5 bg-gradient-to-l from-blue-50 to-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800">نقل الدفعة إلى مرحلة التربية</h3>
              <p className="text-sm text-slate-500">{batch.hatchedChicks} كتكوت جاهز للنقل</p>
            </div>
            <button onClick={() => setShowTransfer(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
              <Truck className="w-5 h-5" />
              تحويل إلى التربية
            </button>
          </div>
        </Card>
      )}

      {/* Full Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="تعديل معطيات الدفعة" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رمز الدفعة</label>
              <input type="text" value={editForm.batchCode} onChange={e => setEditForm(p => ({ ...p, batchCode: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الوضع</label>
              <input type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">عدد البيض الإجمالي</label>
              <input type="number" value={editForm.eggCount} onChange={e => setEditForm(p => ({ ...p, eggCount: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">مصدر البيض</label>
              <select value={editForm.eggSource} onChange={e => setEditForm(p => ({ ...p, eggSource: e.target.value as 'internal' | 'external' }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="external">شراء خارجي</option>
                <option value="internal">إنتاج داخلي (المزرعة)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة البيض الإجمالية ({sym})</label>
            <input type="number" step="0.1" value={editForm.eggCost} onChange={e => setEditForm(p => ({ ...p, eggCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة الكهرباء ({sym})</label>
              <input type="number" value={editForm.electricityCost} onChange={e => setEditForm(p => ({ ...p, electricityCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة التنظيف ({sym})</label>
              <input type="number" value={editForm.cleaningCost} onChange={e => setEditForm(p => ({ ...p, cleaningCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الحالة</label>
              <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as BatchStatus }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="incubating">في الفقاسة</option>
                <option value="hatched">تم الفقس</option>
                <option value="transferred">تم النقل للتربية</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المخصب</label>
              <input
                type="number"
                value={editForm.fertilizedCount ?? ''}
                onChange={e => setEditForm(p => ({ ...p, fertilizedCount: e.target.value === '' ? undefined : +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الكتاكيت</label>
              <input
                type="number"
                value={editForm.hatchedChicks ?? ''}
                onChange={e => setEditForm(p => ({ ...p, hatchedChicks: e.target.value === '' ? undefined : +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEdit(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
              إلغاء
            </button>
            <button onClick={saveEdit} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
              حفظ التعديلات
            </button>
          </div>
        </div>
      </Modal>

      {/* Candling Modal */}
      <Modal isOpen={showCandling} onClose={() => setShowCandling(false)} title="تسجيل نتائج الفحص الضوئي" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عدد البيض المخصب</label>
            <input type="number" max={batch.eggCount} value={candlingForm.fertilizedCount} onChange={e => setCandlingForm({ fertilizedCount: +e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <p className="text-xs text-slate-400 mt-1">من أصل {batch.eggCount} بيضة</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <span className="text-sm text-blue-700 font-bold">
              نسبة الإخصاب: {batch.eggCount > 0 ? formatPercent((candlingForm.fertilizedCount / batch.eggCount) * 100) : '0%'}
            </span>
          </div>
          <button onClick={saveCandling} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">حفظ</button>
        </div>
      </Modal>

      {/* Hatch Modal */}
      <Modal isOpen={showHatch} onClose={() => setShowHatch(false)} title="تسجيل نتائج الفقس" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عدد الكتاكيت السليمة</label>
            <input type="number" value={hatchForm.hatchedChicks} onChange={e => setHatchForm(p => ({ ...p, hatchedChicks: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">البيض التالف / الكابس</label>
            <input type="number" value={hatchForm.spoiledEggs} onChange={e => setHatchForm(p => ({ ...p, spoiledEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <span className="text-sm text-emerald-700 font-bold">
              نسبة الفقس: {(batch.fertilizedCount || batch.eggCount) > 0 ? formatPercent((hatchForm.hatchedChicks / (batch.fertilizedCount || batch.eggCount)) * 100) : '0%'}
            </span>
          </div>
          <button onClick={saveHatch} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition">حفظ وتحديث الحالة</button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={deleteBatch}
        title="حذف دفعة الفقاسة"
        message={`هل أنت متأكد من حذف الدفعة "${batch.batchCode}" نهائياً؟ سيتم مسح بياناتها بالكامل.`}
        confirmLabel="تأكيد الحذف"
        confirmColor="red"
      />

      {/* Transfer Confirmation */}
      <ConfirmDialog isOpen={showTransfer} onClose={() => setShowTransfer(false)} onConfirm={transferToRearing} title="تأكيد النقل" message={`سيتم إنشاء دفعة تربية جديدة مرتبطة بـ ${batch.hatchedChicks} كتكوت. هل تريد المتابعة؟`} confirmLabel="تحويل" />
    </AppShell>
  );
}
