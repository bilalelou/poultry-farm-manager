'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { Expense, Settings, ExpenseCategory, FeedMovement, FeedStockType, FeedMovementType, FlockGroup } from '@/lib/types';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SCOPE_LABELS, EXPENSE_TYPE_LABELS, FEED_TYPE_LABELS, FEED_MOVEMENT_LABELS } from '@/lib/types';
import { computeFeedInventory } from '@/lib/feed-inventory';
import { formatCurrency, formatDate, formatNumber, todayISO, getMonthKey, ARABIC_MONTHS, cn } from '@/lib/utils';
import { Plus, Wallet, TrendingUp, Edit2, Trash2, Wheat, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ExpensesPage() {
  const [tab, setTab] = useState<'expenses' | 'cashflow' | 'feedStock'>('expenses');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [feedMovements, setFeedMovements] = useState<FeedMovement[]>([]);
  const [flockGroups, setFlockGroups] = useState<FlockGroup[]>([]);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<number | null>(null);

  // Filters
  const [filterScope, setFilterScope] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Form
  const [form, setForm] = useState({
    date: todayISO(),
    scope: 'general' as 'general' | 'batch' | 'foundation',
    type: 'operational' as 'operational' | 'capital',
    category: 'feed' as ExpenseCategory,
    description: '',
    quantity: 1,
    unitPrice: 0,
    notes: '',
    feedType: 'layer' as FeedStockType,
    feedKg: 50,
  });

  // Feed Movement Modal
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [deleteFeedId, setDeleteFeedId] = useState<number | null>(null);
  const [feedForm, setFeedForm] = useState({
    date: todayISO(),
    movementType: 'consumption' as FeedMovementType,
    feedType: 'layer' as FeedStockType,
    quantityKg: 0,
    cost: 0,
    notes: '',
  });

  // Cash flow
  const [cashFlowData, setCashFlowData] = useState<Array<{ month: string; revenue: number; opExpenses: number; capExpenses: number; netFlow: number; cumBalance: number }>>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, exp, sales, allExpenses, fm, fg] = await Promise.all([
      getSettings(),
      db.expenses.orderBy('date').reverse().toArray(),
      db.sales.toArray(),
      db.expenses.toArray(),
      db.feedMovements.toArray(),
      db.flockGroups.toArray(),
    ]);
    setSettings(s);
    setExpenses(exp);
    setFeedMovements(fm);
    setFlockGroups(fg);

    // Build cash flow
    const monthMap = new Map<string, { revenue: number; opExp: number; capExp: number }>();

    sales.forEach(s => {
      const mk = getMonthKey(s.date);
      const existing = monthMap.get(mk) || { revenue: 0, opExp: 0, capExp: 0 };
      existing.revenue += s.total;
      monthMap.set(mk, existing);
    });
    allExpenses.forEach(e => {
      const mk = getMonthKey(e.date);
      const existing = monthMap.get(mk) || { revenue: 0, opExp: 0, capExp: 0 };
      if (e.type === 'capital' || e.scope === 'foundation') existing.capExp += e.total;
      else existing.opExp += e.total;
      monthMap.set(mk, existing);
    });

    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumBalance = 0;
    const cfData = sortedMonths.map(([m, d]) => {
      const net = d.revenue - d.opExp - d.capExp;
      cumBalance += net;
      const [y, mo] = m.split('-');
      return { month: `${ARABIC_MONTHS[parseInt(mo) - 1]} ${y}`, revenue: d.revenue, opExpenses: d.opExp, capExpenses: d.capExp, netFlow: net, cumBalance };
    });
    setCashFlowData(cfData);
    setLoading(false);
  }

  function openCreateModal() {
    setEditingExpenseId(null);
    setForm({
      date: todayISO(),
      scope: 'general',
      type: 'operational',
      category: 'feed',
      description: '',
      quantity: 1,
      unitPrice: 0,
      notes: '',
      feedType: 'layer',
      feedKg: 50,
    });
    setShowForm(true);
  }

  function openEditModal(exp: Expense) {
    setEditingExpenseId(exp.id || null);
    setForm({
      date: exp.date,
      scope: exp.scope,
      type: exp.type,
      category: exp.category,
      description: exp.description,
      quantity: exp.quantity,
      unitPrice: exp.unitPrice,
      notes: exp.notes || '',
      feedType: 'layer',
      feedKg: 0,
    });
    setShowForm(true);
  }

  async function saveExpense() {
    const total = form.quantity * form.unitPrice;
    const { feedType, feedKg, ...expenseData } = form;
    if (editingExpenseId) {
      await db.expenses.update(editingExpenseId, {
        ...expenseData,
        total,
      });
    } else {
      const createdId = await db.expenses.add({
        ...expenseData,
        total,
      });
      if (form.category === 'feed' && feedKg > 0) {
        await db.feedMovements.add({
          date: form.date,
          movementType: 'purchase',
          feedType,
          quantityKg: Number(feedKg),
          cost: total,
          expenseId: typeof createdId === 'number' ? createdId : undefined,
          notes: form.description || 'شراء علف من المصاريف',
        });
      }
    }
    setShowForm(false);
    setEditingExpenseId(null);
    loadData();
  }

  async function logDailyFeedConsumption() {
    if (!feedInventory || feedInventory.dailyFlockConsumptionKg <= 0) return;
    const today = todayISO();
    for (const fType of ['starter', 'grower', 'preLayer', 'layer'] as FeedStockType[]) {
      const kg = feedInventory.dailyByTypeKg[fType];
      if (kg > 0) {
        await db.feedMovements.add({
          date: today,
          movementType: 'consumption',
          feedType: fType,
          quantityKg: kg,
          cost: 0,
          notes: `استهلاك يومي تلقائي للقطيع (${today})`,
        });
      }
    }
    loadData();
  }

  async function saveFeedMovement() {
    if (feedForm.quantityKg === 0) return;
    await db.feedMovements.add({
      date: feedForm.date,
      movementType: feedForm.movementType,
      feedType: feedForm.feedType,
      quantityKg: Number(feedForm.quantityKg),
      cost: Number(feedForm.cost) || 0,
      notes: feedForm.notes || undefined,
    });
    setShowFeedModal(false);
    loadData();
  }

  async function confirmDeleteFeedMovement() {
    if (deleteFeedId) {
      await db.feedMovements.delete(deleteFeedId);
      setDeleteFeedId(null);
      loadData();
    }
  }

  async function confirmDeleteExpense() {
    if (deleteExpenseId) {
      await db.expenses.delete(deleteExpenseId);
      setDeleteExpenseId(null);
      loadData();
    }
  }

  const feedInventory = useMemo(() => {
    if (!settings) return null;
    return computeFeedInventory(feedMovements, flockGroups, settings);
  }, [feedMovements, flockGroups, settings]);

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const months = [...new Set(expenses.map(e => getMonthKey(e.date)))].sort().reverse();

  let filtered = expenses;
  if (filterScope) filtered = filtered.filter(e => e.scope === filterScope);
  if (filterType) filtered = filtered.filter(e => e.type === filterType);
  if (filterCategory) filtered = filtered.filter(e => e.category === filterCategory);
  if (filterMonth) filtered = filtered.filter(e => getMonthKey(e.date) === filterMonth);

  const totalOp = expenses.filter(e => e.type === 'operational' && e.scope !== 'foundation').reduce((s, e) => s + e.total, 0);
  const totalCap = expenses.filter(e => e.type === 'capital' || e.scope === 'foundation').reduce((s, e) => s + e.total, 0);
  const topCategory = Object.entries(
    expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.total; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0];

  return (
    <AppShell>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button onClick={() => setTab('expenses')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'expenses' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}>
          <span className="flex items-center gap-2"><Wallet className="w-4 h-4" />المصاريف</span>
        </button>
        <button onClick={() => setTab('feedStock')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'feedStock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}>
          <span className="flex items-center gap-2">
            <Wheat className="w-4 h-4" />
            مخزون العلف
            {feedInventory && (
              <span className={cn(
                'px-2 py-0.5 text-[11px] font-bold rounded-full',
                feedInventory.daysRemaining !== null && feedInventory.daysRemaining <= 5
                  ? 'bg-red-100 text-red-700'
                  : 'bg-emerald-100 text-emerald-700'
              )}>
                {formatNumber(feedInventory.currentStockKg)} كغ
              </span>
            )}
          </span>
        </button>
        <button onClick={() => setTab('cashflow')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'cashflow' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}>
          <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />التدفق النقدي</span>
        </button>
      </div>

      {tab === 'expenses' && (
        <>
          {/* Add button */}
          <div className="mb-6">
            <button onClick={openCreateModal} className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition">
              <Plus className="w-5 h-5" />
              إضافة مصروف جديد
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">المصاريف التشغيلية</p><p className="text-lg font-bold text-amber-600">{formatCurrency(totalOp, sym)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">المصاريف التأسيسية</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalCap, sym)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">الإجمالي العام</p><p className="text-lg font-bold text-slate-800">{formatCurrency(totalOp + totalCap, sym)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">أعلى فئة مصاريف</p><p className="text-lg font-bold text-purple-600">{topCategory ? EXPENSE_CATEGORY_LABELS[topCategory[0] as ExpenseCategory] : '—'}</p></Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterScope} onChange={e => setFilterScope(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">كل النطاقات</option>
              {Object.entries(EXPENSE_SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">كل الأنواع</option>
              {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">كل الفئات</option>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">كل الأشهر</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Expenses Table with Edit & Delete Actions */}
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النطاق</th>
                  <th>النوع</th>
                  <th>الفئة</th>
                  <th>الوصف</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>المجموع</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-slate-400">لا توجد مصاريف مسجلة</td>
                  </tr>
                ) : (
                  filtered.map(e => (
                    <tr key={e.id}>
                      <td className="font-medium">{formatDate(e.date)}</td>
                      <td><Badge color={e.scope === 'foundation' ? 'red' : e.scope === 'batch' ? 'purple' : 'slate'}>{EXPENSE_SCOPE_LABELS[e.scope]}</Badge></td>
                      <td><Badge color={e.type === 'capital' ? 'red' : 'amber'}>{EXPENSE_TYPE_LABELS[e.type]}</Badge></td>
                      <td>{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                      <td>{e.description}</td>
                      <td>{e.quantity}</td>
                      <td>{formatCurrency(e.unitPrice, sym)}</td>
                      <td className="font-bold text-red-600">{formatCurrency(e.total, sym)}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(e)}
                            title="تعديل المصروف"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteExpenseId(e.id!)}
                            title="حذف المصروف"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          {/* Add / Edit Expense Modal */}
          <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingExpenseId ? "تعديل المصروف" : "إضافة مصروف جديد"} size="md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">النطاق</label>
                <select value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value as typeof form.scope }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {Object.entries(EXPENSE_SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">النوع</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as typeof form.type }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الفئة</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
                <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">سعر الوحدة ({sym})</label>
                <input type="number" step="0.1" value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              {!editingExpenseId && form.category === 'feed' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">نوع العلف للمخزون</label>
                    <select value={form.feedType} onChange={e => setForm(p => ({ ...p, feedType: e.target.value as FeedStockType }))} className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-emerald-50/40">
                      {Object.entries(FEED_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">الكمية المضافة للمخزون (كغ)</label>
                    <input type="number" min="0" step="0.5" value={form.feedKg} onChange={e => setForm(p => ({ ...p, feedKg: +e.target.value }))} className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-emerald-50/40 font-bold text-emerald-800" />
                  </div>
                </>
              )}
              <div className="col-span-2 bg-red-50 rounded-lg p-3 text-center">
                <span className="text-lg font-bold text-red-700">المجموع: {formatCurrency(form.quantity * form.unitPrice, sym)}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
                إلغاء
              </button>
              <button onClick={saveExpense} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition">
                {editingExpenseId ? 'حفظ التعديلات' : 'حفظ المصروف'}
              </button>
            </div>
          </Modal>

          {/* Delete Expense Confirm Dialog */}
          <ConfirmDialog
            isOpen={deleteExpenseId !== null}
            onClose={() => setDeleteExpenseId(null)}
            onConfirm={confirmDeleteExpense}
            title="حذف المصروف"
            message="هل أنت متأكد من رغبتك في حذف هذا المصروف؟ سيتم إعادة احتساب إجمالي المصاريف والتدفق النقدي وصافي الأرباح."
            confirmLabel="حذف"
            confirmColor="red"
          />
        </>
      )}

      {tab === 'feedStock' && feedInventory && (
        <>
          {/* Low stock alert banner */}
          {(feedInventory.currentStockKg <= 20 || (feedInventory.daysRemaining !== null && feedInventory.daysRemaining <= 5)) && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <div className="text-sm font-medium">
                <strong>تنبيه مخزون العلف:</strong> الكمية المتبقية ({formatNumber(feedInventory.currentStockKg)} كغ)
                {feedInventory.daysRemaining !== null ? ` تكفي لـ ${feedInventory.daysRemaining} أيام فقط` : ''} — ينصح بالتزود بالعلف قريباً.
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <p className="text-xs font-bold text-emerald-700 mb-1">المخزون الحالي للعلف</p>
              <p className="text-2xl font-black text-emerald-900">{formatNumber(feedInventory.currentStockKg)} <span className="text-sm font-normal">كغ</span></p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-1">الاستهلاك اليومي المقدر للقطيع</p>
              <p className="text-2xl font-black text-blue-900">{formatNumber(feedInventory.dailyFlockConsumptionKg)} <span className="text-sm font-normal">كغ/يوم</span></p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-1">يكفي لمدة (تقديري)</p>
              <p className="text-2xl font-black text-amber-900">
                {feedInventory.daysRemaining !== null ? `${feedInventory.daysRemaining} يوم` : '—'}
              </p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <p className="text-xs font-bold text-purple-700 mb-1">القيمة التقديرية للمخزون</p>
              <p className="text-2xl font-black text-purple-900">{formatCurrency(feedInventory.estimatedStockValue, sym)}</p>
            </Card>
          </div>

          {/* Stock Breakdown by Feed Type */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {(['starter', 'grower', 'preLayer', 'layer'] as FeedStockType[]).map(fType => (
              <Card key={fType} className="p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">{FEED_TYPE_LABELS[fType]}</p>
                <p className="text-xl font-black text-slate-800">{formatNumber(feedInventory.stockByType[fType])} كغ</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  الاستهلاك اليومي: {formatNumber(feedInventory.dailyByTypeKg[fType])} كغ
                </p>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-6">
            {feedInventory.dailyFlockConsumptionKg > 0 && (
              <button
                onClick={logDailyFeedConsumption}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                تسجيل استهلاك اليوم ({feedInventory.dailyFlockConsumptionKg} كغ)
              </button>
            )}
            <button
              onClick={() => {
                setFeedForm({
                  date: todayISO(),
                  movementType: 'consumption',
                  feedType: 'layer',
                  quantityKg: feedInventory.dailyFlockConsumptionKg || 5,
                  cost: 0,
                  notes: '',
                });
                setShowFeedModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-5 h-5" />
              إضافة حركة علف (شراء / استهلاك / جرد)
            </button>
          </div>

          {/* Feed Movements Table */}
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع الحركة</th>
                  <th>نوع العلف</th>
                  <th>الكمية (كغ)</th>
                  <th>التكلفة</th>
                  <th>ملاحظات</th>
                  <th className="text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {feedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-400">لا توجد حركات علف مسجلة بعد</td>
                  </tr>
                ) : (
                  feedMovements.map(m => (
                    <tr key={m.id}>
                      <td className="font-medium">{formatDate(m.date)}</td>
                      <td>
                        <Badge color={m.movementType === 'purchase' ? 'green' : m.movementType === 'consumption' ? 'amber' : 'blue'}>
                          {FEED_MOVEMENT_LABELS[m.movementType] || m.movementType}
                        </Badge>
                      </td>
                      <td>{FEED_TYPE_LABELS[m.feedType] || m.feedType}</td>
                      <td className={cn('font-bold', m.movementType === 'purchase' ? 'text-emerald-600' : m.movementType === 'consumption' ? 'text-red-600' : 'text-blue-600')}>
                        {m.movementType === 'purchase' ? '+' : m.movementType === 'consumption' ? '-' : ''}{m.quantityKg} كغ
                      </td>
                      <td>{m.cost > 0 ? formatCurrency(m.cost, sym) : '—'}</td>
                      <td className="text-xs text-slate-500">{m.notes || '—'}</td>
                      <td className="text-center">
                        <button
                          onClick={() => setDeleteFeedId(m.id!)}
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

          {/* Add Feed Movement Modal */}
          <Modal isOpen={showFeedModal} onClose={() => setShowFeedModal(false)} title="إضافة حركة علف" size="md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                <input type="date" value={feedForm.date} onChange={e => setFeedForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحركة</label>
                <select value={feedForm.movementType} onChange={e => setFeedForm(p => ({ ...p, movementType: e.target.value as FeedMovementType }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {Object.entries(FEED_MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نوع العلف</label>
                <select value={feedForm.feedType} onChange={e => setFeedForm(p => ({ ...p, feedType: e.target.value as FeedStockType }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {Object.entries(FEED_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الكمية (كغ)</label>
                <input type="number" step="0.5" value={feedForm.quantityKg} onChange={e => setFeedForm(p => ({ ...p, quantityKg: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" />
              </div>
              {feedForm.movementType === 'purchase' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">التكلفة ({sym}) — اختياري</label>
                  <input type="number" step="0.5" value={feedForm.cost} onChange={e => setFeedForm(p => ({ ...p, cost: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
                <input type="text" value={feedForm.notes} onChange={e => setFeedForm(p => ({ ...p, notes: e.target.value }))} placeholder="اختياري..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowFeedModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
                إلغاء
              </button>
              <button onClick={saveFeedMovement} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
                حفظ الحركة
              </button>
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={deleteFeedId !== null}
            onClose={() => setDeleteFeedId(null)}
            onConfirm={confirmDeleteFeedMovement}
            title="حذف حركة العلف"
            message="هل أنت متأكد من حذف هذه الحركة من سجل مخزون العلف؟"
            confirmLabel="حذف"
            confirmColor="red"
          />
        </>
      )}

      {tab === 'cashflow' && (
        <>
          <h2 className="text-lg font-bold text-slate-800 mb-4">📊 كشف التدفق النقدي الشهري</h2>
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>المداخيل</th>
                  <th>مصاريف تشغيلية</th>
                  <th>مصاريف تأسيسية</th>
                  <th>صافي التدفق</th>
                  <th>الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowData.map((row, i) => (
                  <tr key={i}>
                    <td className="font-bold">{row.month}</td>
                    <td className="text-emerald-600 font-medium">{formatCurrency(row.revenue, sym)}</td>
                    <td className="text-amber-600">{formatCurrency(row.opExpenses, sym)}</td>
                    <td className="text-red-600">{formatCurrency(row.capExpenses, sym)}</td>
                    <td className={cn('font-bold', row.netFlow >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {row.netFlow >= 0 ? '+' : ''}{formatCurrency(row.netFlow, sym)}
                    </td>
                    <td className={cn('font-bold', row.cumBalance >= 0 ? 'text-blue-600' : 'text-red-600')}>
                      {formatCurrency(row.cumBalance, sym)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
