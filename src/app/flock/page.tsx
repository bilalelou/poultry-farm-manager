'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db } from '@/lib/db';
import type { FlockGroup, FlockCategory } from '@/lib/types';
import { FLOCK_CATEGORY_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Users, Plus, Edit2, Trash2, HeartPulse, Home, Bird, ShieldCheck } from 'lucide-react';

const categoryColors: Record<FlockCategory, 'green' | 'blue' | 'amber' | 'purple' | 'red'> = {
  layers: 'green',
  roosters: 'blue',
  pullets: 'amber',
  chicks: 'purple',
  broilers: 'red',
};

export default function FlockPage() {
  const [groups, setGroups] = useState<FlockGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Form State
  const [form, setForm] = useState<Omit<FlockGroup, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    category: 'layers',
    breed: 'دجاج بلدي أصيل',
    headCount: 10,
    malesCount: 0,
    femalesCount: 10,
    ageWeeks: 24,
    housing: 'عنبر 1',
    healthStatus: 'ممتازة',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await db.flockGroups.toArray();
      setGroups(data);
    } catch (err) {
      console.error('Error loading flock groups:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setForm({
      name: '',
      category: 'layers',
      breed: 'دجاج بلدي أصيل',
      headCount: 10,
      malesCount: 0,
      femalesCount: 10,
      ageWeeks: 20,
      housing: 'عنبر 1',
      healthStatus: 'ممتازة',
      notes: '',
    });
    setShowModal(true);
  }

  function openEditModal(group: FlockGroup) {
    setEditingId(group.id || null);
    setForm({
      name: group.name,
      category: group.category,
      breed: group.breed,
      headCount: group.headCount,
      malesCount: group.malesCount,
      femalesCount: group.femalesCount,
      ageWeeks: group.ageWeeks,
      housing: group.housing || '',
      healthStatus: group.healthStatus,
      notes: group.notes || '',
    });
    setShowModal(true);
  }

  function handleHeadCountChange(total: number) {
    setForm(prev => {
      const t = Math.max(0, total);
      const m = Math.min(prev.malesCount, t);
      const f = t - m;
      return { ...prev, headCount: t, malesCount: m, femalesCount: f };
    });
  }

  function handleMalesChange(males: number) {
    setForm(prev => {
      const m = Math.max(0, Math.min(males, prev.headCount));
      const f = Math.max(0, prev.headCount - m);
      return { ...prev, malesCount: m, femalesCount: f };
    });
  }

  async function saveFlockGroup() {
    if (!form.name.trim()) return;

    if (editingId) {
      await db.flockGroups.update(editingId, form);
    } else {
      await db.flockGroups.add(form);
    }
    setShowModal(false);
    loadData();
  }

  async function confirmDelete() {
    if (deleteTargetId) {
      await db.flockGroups.delete(deleteTargetId);
      setDeleteTargetId(null);
      loadData();
    }
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  // إحصائيات القطيع الإجمالي
  const totalBirds = groups.reduce((s, g) => s + g.headCount, 0);
  const totalFemales = groups.reduce((s, g) => s + g.femalesCount, 0);
  const totalMales = groups.reduce((s, g) => s + g.malesCount, 0);
  const totalLayers = groups.filter(g => g.category === 'layers').reduce((s, g) => s + g.femalesCount, 0);

  const filtered = filter === 'all' ? groups : groups.filter(g => g.category === filter);

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span>القطيع العام للمزرعة</span>
            <span className="text-2xl">🐓</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">تعداد وحصر الطيور، العنابر، الديوك، والإناث البياضة بدقة</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition"
        >
          <Plus className="w-5 h-5" />
          إضافة مجموعة / عنبر
        </button>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700">إجمالي قطيع المزرعة</span>
            <span className="p-2 bg-blue-100 rounded-lg text-blue-600"><Users className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-blue-900">{totalBirds} <span className="text-sm font-normal text-slate-500">طير</span></p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-pink-50 to-white border-pink-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-pink-700">الدجاج البياض النشط</span>
            <span className="p-2 bg-pink-100 rounded-lg text-pink-600"><Bird className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-pink-900">{totalLayers} <span className="text-sm font-normal text-slate-500">دجاجة</span></p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-700">إجمالي الديوك / الذكور</span>
            <span className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><ShieldCheck className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-indigo-900">{totalMales} <span className="text-sm font-normal text-slate-500">ديك</span></p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">إجمالي الإناث (كل الأعمار)</span>
            <span className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><HeartPulse className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-emerald-900">{totalFemales} <span className="text-sm font-normal text-slate-500">أنثى</span></p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={cn('px-4 py-2 rounded-xl text-sm font-bold transition', filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
        >
          الكل ({groups.length})
        </button>
        {(['layers', 'pullets', 'roosters', 'chicks', 'broilers'] as const).map(cat => {
          const count = groups.filter(g => g.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn('px-4 py-2 rounded-xl text-sm font-bold transition', filter === cat ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
            >
              {FLOCK_CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Groups Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(group => (
          <Card key={group.id} className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{group.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{group.breed}</p>
                </div>
                <Badge color={categoryColors[group.category]}>
                  {FLOCK_CATEGORY_LABELS[group.category]}
                </Badge>
              </div>

              {/* Counts Badge Banner */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-center">
                <div>
                  <span className="text-[11px] text-slate-500 block">الإجمالي</span>
                  <span className="text-lg font-black text-slate-800">{group.headCount}</span>
                </div>
                <div>
                  <span className="text-[11px] text-blue-600 block">ديوك / ذكور</span>
                  <span className="text-lg font-black text-blue-700">{group.malesCount}</span>
                </div>
                <div>
                  <span className="text-[11px] text-pink-600 block">إناث</span>
                  <span className="text-lg font-black text-pink-700">{group.femalesCount}</span>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2 text-sm text-slate-600 mb-4">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><Home className="w-4 h-4 text-slate-400" /> مكان التواجد:</span>
                  <span className="font-medium text-slate-800">{group.housing || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>⏳ العمر الحالي:</span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{group.ageWeeks} أسبوع</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><HeartPulse className="w-4 h-4 text-emerald-500" /> الحالة الصحية:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{group.healthStatus}</span>
                </div>
                {group.notes && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                    {group.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">رقم التعريف #{group.id}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(group)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="تعديل"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteTargetId(group.id!)}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? "تعديل مجموعة بالقطيع" : "إضافة مجموعة جديدة للقطيع"} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم المجموعة / الحظيرة</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="مثلاً: القطيع البياض الرئيسي أو عنبر العتوكة"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value as FlockCategory }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="layers">دجاج بياض منتج</option>
                <option value="pullets">عتوكة (ما قبل البيض)</option>
                <option value="roosters">ديوك التخصيب / التلقيح</option>
                <option value="chicks">كتاكيت وحضانة</option>
                <option value="broilers">تسمين / لحم</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">السلالة</label>
              <input
                type="text"
                value={form.breed}
                onChange={e => setForm(p => ({ ...p, breed: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">إجمالي العدد (رؤوس)</label>
              <input
                type="number"
                min="1"
                value={form.headCount}
                onChange={e => handleHeadCountChange(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">🐓 عدد الذكور / الديوك</label>
                <input
                  type="number"
                  min="0"
                  max={form.headCount}
                  value={form.malesCount}
                  onChange={e => handleMalesChange(+e.target.value)}
                  className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm font-bold text-blue-800 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1">🐔 عدد الإناث (محسوب)</label>
                <div className="w-full px-3 py-1.5 border border-pink-200 rounded-lg text-sm font-black text-pink-700 bg-pink-50 flex items-center justify-between">
                  <span>إناث:</span>
                  <span>{form.femalesCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العمر (أسبوع)</label>
              <input
                type="number"
                min="1"
                value={form.ageWeeks}
                onChange={e => setForm(p => ({ ...p, ageWeeks: +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العنبر / الحظيرة</label>
              <input
                type="text"
                value={form.housing}
                onChange={e => setForm(p => ({ ...p, housing: e.target.value }))}
                placeholder="عنبر 1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الحالة الصحية</label>
              <select
                value={form.healthStatus}
                onChange={e => setForm(p => ({ ...p, healthStatus: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="ممتازة">ممتازة</option>
                <option value="جيدة">جيدة</option>
                <option value="تحت الملاحظة">تحت الملاحظة</option>
                <option value="تحت العلاج">تحت العلاج</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={saveFlockGroup}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
            >
              {editingId ? "حفظ التعديلات" : "إضافة للمزرعة"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="حذف المجموعة من القطيع"
        message="هل أنت متأكد من حذف هذه المجموعة من تعداد القطيع العام؟"
        confirmLabel="حذف نهائي"
        confirmColor="red"
      />
    </AppShell>
  );
}
