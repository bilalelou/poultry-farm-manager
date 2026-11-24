'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { IncubatorBatch, BatchStatus, Settings } from '@/lib/types';
import { BATCH_STATUS_LABELS } from '@/lib/types';
import { formatCurrency, formatDate, formatPercent, getIncubatorDay, generateBatchCode, todayISO, cn } from '@/lib/utils';
import { Egg, Plus, Edit2, Trash2 } from 'lucide-react';

const statusColors: Record<BatchStatus, 'amber' | 'green' | 'blue'> = {
  incubating: 'amber',
  hatched: 'green',
  transferred: 'blue',
};

export default function IncubatorPage() {
  const [batches, setBatches] = useState<IncubatorBatch[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BatchStatus | 'all'>('all');
  
  // Create / Edit modal state
  const [showForm, setShowForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [form, setForm] = useState({
    batchCode: generateBatchCode('F'),
    startDate: todayISO(),
    eggCount: 71,
    eggSource: 'external' as 'internal' | 'external',
    eggCost: 0,
    electricityCost: 60,
    cleaningCost: 20,
    status: 'incubating' as BatchStatus,
    fertilizedCount: undefined as number | undefined,
    hatchedChicks: undefined as number | undefined,
    notes: '',
  });

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const s = await getSettings();
    setSettings(s);
    const b = await db.incubatorBatches.orderBy('startDate').reverse().toArray();
    setBatches(b);
    setLoading(false);
  }

  function openCreateModal() {
    setEditingBatchId(null);
    setForm({
      batchCode: generateBatchCode('F'),
      startDate: todayISO(),
      eggCount: settings?.incubatorCapacity || 71,
      eggSource: 'external',
      eggCost: 0,
      electricityCost: settings?.incubatorElectricityCost || 60,
      cleaningCost: settings?.incubatorCleaningCost || 20,
      status: 'incubating',
      fertilizedCount: undefined,
      hatchedChicks: undefined,
      notes: '',
    });
    setShowForm(true);
  }

  function openEditModal(batch: IncubatorBatch, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingBatchId(batch.id || null);
    setForm({
      batchCode: batch.batchCode,
      startDate: batch.startDate,
      eggCount: batch.eggCount,
      eggSource: batch.eggSource,
      eggCost: batch.eggCost,
      electricityCost: batch.electricityCost,
      cleaningCost: batch.cleaningCost,
      status: batch.status,
      fertilizedCount: batch.fertilizedCount,
      hatchedChicks: batch.hatchedChicks,
      notes: batch.notes || '',
    });
    setShowForm(true);
  }

  async function saveBatch() {
    if (editingBatchId) {
      // تعديل دفعة موجودة
      const existing = await db.incubatorBatches.get(editingBatchId);
      if (existing) {
        const fertilized = form.fertilizedCount !== undefined ? Number(form.fertilizedCount) : existing.fertilizedCount;
        const fertilityRate = fertilized !== undefined && form.eggCount > 0 ? (fertilized / form.eggCount) * 100 : existing.fertilityRate;
        const hatched = form.hatchedChicks !== undefined ? Number(form.hatchedChicks) : existing.hatchedChicks;
        const hatchRate = hatched !== undefined && fertilized ? (hatched / fertilized) * 100 : existing.hatchRate;
        const totalCost = Number(form.eggCost) + Number(form.electricityCost) + Number(form.cleaningCost);
        const costPerChick = hatched && hatched > 0 ? totalCost / hatched : existing.costPerChick;

        await db.incubatorBatches.update(editingBatchId, {
          batchCode: form.batchCode,
          startDate: form.startDate,
          eggCount: Number(form.eggCount),
          eggSource: form.eggSource,
          eggCost: Number(form.eggCost),
          electricityCost: Number(form.electricityCost),
          cleaningCost: Number(form.cleaningCost),
          status: form.status,
          fertilizedCount: fertilized,
          fertilityRate: fertilityRate !== undefined ? Math.round(fertilityRate * 10) / 10 : undefined,
          hatchedChicks: hatched,
          hatchRate: hatchRate !== undefined ? Math.round(hatchRate * 10) / 10 : undefined,
          totalCost,
          costPerChick: costPerChick !== undefined ? Math.round(costPerChick * 100) / 100 : undefined,
          notes: form.notes,
        });
      }
    } else {
      // إنشاء دفعة جديدة
      await db.incubatorBatches.add({
        batchCode: form.batchCode,
        startDate: form.startDate,
        eggCount: Number(form.eggCount),
        eggSource: form.eggSource,
        eggCost: Number(form.eggCost),
        electricityCost: Number(form.electricityCost),
        cleaningCost: Number(form.cleaningCost),
        status: form.status,
        fertilizedCount: form.fertilizedCount !== undefined ? Number(form.fertilizedCount) : undefined,
        hatchedChicks: form.hatchedChicks !== undefined ? Number(form.hatchedChicks) : undefined,
        notes: form.notes,
        createdAt: todayISO(),
      });
    }

    setShowForm(false);
    loadData();
  }

  function promptDelete(batchId: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTargetId(batchId);
  }

  async function confirmDelete() {
    if (deleteTargetId) {
      await db.incubatorBatches.delete(deleteTargetId);
      setDeleteTargetId(null);
      loadData();
    }
  }

  const filtered = filter === 'all' ? batches : batches.filter(b => b.status === filter);
  const sym = settings?.currencySymbol || 'د.م';

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">تسيير الفقاسة</h1>
          <p className="text-sm text-slate-500">{batches.length} دفعة مسجلة</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" />
          دفعة جديدة
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'incubating', 'hatched', 'transferred'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {f === 'all' ? 'الكل' : BATCH_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Batches Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Egg className="w-16 h-16" />} title="لا توجد دفعات" description="أنشئ أول دفعة فقاسة لبدء التتبع" action={{ label: 'إنشاء دفعة', onClick: openCreateModal }} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(batch => {
            const day = batch.status === 'incubating' ? getIncubatorDay(batch.startDate) : null;
            return (
              <div key={batch.id} className="relative group">
                <Link href={`/incubator/${batch.id}`}>
                  <Card className="p-5 hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-slate-800">{batch.batchCode}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge color={statusColors[batch.status]}>{BATCH_STATUS_LABELS[batch.status]}</Badge>
                        </div>
                      </div>

                      {day !== null && day <= 21 && (
                        <div className="bg-amber-50 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-amber-800">اليوم {day} من 21</span>
                            <span className="text-xs text-amber-600">{Math.max(0, 21 - day)} يوم متبقي</span>
                          </div>
                          <div className="w-full bg-amber-200 rounded-full h-2">
                            <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (day / 21) * 100)}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-600">
                          <span>📅 تاريخ الوضع</span>
                          <span className="font-medium">{formatDate(batch.startDate)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>🥚 عدد البيض</span>
                          <span className="font-medium">{batch.eggCount} بيضة</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>💰 تكلفة البيض</span>
                          <span className="font-medium">{formatCurrency(batch.eggCost || 0, sym)}</span>
                        </div>
                        {batch.fertilizedCount !== undefined && batch.fertilizedCount !== null && (
                          <div className="flex justify-between text-slate-600">
                            <span>🔬 نسبة الإخصاب</span>
                            <span className="font-medium text-blue-600">{batch.fertilizedCount} ({formatPercent(batch.fertilityRate ?? 0)})</span>
                          </div>
                        )}
                        {batch.hatchRate !== undefined && batch.hatchRate !== null && (
                          <div className="flex justify-between text-slate-600">
                            <span>🐣 نسبة الفقس</span>
                            <span className="font-medium text-emerald-600">{formatPercent(batch.hatchRate)}</span>
                          </div>
                        )}
                        {batch.hatchedChicks !== undefined && batch.hatchedChicks !== null && (
                          <div className="flex justify-between text-slate-600">
                            <span>🐥 الكتاكيت</span>
                            <span className="font-bold text-emerald-700">{batch.hatchedChicks}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick action buttons on card footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-blue-600 font-medium">عرض التفاصيل ←</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => openEditModal(batch, e)}
                          title="تعديل الدفعة"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => promptDelete(batch.id!, e)}
                          title="حذف الدفعة"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Batch Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingBatchId ? "تعديل معطيات الدفعة" : "إنشاء دفعة فقاسة جديدة"} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رمز الدفعة</label>
              <input type="text" value={form.batchCode} onChange={e => setForm(p => ({ ...p, batchCode: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الوضع</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">عدد البيض الإجمالي</label>
              <input type="number" value={form.eggCount} onChange={e => setForm(p => ({ ...p, eggCount: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">مصدر البيض</label>
              <select value={form.eggSource} onChange={e => setForm(p => ({ ...p, eggSource: e.target.value as 'internal' | 'external' }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="external">شراء خارجي</option>
                <option value="internal">إنتاج داخلي (المزرعة)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة البيض الإجمالية ({sym})</label>
            <input type="number" step="0.1" value={form.eggCost} onChange={e => setForm(p => ({ ...p, eggCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة الكهرباء ({sym})</label>
              <input type="number" value={form.electricityCost} onChange={e => setForm(p => ({ ...p, electricityCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة التنظيف ({sym})</label>
              <input type="number" value={form.cleaningCost} onChange={e => setForm(p => ({ ...p, cleaningCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">حالة الدفعة</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as BatchStatus }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="incubating">في الفقاسة</option>
                <option value="hatched">تم الفقس</option>
                <option value="transferred">تم النقل للتربية</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">البيض المخصب (اختياري)</label>
              <input
                type="number"
                placeholder="عدد البيض المخصب"
                value={form.fertilizedCount ?? ''}
                onChange={e => setForm(p => ({ ...p, fertilizedCount: e.target.value === '' ? undefined : +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
              إلغاء
            </button>
            <button onClick={saveBatch} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
              {editingBatchId ? 'حفظ التعديلات' : 'إنشاء الدفعة'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="حذف دفعة الفقاسة"
        message="هل أنت متأكد من رغبتك في حذف هذه الدفعة نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف نهائي"
        confirmColor="red"
      />
    </AppShell>
  );
}
