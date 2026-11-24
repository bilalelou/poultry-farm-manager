'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { Expense, Settings, ExpenseCategory } from '@/lib/types';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SCOPE_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/types';
import { formatCurrency, formatDate, todayISO, getMonthKey, ARABIC_MONTHS, cn } from '@/lib/utils';
import { Plus, Wallet, TrendingUp, Edit2, Trash2 } from 'lucide-react';

export default function ExpensesPage() {
  const [tab, setTab] = useState<'expenses' | 'cashflow'>('expenses');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);

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
  });

  // Cash flow
  const [cashFlowData, setCashFlowData] = useState<Array<{ month: string; revenue: number; opExpenses: number; capExpenses: number; netFlow: number; cumBalance: number }>>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const s = await getSettings();
    setSettings(s);
    const exp = await db.expenses.orderBy('date').reverse().toArray();
    setExpenses(exp);

    // Build cash flow
    const sales = await db.sales.toArray();
    const allExpenses = await db.expenses.toArray();
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
    });
    setShowForm(true);
  }

  async function saveExpense() {
    const total = form.quantity * form.unitPrice;
    if (editingExpenseId) {
      await db.expenses.update(editingExpenseId, {
        ...form,
        total,
      });
    } else {
      await db.expenses.add({
        ...form,
        total,
      });
    }
    setShowForm(false);
    setEditingExpenseId(null);
    loadData();
  }

  async function confirmDeleteExpense() {
    if (deleteExpenseId) {
      await db.expenses.delete(deleteExpenseId);
      setDeleteExpenseId(null);
      loadData();
    }
  }

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
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button onClick={() => setTab('expenses')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'expenses' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}>
          <span className="flex items-center gap-2"><Wallet className="w-4 h-4" />المصاريف</span>
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
