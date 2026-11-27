'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { PayableDebt, PayablePayment, PayableCategory, PaymentStatus, Settings } from '@/lib/types';
import { PAYABLE_CATEGORY_LABELS, PAYMENT_STATUS_LABELS, COOP_PAYMENT_LABELS } from '@/lib/types';
import { formatCurrency, formatDate, todayISO, cn } from '@/lib/utils';
import {
  HandCoins, Plus, Edit2, Trash2, Phone, Calendar,
  CheckCircle2, AlertCircle, Search, Wallet
} from 'lucide-react';

export default function DebtsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<PayableDebt[]>([]);
  const [payments, setPayments] = useState<PayablePayment[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | PaymentStatus>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | PayableCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Debt Modal
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<number | null>(null);
  const [debtForm, setDebtForm] = useState({
    date: todayISO(),
    creditorName: '',
    phone: '',
    category: 'feed' as PayableCategory,
    description: '',
    totalAmount: 0,
    paidAmount: 0,
    dueDate: '',
    notes: '',
  });

  // Make Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({
    debtId: 0,
    creditorName: '',
    remaining: 0,
    date: todayISO(),
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'bank' | 'check',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, dList, pList] = await Promise.all([
        getSettings(),
        db.payableDebts.toArray(),
        db.payablePayments.toArray(),
      ]);
      setSettings(s);
      setDebts(dList);
      setPayments(pList);
    } catch (err) {
      console.error('Error loading debts:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDebtModal() {
    setEditingDebtId(null);
    setDebtForm({
      date: todayISO(),
      creditorName: '',
      phone: '',
      category: 'feed',
      description: '',
      totalAmount: 0,
      paidAmount: 0,
      dueDate: '',
      notes: '',
    });
    setShowDebtModal(true);
  }

  function openEditDebtModal(d: PayableDebt) {
    setEditingDebtId(d.id || null);
    setDebtForm({
      date: d.date,
      creditorName: d.creditorName,
      phone: d.phone || '',
      category: d.category,
      description: d.description,
      totalAmount: d.totalAmount,
      paidAmount: d.paidAmount,
      dueDate: d.dueDate || '',
      notes: d.notes || '',
    });
    setShowDebtModal(true);
  }

  async function saveDebt() {
    if (!debtForm.creditorName.trim() || debtForm.totalAmount <= 0) return;

    const total = Math.max(0, Number(debtForm.totalAmount));
    const paid = Math.min(total, Math.max(0, Number(debtForm.paidAmount) || 0));
    const status: PaymentStatus = paid >= total - 0.01 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const payload = {
      date: debtForm.date,
      creditorName: debtForm.creditorName.trim(),
      phone: debtForm.phone.trim() || null,
      category: debtForm.category,
      description: debtForm.description.trim() || PAYABLE_CATEGORY_LABELS[debtForm.category],
      totalAmount: total,
      paidAmount: paid,
      dueDate: debtForm.dueDate || null,
      status,
      notes: debtForm.notes.trim() || null,
    };

    if (editingDebtId) {
      await db.payableDebts.update(editingDebtId, payload);
    } else {
      await db.payableDebts.add(payload);
    }

    setShowDebtModal(false);
    setEditingDebtId(null);
    loadData();
  }

  async function confirmDeleteDebt() {
    if (deleteDebtId) {
      await db.payableDebts.delete(deleteDebtId);
      setDeleteDebtId(null);
      loadData();
    }
  }

  function openPayModal(d: PayableDebt) {
    const remaining = Math.max(0, Math.round((d.totalAmount - d.paidAmount) * 100) / 100);
    setPayForm({
      debtId: d.id!,
      creditorName: d.creditorName,
      remaining,
      date: todayISO(),
      amount: remaining,
      paymentMethod: 'cash',
      notes: '',
    });
    setShowPayModal(true);
  }

  async function executePayment() {
    const payAmt = Math.max(0, Number(payForm.amount) || 0);
    if (payAmt <= 0 || !payForm.debtId) return;

    const target = debts.find(d => d.id === payForm.debtId);
    if (!target) return;

    await db.payablePayments.add({
      debtId: payForm.debtId,
      date: payForm.date,
      amount: payAmt,
      paymentMethod: payForm.paymentMethod,
      notes: payForm.notes.trim() || null,
    });

    const newPaid = Math.min(target.totalAmount, Math.round((target.paidAmount + payAmt) * 100) / 100);
    const newStatus: PaymentStatus = newPaid >= target.totalAmount - 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await db.payableDebts.update(target.id!, {
      paidAmount: newPaid,
      status: newStatus,
    });

    setShowPayModal(false);
    loadData();
  }

  async function confirmDeletePayment() {
    if (!deletePaymentId) return;
    const p = payments.find(x => x.id === deletePaymentId);
    if (p) {
      const target = debts.find(d => d.id === p.debtId);
      if (target) {
        const newPaid = Math.max(0, Math.round((target.paidAmount - p.amount) * 100) / 100);
        const newStatus: PaymentStatus = newPaid >= target.totalAmount - 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
        await db.payableDebts.update(target.id!, {
          paidAmount: newPaid,
          status: newStatus,
        });
      }
      await db.payablePayments.delete(deletePaymentId);
    }
    setDeletePaymentId(null);
    loadData();
  }

  const stats = useMemo(() => {
    const totalOwed = debts.reduce((s, d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0);
    const totalPaid = debts.reduce((s, d) => s + d.paidAmount, 0);
    const activeCount = debts.filter(d => d.status !== 'paid').length;
    const upcomingDue = debts
      .filter(d => d.status !== 'paid' && d.dueDate)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0];
    return { totalOwed, totalPaid, activeCount, upcomingDue };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (filterCategory !== 'all' && d.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = d.creditorName.toLowerCase().includes(q);
        const matchDesc = d.description.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [debts, filterStatus, filterCategory, searchQuery]);

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <HandCoins className="w-7 h-7 text-red-500" />
            <span>الديون والالتزامات التي عليّ</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تتبع الديون المستحقة عليك للموردين، محلات الأعلاف، أو الأشخاص وسجل دفعات تسديدها بشكل مستقل
          </p>
        </div>
        <button
          onClick={openCreateDebtModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-sm transition"
        >
          <Plus className="w-5 h-5" />
          إضافة دين جديد عليّ
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-gradient-to-br from-red-50 to-white border-red-200">
          <p className="text-xs font-bold text-red-700 mb-1">إجمالي الديون المتبقية عليّ</p>
          <p className="text-2xl font-black text-red-900">{formatCurrency(stats.totalOwed, sym)}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <p className="text-xs font-bold text-emerald-700 mb-1">إجمالي المبالغ المسددة</p>
          <p className="text-2xl font-black text-emerald-900">{formatCurrency(stats.totalPaid, sym)}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <p className="text-xs font-bold text-amber-700 mb-1">الديون النشطة (غير خالصة)</p>
          <p className="text-2xl font-black text-amber-900">{stats.activeCount} <span className="text-sm font-normal text-slate-500">دين</span></p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <p className="text-xs font-bold text-blue-700 mb-1">أقرب موعد استحقاق</p>
          <p className="text-lg font-black text-blue-900">
            {stats.upcomingDue?.dueDate ? formatDate(stats.upcomingDue.dueDate) : 'لا يوجد موعد'}
          </p>
          {stats.upcomingDue && (
            <p className="text-[11px] text-blue-700 mt-0.5">{stats.upcomingDue.creditorName}</p>
          )}
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الدائن أو السبب..."
            className="w-full pr-9 pl-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | PaymentStatus)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="all">كل الحالات</option>
          <option value="unpaid">غير مسدد</option>
          <option value="partial">مسدد جزئياً</option>
          <option value="paid">تم التسديد بالكامل</option>
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as 'all' | PayableCategory)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="all">كل الفئات</option>
          {Object.entries(PAYABLE_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Debts Table */}
      <Card className="overflow-x-auto mb-8">
        <table className="data-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الدائن (الجهة)</th>
              <th>الفئة</th>
              <th>السبب / التفاصيل</th>
              <th>المبلغ الكلي</th>
              <th>المسدد</th>
              <th>المتبقي عليّ</th>
              <th>الاستحقاق</th>
              <th>الحالة</th>
              <th className="text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredDebts.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-400">
                  لا توجد ديون مسجلة عليك حالياً
                </td>
              </tr>
            ) : (
              filteredDebts.map(d => {
                const remaining = Math.max(0, Math.round((d.totalAmount - d.paidAmount) * 100) / 100);
                return (
                  <tr key={d.id}>
                    <td className="font-medium">{formatDate(d.date)}</td>
                    <td>
                      <div className="font-bold text-slate-800">{d.creditorName}</div>
                      {d.phone && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {d.phone}
                        </div>
                      )}
                    </td>
                    <td><Badge color="slate">{PAYABLE_CATEGORY_LABELS[d.category] || d.category}</Badge></td>
                    <td className="text-sm text-slate-700">{d.description}</td>
                    <td className="font-bold text-slate-800">{formatCurrency(d.totalAmount, sym)}</td>
                    <td className="font-medium text-emerald-600">{formatCurrency(d.paidAmount, sym)}</td>
                    <td>
                      {remaining > 0 ? (
                        <span className="font-black text-red-600">{formatCurrency(remaining, sym)}</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">0.00 {sym}</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">
                      {d.dueDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(d.dueDate)}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <Badge color={d.status === 'paid' ? 'green' : d.status === 'partial' ? 'amber' : 'red'}>
                        {d.status === 'paid' ? 'تم التسديد ✓' : d.status === 'partial' ? 'مسدد جزئياً' : 'غير مسدد'}
                      </Badge>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {remaining > 0 && (
                          <button
                            onClick={() => openPayModal(d)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            تسديد
                          </button>
                        )}
                        <button
                          onClick={() => openEditDebtModal(d)}
                          title="تعديل"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDebtId(d.id!)}
                          title="حذف"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Payments History */}
      <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-emerald-600" />
        سجل الدفعات التي سددتها
      </h2>
      <Card className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>تاريخ الدفع</th>
              <th>الدائن</th>
              <th>المبلغ المسدد</th>
              <th>طريقة الدفع</th>
              <th>ملاحظات</th>
              <th className="text-center">حذف</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-400">
                  لا توجد دفعات تسديد مسجلة بعد
                </td>
              </tr>
            ) : (
              payments.map(p => {
                const parentDebt = debts.find(d => d.id === p.debtId);
                return (
                  <tr key={p.id}>
                    <td className="font-medium">{formatDate(p.date)}</td>
                    <td className="font-bold text-slate-800">{parentDebt?.creditorName || `دين #${p.debtId}`}</td>
                    <td className="font-bold text-emerald-600">{formatCurrency(p.amount, sym)}</td>
                    <td><Badge color="blue">{COOP_PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}</Badge></td>
                    <td className="text-xs text-slate-500">{p.notes || '—'}</td>
                    <td className="text-center">
                      <button
                        onClick={() => setDeletePaymentId(p.id!)}
                        title="حذف الدفعة"
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Add / Edit Debt Modal */}
      <Modal
        isOpen={showDebtModal}
        onClose={() => setShowDebtModal(false)}
        title={editingDebtId ? 'تعديل الدين' : 'إضافة دين جديد عليّ'}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الدين</label>
            <input
              type="date"
              value={debtForm.date}
              onChange={e => setDebtForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الفئة</label>
            <select
              value={debtForm.category}
              onChange={e => setDebtForm(p => ({ ...p, category: e.target.value as PayableCategory }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {Object.entries(PAYABLE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الدائن / المورد *</label>
            <input
              type="text"
              value={debtForm.creditorName}
              onChange={e => setDebtForm(p => ({ ...p, creditorName: e.target.value }))}
              placeholder="مثال: بائع الأعلاف، السي أحمد..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
            <input
              type="text"
              value={debtForm.phone}
              onChange={e => setDebtForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="06..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">السبب / التفاصيل</label>
            <input
              type="text"
              value={debtForm.description}
              onChange={e => setDebtForm(p => ({ ...p, description: e.target.value }))}
              placeholder="مثال: 4 أكياس علف بياض بالكريدي، سلف لشراء..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">إجمالي الدين ({sym}) *</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={debtForm.totalAmount}
              onChange={e => setDebtForm(p => ({ ...p, totalAmount: +e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-red-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المدفوع مسبقاً / تسبيق ({sym})</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={debtForm.paidAmount}
              onChange={e => setDebtForm(p => ({ ...p, paidAmount: +e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الاستحقاق (اختياري)</label>
            <input
              type="date"
              value={debtForm.dueDate}
              onChange={e => setDebtForm(p => ({ ...p, dueDate: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <input
              type="text"
              value={debtForm.notes}
              onChange={e => setDebtForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2 bg-red-50 rounded-xl p-3 text-center">
            <span className="text-sm font-bold text-red-700">
              المتبقي عليك: {formatCurrency(Math.max(0, debtForm.totalAmount - debtForm.paidAmount), sym)}
            </span>
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setShowDebtModal(false)}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            onClick={saveDebt}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition"
          >
            {editingDebtId ? 'حفظ التعديلات' : 'حفظ الدين'}
          </button>
        </div>
      </Modal>

      {/* Pay Debt Modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={`تسديد دفعة لـ ${payForm.creditorName}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-xs text-red-700 font-medium">المتبقي عليك حالياً</p>
            <p className="text-2xl font-black text-red-800">{formatCurrency(payForm.remaining, sym)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التسديد</label>
              <input
                type="date"
                value={payForm.date}
                onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">طريقة الدفع</label>
              <select
                value={payForm.paymentMethod}
                onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value as 'cash' | 'bank' | 'check' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="cash">نقداً</option>
                <option value="bank">تحويل بنكي</option>
                <option value="check">شيك</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ المدفوع ({sym})</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              max={payForm.remaining}
              value={payForm.amount}
              onChange={e => setPayForm(p => ({ ...p, amount: +e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-emerald-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <input
              type="text"
              value={payForm.notes}
              onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="اختياري..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowPayModal(false)}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={executePayment}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-sm"
            >
              تأكيد التسديد ✓
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Debt Confirm */}
      <ConfirmDialog
        isOpen={deleteDebtId !== null}
        onClose={() => setDeleteDebtId(null)}
        onConfirm={confirmDeleteDebt}
        title="حذف الدين"
        message="هل أنت متأكد من حذف هذا الدين وجميع دفعاته المسجلة؟"
        confirmLabel="حذف"
        confirmColor="red"
      />

      {/* Delete Payment Confirm */}
      <ConfirmDialog
        isOpen={deletePaymentId !== null}
        onClose={() => setDeletePaymentId(null)}
        onConfirm={confirmDeletePayment}
        title="حذف الدفعة"
        message="هل أنت متأكد من حذف هذه الدفعة؟ سيتم إرجاع المبلغ إلى الدين المتبقي عليك."
        confirmLabel="حذف"
        confirmColor="red"
      />
    </AppShell>
  );
}

