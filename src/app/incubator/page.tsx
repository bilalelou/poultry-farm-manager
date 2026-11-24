'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, EmptyState, LoadingSpinner } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { IncubatorBatch, BatchStatus, Settings } from '@/lib/types';
import { BATCH_STATUS_LABELS, INCUBATOR_STANDARDS } from '@/lib/types';
import { formatCurrency, formatDate, formatPercent, getIncubatorDay, generateBatchCode, todayISO, cn } from '@/lib/utils';
import { Egg, Plus, Thermometer, Droplets, RotateCcw, Eye, Calendar } from 'lucide-react';

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    batchCode: generateBatchCode('F'),
    startDate: todayISO(),
    eggCount: 176,
    eggSource: 'external' as 'internal' | 'external',
    eggCost: 0,
    electricityCost: 50,
    cleaningCost: 20,
    notes: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const s = await getSettings();
    setSettings(s);
    const b = await db.incubatorBatches.orderBy('startDate').reverse().toArray();
    setBatches(b);
    setForm(prev => ({ ...prev, electricityCost: s.incubatorElectricityCost, cleaningCost: s.incubatorCleaningCost, eggCount: s.incubatorCapacity }));
    setLoading(false);
  }

  async function saveBatch() {
    await db.incubatorBatches.add({
      ...form,
      status: 'incubating',
      electricityCost: form.electricityCost,
      cleaningCost: form.cleaningCost,
      createdAt: todayISO(),
    });
    setShowForm(false);
    setForm(prev => ({ ...prev, batchCode: generateBatchCode('F'), startDate: todayISO(), eggCost: 0, notes: '' }));
    loadData();
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
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
        <EmptyState icon={<Egg className="w-16 h-16" />} title="لا توجد دفعات" description="أنشئ أول دفعة فقاسة لبدء التتبع" action={{ label: 'إنشاء دفعة', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(batch => {
            const day = batch.status === 'incubating' ? getIncubatorDay(batch.startDate) : null;
            return (
              <Link key={batch.id} href={`/incubator/${batch.id}`}>
                <Card className="p-5 hover:shadow-md transition-shadow h-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-slate-800">{batch.batchCode}</span>
                    <Badge color={statusColors[batch.status]}>{BATCH_STATUS_LABELS[batch.status]}</Badge>
                  </div>

                  {day !== null && day <= 21 && (
                    <div className="bg-amber-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-amber-800">اليوم {day} من 21</span>
                        <span className="text-xs text-amber-600">{21 - day} يوم متبقي</span>
                      </div>
                      <div className="w-full bg-amber-200 rounded-full h-2">
                        <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${(day / 21) * 100}%` }} />
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
                      <span className="font-medium">{batch.eggCount}</span>
                    </div>
                    {batch.fertilityRate !== undefined && (
                      <div className="flex justify-between text-slate-600">
                        <span>🔬 نسبة الإخصاب</span>
                        <span className="font-medium text-blue-600">{formatPercent(batch.fertilityRate)}</span>
                      </div>
                    )}
                    {batch.hatchRate !== undefined && (
                      <div className="flex justify-between text-slate-600">
                        <span>🐣 نسبة الفقس</span>
                        <span className="font-medium text-emerald-600">{formatPercent(batch.hatchRate)}</span>
                      </div>
                    )}
                    {batch.hatchedChicks !== undefined && (
                      <div className="flex justify-between text-slate-600">
                        <span>🐥 الكتاكيت</span>
                        <span className="font-bold text-emerald-700">{batch.hatchedChicks}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Batch Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="إنشاء دفعة فقاسة جديدة" size="md">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">عدد البيض</label>
              <input type="number" value={form.eggCount} onChange={e => setForm(p => ({ ...p, eggCount: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">مصدر البيض</label>
              <select value={form.eggSource} onChange={e => setForm(p => ({ ...p, eggSource: e.target.value as 'internal' | 'external' }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="external">شراء خارجي</option>
                <option value="internal">إنتاج داخلي</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة البيض الإجمالية ({sym})</label>
            <input type="number" step="0.1" value={form.eggCost} onChange={e => setForm(p => ({ ...p, eggCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة الكهرباء</label>
              <input type="number" value={form.electricityCost} onChange={e => setForm(p => ({ ...p, electricityCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة التنظيف</label>
              <input type="number" value={form.cleaningCost} onChange={e => setForm(p => ({ ...p, cleaningCost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2} />
          </div>
          <button onClick={saveBatch} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
            إنشاء الدفعة
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
