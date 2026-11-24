'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db } from '@/lib/db';
import type { Investor, ValuationItem, ValuationCategory } from '@/lib/types';
import { VALUATION_CATEGORY_LABELS } from '@/lib/types';
import { formatCurrency, formatPercent, todayISO, cn } from '@/lib/utils';
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  PieChart as PieIcon,
  Layers,
  Sparkles,
  UserCheck,
  Building,
  Landmark
} from 'lucide-react';

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [valuations, setValuations] = useState<ValuationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab State: 'overview' | 'investors' | 'valuation'
  const [activeTab, setActiveTab] = useState<'overview' | 'investors' | 'valuation'>('overview');

  // Modals
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [editingInvestorId, setEditingInvestorId] = useState<number | null>(null);
  const [deleteInvestorId, setDeleteInvestorId] = useState<number | null>(null);

  const [showValuationModal, setShowValuationModal] = useState(false);
  const [editingValuationId, setEditingValuationId] = useState<number | null>(null);
  const [deleteValuationId, setDeleteValuationId] = useState<number | null>(null);

  // Investor Form
  const [investorForm, setInvestorForm] = useState<{
    name: string;
    phone: string;
    email: string;
    investedAmount: number;
    ownershipShare: number;
    entryDate: string;
    totalDistributed: number;
    status: 'active' | 'exited';
    notes: string;
  }>({
    name: '',
    phone: '',
    email: '',
    investedAmount: 5000,
    ownershipShare: 20,
    entryDate: todayISO(),
    totalDistributed: 0,
    status: 'active',
    notes: '',
  });

  // Valuation Form
  const [valForm, setValForm] = useState({
    category: 'equipment' as ValuationCategory,
    name: '',
    quantity: 1,
    unitValue: 1000,
    totalValue: 1000,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [invs, vals] = await Promise.all([
        db.investors.toArray(),
        db.valuationItems.toArray(),
      ]);
      setInvestors(invs);
      setValuations(vals);
    } catch (err) {
      console.error('Error loading investors & valuation:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- الحسابات المالية وتقييم المشروع ---
  const totalProjectValuation = valuations.reduce((sum, v) => sum + v.totalValue, 0);
  const totalCapitalInvested = investors.reduce((sum, i) => sum + i.investedAmount, 0);
  const totalDistributedProfits = investors.reduce((sum, i) => sum + i.totalDistributed, 0);
  const totalAllocatedShares = investors.reduce((sum, i) => sum + i.ownershipShare, 0);
  const remainingProjectShare = Math.max(0, 100 - totalAllocatedShares);

  // توزيع الأصول حسب الصنف
  const valuationByCategory: Record<ValuationCategory, number> = {
    equipment: 0,
    livestock: 0,
    realestate: 0,
    cash: 0,
    other: 0,
  };
  valuations.forEach(v => {
    if (valuationByCategory[v.category] !== undefined) {
      valuationByCategory[v.category] += v.totalValue;
    }
  });

  // --- دوال المستثمرين ---
  function openAddInvestor() {
    setEditingInvestorId(null);
    setInvestorForm({
      name: '',
      phone: '',
      email: '',
      investedAmount: 5000,
      ownershipShare: 10,
      entryDate: todayISO(),
      totalDistributed: 0,
      status: 'active',
      notes: '',
    });
    setShowInvestorModal(true);
  }

  function openEditInvestor(inv: Investor) {
    setEditingInvestorId(inv.id || null);
    setInvestorForm({
      name: inv.name,
      phone: inv.phone || '',
      email: inv.email || '',
      investedAmount: inv.investedAmount,
      ownershipShare: inv.ownershipShare,
      entryDate: inv.entryDate,
      totalDistributed: inv.totalDistributed,
      status: inv.status,
      notes: inv.notes || '',
    });
    setShowInvestorModal(true);
  }

  async function saveInvestor() {
    if (!investorForm.name.trim()) return;
    if (editingInvestorId) {
      await db.investors.update(editingInvestorId, investorForm);
    } else {
      await db.investors.add(investorForm);
    }
    setShowInvestorModal(false);
    loadData();
  }

  async function confirmDeleteInvestor() {
    if (deleteInvestorId) {
      await db.investors.delete(deleteInvestorId);
      setDeleteInvestorId(null);
      loadData();
    }
  }

  // --- دوال أصول التقييم ---
  function openAddValuation() {
    setEditingValuationId(null);
    setValForm({
      category: 'equipment',
      name: '',
      quantity: 1,
      unitValue: 1000,
      totalValue: 1000,
      notes: '',
    });
    setShowValuationModal(true);
  }

  function openEditValuation(val: ValuationItem) {
    setEditingValuationId(val.id || null);
    setValForm({
      category: val.category,
      name: val.name,
      quantity: val.quantity,
      unitValue: val.unitValue,
      totalValue: val.totalValue,
      notes: val.notes || '',
    });
    setShowValuationModal(true);
  }

  async function saveValuation() {
    if (!valForm.name.trim()) return;
    const dataToSave = {
      ...valForm,
      totalValue: valForm.quantity * valForm.unitValue,
    };
    if (editingValuationId) {
      await db.valuationItems.update(editingValuationId, dataToSave);
    } else {
      await db.valuationItems.add(dataToSave);
    }
    setShowValuationModal(false);
    loadData();
  }

  async function confirmDeleteValuation() {
    if (deleteValuationId) {
      await db.valuationItems.delete(deleteValuationId);
      setDeleteValuationId(null);
      loadData();
    }
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span>المستثمرون وقيمة المشروع (التقييم المالي)</span>
            <span className="text-2xl">💼</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">حساب القيمة الإجمالية للمشروع، أصول المزرعة، وتوزيع الحصص والأرباح</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAddValuation}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            إضافة أصل للتقييم
          </button>
          <button
            onClick={openAddInvestor}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة مستثمر / شريك
          </button>
        </div>
      </div>

      {/* Main KPI Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-100">القيمة التقديرية الحالية للمشروع</span>
            <span className="p-2 bg-emerald-400/30 rounded-lg"><Landmark className="w-5 h-5" /></span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(totalProjectValuation)}</p>
          <p className="text-xs text-emerald-100 mt-2">مجموع أصول المزرعة والثروة الحيوانية</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700">رؤوس الأموال المستثمرة</span>
            <span className="p-2 bg-blue-100 rounded-lg text-blue-600"><DollarSign className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-blue-900">{formatCurrency(totalCapitalInvested)}</p>
          <p className="text-xs text-slate-500 mt-2">من {investors.length} مستثمر / شريك مسجل</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-700">الحصص الموزعة</span>
            <span className="p-2 bg-purple-100 rounded-lg text-purple-600"><PieIcon className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-purple-900">{formatPercent(totalAllocatedShares)}</p>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min(100, totalAllocatedShares)}%` }} />
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">حصة المالك الرئيسية المتبقية</span>
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600"><UserCheck className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-amber-900">{formatPercent(remainingProjectShare)}</p>
          <p className="text-xs text-slate-500 mt-2">قيمتها: {formatCurrency((totalProjectValuation * remainingProjectShare) / 100)}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
            activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <PieIcon className="w-4 h-4" />
          لوحة التقييم والجدوى
        </button>
        <button
          onClick={() => setActiveTab('investors')}
          className={cn(
            'px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
            activeTab === 'investors' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Briefcase className="w-4 h-4" />
          قائمة المستثمرين والشركاء ({investors.length})
        </button>
        <button
          onClick={() => setActiveTab('valuation')}
          className={cn(
            'px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
            activeTab === 'valuation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Layers className="w-4 h-4" />
          تفاصيل أصول المزرعة ({valuations.length})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-5">
            <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              توزيع قيمة أصول المزرعة
            </h3>
            <div className="space-y-4">
              {(['equipment', 'livestock', 'realestate', 'cash', 'other'] as const).map(cat => {
                const val = valuationByCategory[cat] || 0;
                const pct = totalProjectValuation > 0 ? (val / totalProjectValuation) * 100 : 0;
                return (
                  <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1 text-sm">
                      <span className="font-bold text-slate-700">{VALUATION_CATEGORY_LABELS[cat]}</span>
                      <span className="font-black text-slate-900">{formatCurrency(val)} ({formatPercent(pct)})</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg">تحليل عائد الاستثمار (ROI)</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                تتيح لك هذه الصفحة تقديم عروض واضحة للمستثمرين بناءً على أصول المزرعة الفعلية (الفقاسة، قطيع البياض، والعتوكة)، مع حساب العائد الحقيقي لكل سهم أو نسبة مئوية.
              </p>
              <div className="space-y-3 pt-3 border-t border-slate-700 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">قيمة 1% من المشروع:</span>
                  <span className="font-bold text-amber-300">{formatCurrency(totalProjectValuation / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">قيمة 10% من المشروع:</span>
                  <span className="font-bold text-amber-300">{formatCurrency((totalProjectValuation * 10) / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">إجمالي الأرباح الموزعة:</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(totalDistributedProfits)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={openAddInvestor}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                تسجيل استثمار أو شريك جديد
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Investors List */}
      {activeTab === 'investors' && (
        <div>
          {investors.length === 0 ? (
            <Card className="p-10 text-center">
              <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">لا يوجد مستثمرون مسجلون حالياً</h3>
              <p className="text-sm text-slate-500 mb-4">يمكنك تسجيل الشركاء والمستثمرين ونسبة حصصهم في المشروع</p>
              <button
                onClick={openAddInvestor}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
              >
                إضافة أول مستثمر
              </button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {investors.map(inv => {
                const currentShareValue = (totalProjectValuation * inv.ownershipShare) / 100;
                return (
                  <Card key={inv.id} className="p-5 flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-slate-800">{inv.name}</h3>
                          <p className="text-xs text-slate-400">{inv.phone || 'بدون هاتف'} {inv.email ? `• ${inv.email}` : ''}</p>
                        </div>
                        <Badge color={inv.status === 'active' ? 'green' : 'amber'}>
                          {inv.status === 'active' ? 'شريك نشط' : 'تخارج'}
                        </Badge>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 grid grid-cols-2 gap-3 text-center">
                        <div>
                          <span className="text-[11px] text-slate-500 block">المبلغ المستثمر</span>
                          <span className="text-lg font-black text-blue-700">{formatCurrency(inv.investedAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-purple-600 block">نسبة الحصة</span>
                          <span className="text-lg font-black text-purple-700">{formatPercent(inv.ownershipShare)}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-slate-600 mb-4">
                        <div className="flex justify-between items-center">
                          <span>💰 القيمة السوقية للحصة:</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(currentShareValue)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>📅 تاريخ الدخول:</span>
                          <span className="font-medium text-slate-800">{inv.entryDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>💵 الأرباح المستلمة:</span>
                          <span className="font-bold text-slate-800">{formatCurrency(inv.totalDistributed)}</span>
                        </div>
                        {inv.notes && (
                          <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                            {inv.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">مستثمر #{inv.id}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditInvestor(inv)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteInvestorId(inv.id!)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Valuation Assets */}
      {activeTab === 'valuation' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg text-slate-800">قائمة أصول وممتلكات المزرعة</h3>
              <p className="text-xs text-slate-500">هذه الأصول هي التي تحدد القيمة الإجمالية للمشروع أمام المستثمرين</p>
            </div>
            <button
              onClick={openAddValuation}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              أصل جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
                <tr>
                  <th className="p-3">اسم الأصل</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">قيمة الوحدة</th>
                  <th className="p-3">إجمالي القيمة</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valuations.map(val => (
                  <tr key={val.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-slate-800">{val.name}</td>
                    <td className="p-3">
                      <Badge color="blue">{VALUATION_CATEGORY_LABELS[val.category]}</Badge>
                    </td>
                    <td className="p-3 font-medium">{val.quantity}</td>
                    <td className="p-3 font-medium">{formatCurrency(val.unitValue)}</td>
                    <td className="p-3 font-bold text-emerald-700">{formatCurrency(val.totalValue)}</td>
                    <td className="p-3 text-xs text-slate-400">{val.notes || '—'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditValuation(val)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded transition"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteValuationId(val.id!)}
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded transition"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Add/Edit Investor */}
      <Modal isOpen={showInvestorModal} onClose={() => setShowInvestorModal(false)} title={editingInvestorId ? "تعديل بيانات المستثمر" : "إضافة مستثمر / شريك جديد"} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستثمر / الشريك</label>
            <input
              type="text"
              value={investorForm.name}
              onChange={e => setInvestorForm(p => ({ ...p, name: e.target.value }))}
              placeholder="مثلاً: محمد العلوي"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={investorForm.phone}
                onChange={e => setInvestorForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="06XXXXXXXX"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={investorForm.email}
                onChange={e => setInvestorForm(p => ({ ...p, email: e.target.value }))}
                placeholder="partner@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">المبلغ المستثمر (د.م)</label>
              <input
                type="number"
                min="0"
                value={investorForm.investedAmount}
                onChange={e => setInvestorForm(p => ({ ...p, investedAmount: +e.target.value }))}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-bold text-blue-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-purple-700 mb-1">نسبة الحصة في المشروع (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={investorForm.ownershipShare}
                onChange={e => setInvestorForm(p => ({ ...p, ownershipShare: +e.target.value }))}
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm font-bold text-purple-900 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الدخول</label>
              <input
                type="date"
                value={investorForm.entryDate}
                onChange={e => setInvestorForm(p => ({ ...p, entryDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الأرباح الموزعة عليه (د.م)</label>
              <input
                type="number"
                min="0"
                value={investorForm.totalDistributed}
                onChange={e => setInvestorForm(p => ({ ...p, totalDistributed: +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات وشروط الاتفاق</label>
            <textarea
              value={investorForm.notes}
              onChange={e => setInvestorForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="مثال: تم الاتفاق على توزيع أرباح ربع سنوية..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setShowInvestorModal(false)}
              className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={saveInvestor}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
            >
              {editingInvestorId ? "حفظ التعديلات" : "تسجيل المستثمر"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add/Edit Valuation Item */}
      <Modal isOpen={showValuationModal} onClose={() => setShowValuationModal(false)} title={editingValuationId ? "تعديل أصل تقييمي" : "إضافة أصل جديد لتقييم المزرعة"} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الأصل أو الممتلكات</label>
            <input
              type="text"
              value={valForm.name}
              onChange={e => setValForm(p => ({ ...p, name: e.target.value }))}
              placeholder="مثلاً: فقاسة أوتوماتيكية، قطيع بياض، ألواح طاقة..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الصنف</label>
            <select
              value={valForm.category}
              onChange={e => setValForm(p => ({ ...p, category: e.target.value as ValuationCategory }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="equipment">معدات وتجهيزات (فقاسات، معالف، سقايات)</option>
              <option value="livestock">ثروة حيوانية (دجاج بياض، عتوكة، ديوك)</option>
              <option value="realestate">بنية تحتية وعنابر وبناء</option>
              <option value="cash">سيولة نقدية ومخزون أعلاف وبيض</option>
              <option value="other">أصول أخرى</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الكمية / العدد</label>
              <input
                type="number"
                min="1"
                value={valForm.quantity}
                onChange={e => setValForm(p => ({ ...p, quantity: +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">قيمة الوحدة التقديرية (د.م)</label>
              <input
                type="number"
                min="0"
                value={valForm.unitValue}
                onChange={e => setValForm(p => ({ ...p, unitValue: +e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-sm">
            <span className="font-bold text-emerald-800">إجمالي قيمة الأصل المحسوبة:</span>
            <span className="text-xl font-black text-emerald-900">{formatCurrency(valForm.quantity * valForm.unitValue)}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات حول الأصل</label>
            <textarea
              value={valForm.notes}
              onChange={e => setValForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="مثال: بحالة ممتازة مستوردة بضمان سنتين..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setShowValuationModal(false)}
              className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={saveValuation}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition"
            >
              {editingValuationId ? "حفظ التعديل" : "إضافة الأصل"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Investor Dialog */}
      <ConfirmDialog
        isOpen={deleteInvestorId !== null}
        onClose={() => setDeleteInvestorId(null)}
        onConfirm={confirmDeleteInvestor}
        title="حذف المستثمر"
        message="هل أنت متأكد من حذف هذا المستثمر؟"
        confirmLabel="حذف"
        confirmColor="red"
      />

      {/* Delete Valuation Dialog */}
      <ConfirmDialog
        isOpen={deleteValuationId !== null}
        onClose={() => setDeleteValuationId(null)}
        onConfirm={confirmDeleteValuation}
        title="حذف الأصل من التقييم"
        message="هل أنت متأكد من حذف هذا الأصل من تقييم المزرعة؟"
        confirmLabel="حذف"
        confirmColor="red"
      />
    </AppShell>
  );
}
