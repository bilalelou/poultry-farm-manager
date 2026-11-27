'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db } from '@/lib/db';
import type { FlockGroup, FlockCategory, FlockMovement, FlockMovementType } from '@/lib/types';
import { FLOCK_CATEGORY_LABELS, FLOCK_MOVEMENT_LABELS } from '@/lib/types';
import { cn, formatDate, todayISO, getDynamicAgeWeeks, getDaysUntilWeek } from '@/lib/utils';
import { Users, Plus, Edit2, Trash2, HeartPulse, Home, Bird, ShieldCheck, ArrowLeftRight, History } from 'lucide-react';

const categoryColors: Record<FlockCategory, 'green' | 'blue' | 'amber' | 'purple' | 'red'> = {
  layers: 'green',
  roosters: 'blue',
  pullets: 'amber',
  chicks: 'purple',
  broilers: 'red',
};

export default function FlockPage() {
  const [tab, setTab] = useState<'groups' | 'history'>('groups');
  const [groups, setGroups] = useState<FlockGroup[]>([]);
  const [movements, setMovements] = useState<FlockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [originalAgeWeeks, setOriginalAgeWeeks] = useState<number | null>(null);
  const [originalAgeRefDate, setOriginalAgeRefDate] = useState<string | undefined>(undefined);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Movement Modal State
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [deleteMovementId, setDeleteMovementId] = useState<number | null>(null);
  const [movementForm, setMovementForm] = useState({
    date: todayISO(),
    flockGroupId: '' as string | number,
    targetGroupId: '' as string | number,
    movementType: 'transfer' as FlockMovementType,
    fromLocation: '',
    toLocation: '',
    malesCount: 0,
    femalesCount: 0,
    reason: '',
    notes: '',
  });

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
      const [data, movs] = await Promise.all([
        db.flockGroups.toArray(),
        db.flockMovements.toArray(),
      ]);
      setGroups(data);
      setMovements(movs);
    } catch (err) {
      console.error('Error loading flock groups:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setOriginalAgeWeeks(null);
    setOriginalAgeRefDate(undefined);
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
    const liveAge = getDynamicAgeWeeks(group.ageWeeks, group.ageReferenceDate || group.createdAt);
    setOriginalAgeWeeks(liveAge);
    setOriginalAgeRefDate(group.ageReferenceDate);
    setForm({
      name: group.name,
      category: group.category,
      breed: group.breed,
      headCount: group.headCount,
      malesCount: group.malesCount,
      femalesCount: group.femalesCount,
      ageWeeks: liveAge,
      housing: group.housing || '',
      healthStatus: group.healthStatus,
      notes: group.notes || '',
    });
    setShowModal(true);
  }

  function handleMalesChange(val: number) {
    const m = Math.max(0, isNaN(val) ? 0 : val);
    setForm(prev => ({
      ...prev,
      malesCount: m,
      headCount: m + prev.femalesCount,
    }));
  }

  function handleFemalesChange(val: number) {
    const f = Math.max(0, isNaN(val) ? 0 : val);
    setForm(prev => ({
      ...prev,
      femalesCount: f,
      headCount: prev.malesCount + f,
    }));
  }

  function handleHeadCountChange(total: number) {
    const t = Math.max(0, isNaN(total) ? 0 : total);
    setForm(prev => {
      if (prev.category === 'roosters') {
        return { ...prev, headCount: t, malesCount: t, femalesCount: 0 };
      }
      if (prev.category === 'layers') {
        return { ...prev, headCount: t, femalesCount: Math.max(0, t - prev.malesCount) };
      }
      const m = Math.min(prev.malesCount, t);
      const f = Math.max(0, t - m);
      return { ...prev, headCount: t, malesCount: m, femalesCount: f };
    });
  }

  async function saveFlockGroup() {
    if (!form.name.trim()) return;

    const newAge = Number(form.ageWeeks);
    const ageRefDate =
      !editingId || originalAgeWeeks !== newAge || !originalAgeRefDate
        ? todayISO()
        : originalAgeRefDate;

    const dataToSave = {
      ...form,
      ageWeeks: newAge,
      ageReferenceDate: ageRefDate,
      headCount: form.malesCount + form.femalesCount,
    };

    if (editingId) {
      await db.flockGroups.update(editingId, dataToSave);
    } else {
      const createdId = await db.flockGroups.add(dataToSave);
      await db.flockMovements.add({
        date: todayISO(),
        flockGroupId: typeof createdId === 'number' ? createdId : undefined,
        flockName: form.name,
        movementType: 'addition',
        toLocation: form.housing || form.name,
        malesCount: form.malesCount,
        femalesCount: form.femalesCount,
        totalCount: form.malesCount + form.femalesCount,
        reason: 'إضافة مجموعة جديدة للقطيع',
      });
    }
    setShowModal(false);
    loadData();
  }

  function openMovementModal(group?: FlockGroup, defaultType: FlockMovementType = 'transfer') {
    const src = group || groups[0];
    setMovementForm({
      date: todayISO(),
      flockGroupId: src?.id || '',
      targetGroupId: '',
      movementType: defaultType,
      fromLocation: src?.housing || src?.name || '',
      toLocation: '',
      malesCount: 0,
      femalesCount: src ? Math.min(src.femalesCount, src.headCount) : 0,
      reason: '',
      notes: '',
    });
    setShowMovementModal(true);
  }

  async function saveMovement() {
    const srcGroup = groups.find(g => g.id === Number(movementForm.flockGroupId));
    if (!srcGroup) return;

    const mCount = Math.max(0, Number(movementForm.malesCount) || 0);
    const fCount = Math.max(0, Number(movementForm.femalesCount) || 0);
    const total = mCount + fCount;
    if (total <= 0) return;

    const targetGroup =
      movementForm.movementType === 'transfer' && movementForm.targetGroupId
        ? groups.find(g => g.id === Number(movementForm.targetGroupId))
        : undefined;

    if (movementForm.movementType === 'addition') {
      const nextMales = srcGroup.malesCount + mCount;
      const nextFemales = srcGroup.femalesCount + fCount;
      await db.flockGroups.update(srcGroup.id!, {
        malesCount: nextMales,
        femalesCount: nextFemales,
        headCount: nextMales + nextFemales,
      });
    } else if (movementForm.movementType === 'transfer') {
      if (targetGroup && targetGroup.id !== srcGroup.id) {
        const srcMales = Math.max(0, srcGroup.malesCount - mCount);
        const srcFemales = Math.max(0, srcGroup.femalesCount - fCount);
        await db.flockGroups.update(srcGroup.id!, {
          malesCount: srcMales,
          femalesCount: srcFemales,
          headCount: srcMales + srcFemales,
        });
        const dstMales = targetGroup.malesCount + mCount;
        const dstFemales = targetGroup.femalesCount + fCount;
        await db.flockGroups.update(targetGroup.id!, {
          malesCount: dstMales,
          femalesCount: dstFemales,
          headCount: dstMales + dstFemales,
        });
      } else if (movementForm.toLocation.trim() && total >= srcGroup.headCount) {
        // نقل المجموعة كلها إلى عنبر جديد
        await db.flockGroups.update(srcGroup.id!, {
          housing: movementForm.toLocation.trim(),
        });
      } else if (movementForm.toLocation.trim()) {
        // نقل جزئي لعنبر جديد: ننقص من المصدر
        const srcMales = Math.max(0, srcGroup.malesCount - mCount);
        const srcFemales = Math.max(0, srcGroup.femalesCount - fCount);
        await db.flockGroups.update(srcGroup.id!, {
          malesCount: srcMales,
          femalesCount: srcFemales,
          headCount: srcMales + srcFemales,
        });
      }
    } else {
      // mortality | sale | culling
      const srcMales = Math.max(0, srcGroup.malesCount - mCount);
      const srcFemales = Math.max(0, srcGroup.femalesCount - fCount);
      await db.flockGroups.update(srcGroup.id!, {
        malesCount: srcMales,
        femalesCount: srcFemales,
        headCount: srcMales + srcFemales,
      });
    }

    await db.flockMovements.add({
      date: movementForm.date,
      flockGroupId: srcGroup.id,
      flockName: srcGroup.name,
      movementType: movementForm.movementType,
      fromLocation: movementForm.fromLocation || srcGroup.housing || srcGroup.name,
      toLocation: targetGroup
        ? `${targetGroup.name}${targetGroup.housing ? ` (${targetGroup.housing})` : ''}`
        : movementForm.toLocation || undefined,
      malesCount: mCount,
      femalesCount: fCount,
      totalCount: total,
      reason: movementForm.reason || undefined,
      notes: movementForm.notes || undefined,
    });

    setShowMovementModal(false);
    loadData();
  }

  async function confirmDeleteMovement() {
    if (deleteMovementId) {
      await db.flockMovements.delete(deleteMovementId);
      setDeleteMovementId(null);
      loadData();
    }
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
          <p className="text-sm text-slate-500 mt-1">تعداد وحصر الطيور، العنابر، الديوك، وتاريخ تحركات القطيع بدقة</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openMovementModal(undefined, 'transfer')}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-sm transition"
          >
            <ArrowLeftRight className="w-4 h-4" />
            تسجيل حركة / نقل
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition"
          >
            <Plus className="w-5 h-5" />
            إضافة مجموعة / عنبر
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('groups')}
          className={cn('px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2', tab === 'groups' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <Users className="w-4 h-4" />
          مجموعات القطيع ({groups.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn('px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2', tab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <History className="w-4 h-4" />
          تاريخ تحركات القطيع ({movements.length})
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

      {tab === 'groups' && (
        <>
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
                  {(() => {
                    const liveAge = getDynamicAgeWeeks(group.ageWeeks, group.ageReferenceDate || group.createdAt);
                    const daysTo21 = group.category === 'pullets' && liveAge < 21
                      ? getDaysUntilWeek(21, group.ageWeeks, group.ageReferenceDate || group.createdAt)
                      : 0;
                    return (
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {liveAge} أسبوع
                        {daysTo21 > 0 && (
                          <span className="text-[10px] font-medium text-blue-600 mr-1">
                            (باقي {daysTo21} يوم للأسبوع 21)
                          </span>
                        )}
                      </span>
                    );
                  })()}
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
                  onClick={() => openMovementModal(group, 'transfer')}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                  title="نقل أو تسجيل حركة"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  نقل
                </button>
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
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMovementTypeFilter('all')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition', movementTypeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600')}
              >
                الكل ({movements.length})
              </button>
              {(Object.keys(FLOCK_MOVEMENT_LABELS) as FlockMovementType[]).map(mt => {
                const cnt = movements.filter(m => m.movementType === mt).length;
                return (
                  <button
                    key={mt}
                    onClick={() => setMovementTypeFilter(mt)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition', movementTypeFilter === mt ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600')}
                  >
                    {FLOCK_MOVEMENT_LABELS[mt]} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع الحركة</th>
                  <th>المجموعة</th>
                  <th>من</th>
                  <th>إلى</th>
                  <th>ذكور</th>
                  <th>إناث</th>
                  <th>الإجمالي</th>
                  <th>السبب / ملاحظات</th>
                  <th className="text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {movements.filter(m => movementTypeFilter === 'all' || m.movementType === movementTypeFilter).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400">
                      لا توجد تحركات مسجلة للقطيع بعد. اضغط على &quot;تسجيل حركة / نقل&quot; لتوثيق أول حركة.
                    </td>
                  </tr>
                ) : (
                  movements
                    .filter(m => movementTypeFilter === 'all' || m.movementType === movementTypeFilter)
                    .map(m => (
                      <tr key={m.id}>
                        <td className="font-medium">{formatDate(m.date)}</td>
                        <td>
                          <Badge
                            color={
                              m.movementType === 'transfer'
                                ? 'amber'
                                : m.movementType === 'addition'
                                  ? 'green'
                                  : m.movementType === 'mortality'
                                    ? 'red'
                                    : 'blue'
                            }
                          >
                            {FLOCK_MOVEMENT_LABELS[m.movementType] || m.movementType}
                          </Badge>
                        </td>
                        <td className="font-bold text-slate-800">{m.flockName}</td>
                        <td className="text-xs text-slate-600">{m.fromLocation || '—'}</td>
                        <td className="text-xs text-slate-600">{m.toLocation || '—'}</td>
                        <td className="text-blue-700 font-bold">{m.malesCount}</td>
                        <td className="text-pink-700 font-bold">{m.femalesCount}</td>
                        <td className="font-black text-slate-800">{m.totalCount}</td>
                        <td className="text-xs text-slate-500">{m.reason || m.notes || '—'}</td>
                        <td className="text-center">
                          <button
                            onClick={() => setDeleteMovementId(m.id!)}
                            title="حذف الحركة"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">🐓 عدد الديوك / الفروج</label>
                <input
                  type="number"
                  min="0"
                  value={form.malesCount}
                  onChange={e => handleMalesChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-bold text-blue-800 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-pink-700 mb-1">🐔 عدد الإناث (الدجاج)</label>
                <input
                  type="number"
                  min="0"
                  value={form.femalesCount}
                  onChange={e => handleFemalesChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-pink-300 rounded-lg text-sm font-bold text-pink-800 bg-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-xs font-bold text-slate-700">إجمالي رؤوس المجموعة:</span>
              <span className="text-xl font-black text-slate-900">
                {form.malesCount + form.femalesCount} <span className="text-xs font-normal text-slate-500">طير</span>
              </span>
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

      {/* Movement / Transfer Modal */}
      <Modal
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        title="تسجيل حركة / نقل في القطيع"
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
            <input
              type="date"
              value={movementForm.date}
              onChange={e => setMovementForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحركة</label>
            <select
              value={movementForm.movementType}
              onChange={e => setMovementForm(p => ({ ...p, movementType: e.target.value as FlockMovementType }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {Object.entries(FLOCK_MOVEMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">المجموعة المعنية</label>
            <select
              value={movementForm.flockGroupId}
              onChange={e => {
                const g = groups.find(x => x.id === Number(e.target.value));
                setMovementForm(p => ({
                  ...p,
                  flockGroupId: e.target.value,
                  fromLocation: g?.housing || g?.name || '',
                }));
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.headCount} طير — {g.housing || 'بدون عنبر'})
                </option>
              ))}
            </select>
          </div>

          {movementForm.movementType === 'transfer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نقل إلى مجموعة أخرى (اختياري)</label>
                <select
                  value={movementForm.targetGroupId}
                  onChange={e => setMovementForm(p => ({ ...p, targetGroupId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">-- عنبر جديد / وجهة مخصصة --</option>
                  {groups
                    .filter(g => g.id !== Number(movementForm.flockGroupId))
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.housing || 'بدون عنبر'})
                      </option>
                    ))}
                </select>
              </div>
              {!movementForm.targetGroupId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">العنبر / المكان الجديد</label>
                  <input
                    type="text"
                    value={movementForm.toLocation}
                    onChange={e => setMovementForm(p => ({ ...p, toLocation: e.target.value }))}
                    placeholder="مثال: عنبر 1 - البياضات"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-blue-700 mb-1">عدد الذكور</label>
            <input
              type="number"
              min="0"
              value={movementForm.malesCount}
              onChange={e => setMovementForm(p => ({ ...p, malesCount: +e.target.value }))}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-pink-700 mb-1">عدد الإناث</label>
            <input
              type="number"
              min="0"
              value={movementForm.femalesCount}
              onChange={e => setMovementForm(p => ({ ...p, femalesCount: +e.target.value }))}
              className="w-full px-3 py-2 border border-pink-300 rounded-lg text-sm font-bold"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">السبب / ملاحظات</label>
            <input
              type="text"
              value={movementForm.reason}
              onChange={e => setMovementForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="مثال: بلوغ سن البياض، عزل صحي، بيع..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2 bg-slate-50 rounded-xl p-3 text-center">
            <span className="text-sm font-bold text-slate-800">
              إجمالي الطيور في الحركة: {movementForm.malesCount + movementForm.femalesCount} طير
            </span>
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setShowMovementModal(false)}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            onClick={saveMovement}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition"
          >
            تأكيد وتحديث القطيع ✓
          </button>
        </div>
      </Modal>

      {/* Delete Movement Confirm */}
      <ConfirmDialog
        isOpen={deleteMovementId !== null}
        onClose={() => setDeleteMovementId(null)}
        onConfirm={confirmDeleteMovement}
        title="حذف سجل الحركة"
        message="هل أنت متأكد من حذف هذا السجل من تاريخ تحركات القطيع؟"
        confirmLabel="حذف"
        confirmColor="red"
      />
    </AppShell>
  );
}
