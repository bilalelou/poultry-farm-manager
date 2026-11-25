'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db } from '@/lib/db';
import { transferRearingBatchToProduction } from '@/lib/transfer-helpers';
import type { RearingBatch, RearingStatus } from '@/lib/types';
import { REARING_STATUS_LABELS } from '@/lib/types';
import { formatDate, getRearingWeek, getFeedPhase, getFeedPhaseName, generateBatchCode, todayISO, cn } from '@/lib/utils';
import { TrendingUp, Bird, Plus, Edit2, Trash2, Truck } from 'lucide-react';

const statusColors = { rearing: 'amber' as const, completed: 'green' as const, transferred: 'blue' as const };

export default function RearingListPage() {
  const [batches, setBatches] = useState<RearingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    batchCode: generateBatchCode('T'),
    startDate: todayISO(),
    initialChickCount: 36,
    initialCostPerChick: 40,
    currentHealthyCount: 22,
    mortalityCount: 14,
    malesCount: 2,
    currentAgeWeeks: 5,
    status: 'rearing' as RearingStatus,
    notes: '',
  });

  // Transfer Modal state
  const [transferBatch, setTransferBatch] = useState<RearingBatch | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const b = await db.rearingBatches.toArray();
      b.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setBatches(b);
    } catch (err) {
      console.error('Error loading rearing batches:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingBatchId(null);
    setForm({
      batchCode: generateBatchCode('T'),
      startDate: todayISO(),
      initialChickCount: 30,
      initialCostPerChick: 35,
      currentHealthyCount: 30,
      mortalityCount: 0,
      malesCount: 0,
      currentAgeWeeks: 1,
      status: 'rearing',
      notes: '',
    });
    setShowForm(true);
  }

  function openEditModal(batch: RearingBatch, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingBatchId(batch.id || null);
    const initial = batch.initialChickCount || 0;
    const mortality = batch.mortalityCount ?? 0;
    const healthy = batch.currentHealthyCount ?? (initial - mortality);
    const age = batch.currentAgeWeeks || getRearingWeek(batch.startDate);
    setForm({
      batchCode: batch.batchCode,
      startDate: batch.startDate,
      initialChickCount: initial,
      initialCostPerChick: batch.initialCostPerChick,
      currentHealthyCount: healthy,
      mortalityCount: mortality,
      malesCount: batch.malesCount ?? 0,
      currentAgeWeeks: age,
      status: batch.status,
      notes: batch.notes || '',
    });
    setShowForm(true);
  }

  // تحديث الحساب التلقائي للعدد السليم عند تغيير العدد الابتدائي أو النفوق
  function handleInitialCountChange(val: number) {
    setForm(prev => {
      const newInitial = Math.max(0, val);
      const newMortality = prev.mortalityCount;
      const newHealthy = Math.max(0, newInitial - newMortality);
      return { ...prev, initialChickCount: newInitial, currentHealthyCount: newHealthy };
    });
  }

  function handleMortalityChange(val: number) {
    setForm(prev => {
      const newMortality = Math.max(0, val);
      const newHealthy = Math.max(0, prev.initialChickCount - newMortality);
      return { ...prev, mortalityCount: newMortality, currentHealthyCount: newHealthy };
    });
  }

  function handleHealthyChange(val: number) {
    setForm(prev => {
      const newHealthy = Math.max(0, val);
      const newMortality = Math.max(0, prev.initialChickCount - newHealthy);
      return { ...prev, currentHealthyCount: newHealthy, mortalityCount: newMortality };
    });
  }

  async function saveBatch() {
    const dataToSave = {
      batchCode: form.batchCode,
      startDate: form.startDate,
      initialChickCount: Number(form.initialChickCount),
      initialCostPerChick: Number(form.initialCostPerChick),
      currentHealthyCount: Number(form.currentHealthyCount),
      mortalityCount: Number(form.mortalityCount),
      malesCount: Number(form.malesCount),
      currentAgeWeeks: Number(form.currentAgeWeeks),
      status: form.status,
      notes: form.notes,
    };

    if (editingBatchId) {
      await db.rearingBatches.update(editingBatchId, dataToSave);
    } else {
      await db.rearingBatches.add({
        ...dataToSave,
        createdAt: todayISO(),
      });
    }
    setShowForm(false);
    loadData();
  }

  async function confirmTransfer() {
    if (!transferBatch || !transferBatch.id) return;
    await transferRearingBatchToProduction(transferBatch);
    setTransferBatch(null);
    loadData();
  }

  function promptDelete(batchId: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTargetId(batchId);
  }

  async function confirmDelete() {
    if (deleteTargetId) {
      // حذف الدفعة وسجلاتها الأسبوعية المرتبطة بها
      await db.rearingBatches.delete(deleteTargetId);
      await db.rearingWeeklyLogs.where('rearingBatchId').equals(deleteTargetId).delete();
      setDeleteTargetId(null);
      loadData();
    }
  }

  const filtered = filter === 'all' ? batches : batches.filter(b => b.status === filter);

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">تتبع النمو والتربية (عتوكة / كتاكيت)</h1>
          <p className="text-sm text-slate-500">{batches.length} دفعة مسجلة</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          دفعة تربية جديدة
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'rearing', 'completed', 'transferred'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {f === 'all' ? 'الكل' : REARING_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bird className="w-16 h-16" />}
          title="لا توجد دفعات تربية"
          description="يمكنك إنشاء دفعة جديدة أو تحويلها تلقائياً من الفقاسة"
          action={{ label: 'إنشاء دفعة تربية', onClick: openCreateModal }}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(batch => {
            const week = batch.currentAgeWeeks || getRearingWeek(batch.startDate);
            const phase = getFeedPhase(week);
            return (
              <div key={batch.id} className="relative group">
                <Link href={`/rearing/${batch.id}`}>
                  <Card className="p-5 hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-slate-800">{batch.batchCode}</span>
                        <Badge color={statusColors[batch.status]}>{REARING_STATUS_LABELS[batch.status]}</Badge>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-slate-500">الأسبوع {Math.min(week, 20)} / 20</span>
                          <Badge color={phase === 'starter' ? 'amber' : phase === 'grower' ? 'blue' : 'purple'}>{getFeedPhaseName(phase)}</Badge>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(Math.min(week, 20) / 20) * 100}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm text-slate-600">
                        <div className="flex justify-between"><span>📅 تاريخ البدء</span><span className="font-medium">{formatDate(batch.startDate)}</span></div>
                        <div className="flex justify-between">
                          <span>⏳ العمر الحالي</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {week} أسبوع
                          </span>
                        </div>
                        <div className="flex justify-between"><span>🐥 العدد الابتدائي</span><span className="font-medium">{batch.initialChickCount} طير</span></div>
                        <div className="flex justify-between text-red-600">
                          <span>💀 عدد النفوق</span>
                          <span className="font-bold">{batch.mortalityCount ?? 0} طير</span>
                        </div>
                        <div className="flex justify-between bg-emerald-50 text-emerald-800 p-2 rounded-lg font-bold border border-emerald-200">
                          <span>✨ إجمالي السليم (المتبقي)</span>
                          <span className="text-base">{batch.currentHealthyCount ?? (batch.initialChickCount - (batch.mortalityCount ?? 0))} طير</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <div className="flex justify-between text-blue-700">
                            <span>🐓 ذكور / ديوك:</span>
                            <span className="font-bold">{batch.malesCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between text-pink-700">
                            <span>🐔 إناث (بياض):</span>
                            <span className="font-bold">
                              {Math.max(0, (batch.currentHealthyCount ?? (batch.initialChickCount - (batch.mortalityCount ?? 0))) - (batch.malesCount ?? 0))}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between"><span>💰 تكلفة الطير الأولية</span><span className="font-medium">{batch.initialCostPerChick} د.م</span></div>
                        {batch.notes && <p className="text-xs text-slate-400 mt-2 line-clamp-1">{batch.notes}</p>}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {batch.status === 'transferred' ? (
                        <span className="text-xs text-slate-400 font-medium">✓ تم الانضمام للإنتاج</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTransferBatch(batch);
                          }}
                          className={cn(
                            "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold transition",
                            (batch.currentAgeWeeks || week) >= 20 || batch.status === 'completed'
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm animate-pulse"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          )}
                          title="نقل الدجاج السليم إلى قطيع الإنتاج"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          نقل الإناث (+{Math.max(0, (batch.currentHealthyCount ?? (batch.initialChickCount - (batch.mortalityCount ?? 0))) - (batch.malesCount ?? 0))})
                        </button>
                      )}
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

      {/* Add / Edit Batch Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingBatchId ? "تعديل دفعة التربية" : "إنشاء دفعة تربية جديدة"} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رمز الدفعة</label>
              <input type="text" value={form.batchCode} onChange={e => setForm(p => ({ ...p, batchCode: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ البدء</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العدد الابتدائي (المشترى / الموضوع)</label>
              <input type="number" value={form.initialChickCount} onChange={e => handleInitialCountChange(+e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العمر بالأسابيع (أسبوع)</label>
              <input type="number" min="1" max="50" value={form.currentAgeWeeks} onChange={e => setForm(p => ({ ...p, currentAgeWeeks: +e.target.value }))} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-blue-50/40 font-bold text-blue-700" placeholder="مثال: 5 أسابيع" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة الطير الأولية (د.م)</label>
            <input type="number" step="0.5" value={form.initialCostPerChick} onChange={e => setForm(p => ({ ...p, initialCostPerChick: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-sm font-medium text-red-600 mb-1">💀 عدد النفوق (الميت)</label>
              <input type="number" min="0" value={form.mortalityCount} onChange={e => handleMortalityChange(+e.target.value)} className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-white font-bold text-red-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-1">✨ إجمالي السليم المتبقي</label>
              <input type="number" min="0" value={form.currentHealthyCount} onChange={e => handleHealthyChange(+e.target.value)} className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-emerald-50 font-bold text-emerald-700" />
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-200 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">🐓 عدد الذكور / الديوك</label>
                <input type="number" min="0" max={form.currentHealthyCount} value={form.malesCount} onChange={e => setForm(p => ({ ...p, malesCount: +e.target.value }))} className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm bg-blue-50/50 font-bold text-blue-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1">🐔 إناث متبقية للبيض (محسوبة)</label>
                <div className="w-full px-3 py-1.5 border border-pink-200 rounded-lg text-sm bg-pink-50 font-black text-pink-700 flex items-center justify-between">
                  <span>إناث:</span>
                  <span>{Math.max(0, form.currentHealthyCount - form.malesCount)}</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">حالة الدفعة</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as RearingStatus }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="rearing">قيد التربية</option>
              <option value="completed">مكتمل (أتمت الشهر 5)</option>
              <option value="transferred">تم النقل للقطيع البياض</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2} />
          </div>
          <div className="flex gap-3 pt-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
              إلغاء
            </button>
            <button onClick={saveBatch} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
              {editingBatchId ? "حفظ التعديلات" : "إنشاء الدفعة"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="حذف دفعة التربية"
        message="هل أنت متأكد من حذف هذه الدفعة وسجلاتها الأسبوعية المرتبطة بها؟"
        confirmLabel="حذف نهائي"
        confirmColor="red"
      />

      {/* Transfer to Production Confirmation */}
      <ConfirmDialog
        isOpen={transferBatch !== null}
        onClose={() => setTransferBatch(null)}
        onConfirm={confirmTransfer}
        title="نقل الدجاج السليم إلى قطيع الإنتاج"
        message={
          transferBatch
            ? `سيتم نقل ${Math.max(0, (transferBatch.currentHealthyCount ?? (transferBatch.initialChickCount - (transferBatch.mortalityCount ?? 0))) - (transferBatch.malesCount ?? 0))} أنثى بياضة من الدفعة (${transferBatch.batchCode}) إلى قطيع الإنتاج والقطيع العام وتحديث قيمة المشروع (مع عزل ${transferBatch.malesCount ?? 0} ذكور). هل تريد المتابعة؟`
            : ''
        }
        confirmLabel="تأكيد النقل للإنتاج 🚚"
        confirmColor="blue"
      />
    </AppShell>
  );
}
