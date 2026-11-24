'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { DailyProduction, Sale, Settings, SaleType } from '@/lib/types';
import { SALE_TYPE_LABELS } from '@/lib/types';
import { formatCurrency, formatPercent, formatNumber, formatDate, todayISO, getMonthKey, ARABIC_MONTHS, cn } from '@/lib/utils';
import { Egg, ShoppingCart, Plus, Edit2, Trash2 } from 'lucide-react';

export default function ProductionPage() {
  const [tab, setTab] = useState<'production' | 'sales'>('production');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Production state
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [prodMonth, setProdMonth] = useState('');
  const [prodForm, setProdForm] = useState({
    date: todayISO(), activeHenCount: 0, dailyMortality: 0,
    totalEggsCollected: 0, brokenEggs: 0, incubatorEggs: 0, personalUse: 0,
  });
  const [editingProdId, setEditingProdId] = useState<number | null>(null);
  const [showProdEditModal, setShowProdEditModal] = useState(false);
  const [deleteProdId, setDeleteProdId] = useState<number | null>(null);

  // Sales state
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesMonth, setSalesMonth] = useState('');
  const [salesTypeFilter, setSalesTypeFilter] = useState<SaleType | 'all'>('all');
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<number | null>(null);
  const [saleForm, setSaleForm] = useState({
    date: todayISO(), type: 'eggs' as SaleType, quantity: 0,
    unitType: 'tray' as 'unit' | 'tray', unitPrice: 45, buyerName: '', notes: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const s = await getSettings();
    setSettings(s);
    const prods = await db.dailyProduction.orderBy('date').reverse().toArray();
    setProductions(prods);
    if (prods.length > 0) {
      setProdForm(prev => ({ ...prev, activeHenCount: prods[0].activeHenCount - prods[0].dailyMortality }));
    }
    const sl = await db.sales.orderBy('date').reverse().toArray();
    setSales(sl);
    setLoading(false);
  }

  // --- Production Actions ---
  async function saveProduction() {
    const net = prodForm.totalEggsCollected - prodForm.brokenEggs - prodForm.incubatorEggs - prodForm.personalUse;
    const rate = prodForm.activeHenCount > 0 ? (prodForm.totalEggsCollected / prodForm.activeHenCount) * 100 : 0;
    
    if (editingProdId) {
      await db.dailyProduction.update(editingProdId, {
        ...prodForm,
        netSaleableEggs: Math.max(0, net),
        productionRate: Math.round(rate * 10) / 10,
      });
      setShowProdEditModal(false);
      setEditingProdId(null);
    } else {
      await db.dailyProduction.add({
        ...prodForm,
        netSaleableEggs: Math.max(0, net),
        productionRate: Math.round(rate * 10) / 10,
      });
      setProdForm(prev => ({ ...prev, date: todayISO(), dailyMortality: 0, totalEggsCollected: 0, brokenEggs: 0, incubatorEggs: 0, personalUse: 0 }));
    }
    loadData();
  }

  function openEditProdModal(prod: DailyProduction) {
    setEditingProdId(prod.id || null);
    setProdForm({
      date: prod.date,
      activeHenCount: prod.activeHenCount,
      dailyMortality: prod.dailyMortality,
      totalEggsCollected: prod.totalEggsCollected,
      brokenEggs: prod.brokenEggs,
      incubatorEggs: prod.incubatorEggs,
      personalUse: prod.personalUse,
    });
    setShowProdEditModal(true);
  }

  async function confirmDeleteProd() {
    if (deleteProdId) {
      await db.dailyProduction.delete(deleteProdId);
      setDeleteProdId(null);
      loadData();
    }
  }

  // --- Sales Actions ---
  function openCreateSaleModal() {
    setEditingSaleId(null);
    setSaleForm({
      date: todayISO(),
      type: 'eggs',
      quantity: 1,
      unitType: 'tray',
      unitPrice: settings?.sellingPrices.tray || 45,
      buyerName: '',
      notes: '',
    });
    setShowSaleForm(true);
  }

  function openEditSaleModal(sale: Sale) {
    setEditingSaleId(sale.id || null);
    setSaleForm({
      date: sale.date,
      type: sale.type,
      quantity: sale.quantity,
      unitType: sale.unitType,
      unitPrice: sale.unitPrice,
      buyerName: sale.buyerName || '',
      notes: sale.notes || '',
    });
    setShowSaleForm(true);
  }

  async function saveSale() {
    const total = saleForm.quantity * saleForm.unitPrice;
    if (editingSaleId) {
      await db.sales.update(editingSaleId, { ...saleForm, total });
    } else {
      await db.sales.add({ ...saleForm, total });
    }
    setShowSaleForm(false);
    setEditingSaleId(null);
    loadData();
  }

  async function confirmDeleteSale() {
    if (deleteSaleId) {
      await db.sales.delete(deleteSaleId);
      setDeleteSaleId(null);
      loadData();
    }
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const filteredProds = prodMonth ? productions.filter(p => getMonthKey(p.date) === prodMonth) : productions;
  const avgRate = filteredProds.length > 0 ? filteredProds.reduce((s, p) => s + p.productionRate, 0) / filteredProds.length : 0;
  const totalEggs = filteredProds.reduce((s, p) => s + p.totalEggsCollected, 0);
  const totalSaleable = filteredProds.reduce((s, p) => s + p.netSaleableEggs, 0);

  let filteredSales = salesTypeFilter === 'all' ? sales : sales.filter(s => s.type === salesTypeFilter);
  if (salesMonth) filteredSales = filteredSales.filter(s => getMonthKey(s.date) === salesMonth);
  const totalSalesRevenue = filteredSales.reduce((s, sl) => s + sl.total, 0);

  // Get unique months from data
  const prodMonths = [...new Set(productions.map(p => getMonthKey(p.date)))].sort().reverse();
  const saleMonths = [...new Set(sales.map(s => getMonthKey(s.date)))].sort().reverse();

  return (
    <AppShell>
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button onClick={() => setTab('production')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'production' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <span className="flex items-center gap-2"><Egg className="w-4 h-4" />الإنتاج اليومي</span>
        </button>
        <button onClick={() => setTab('sales')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'sales' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />المبيعات</span>
        </button>
      </div>

      {tab === 'production' && (
        <>
          {/* Quick Entry */}
          <Card className="p-5 mb-6">
            <h3 className="font-bold text-slate-800 mb-4">📝 تسجيل إنتاج يومي جديد</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">التاريخ</label>
                <input type="date" value={prodForm.date} onChange={e => setProdForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">عدد الدجاج</label>
                <input type="number" value={prodForm.activeHenCount} onChange={e => setProdForm(p => ({ ...p, activeHenCount: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">النفوق</label>
                <input type="number" value={prodForm.dailyMortality} onChange={e => setProdForm(p => ({ ...p, dailyMortality: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">إجمالي البيض</label>
                <input type="number" value={prodForm.totalEggsCollected} onChange={e => setProdForm(p => ({ ...p, totalEggsCollected: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">مكسور</label>
                <input type="number" value={prodForm.brokenEggs} onChange={e => setProdForm(p => ({ ...p, brokenEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">للفقاسة</label>
                <input type="number" value={prodForm.incubatorEggs} onChange={e => setProdForm(p => ({ ...p, incubatorEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">استهلاك</label>
                <input type="number" value={prodForm.personalUse} onChange={e => setProdForm(p => ({ ...p, personalUse: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={saveProduction} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">
                  حفظ الإنتاج ✓
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-blue-600 font-medium">صافي البيع: {Math.max(0, prodForm.totalEggsCollected - prodForm.brokenEggs - prodForm.incubatorEggs - prodForm.personalUse)}</span>
              <span className="text-emerald-600 font-medium">نسبة الإنتاج: {prodForm.activeHenCount > 0 ? formatPercent((prodForm.totalEggsCollected / prodForm.activeHenCount) * 100) : '0%'}</span>
            </div>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">متوسط الإنتاج</p><p className="text-xl font-bold text-blue-600">{formatPercent(avgRate)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">إجمالي البيض</p><p className="text-xl font-bold text-slate-800">{formatNumber(totalEggs)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">صافي للبيع</p><p className="text-xl font-bold text-emerald-600">{formatNumber(totalSaleable)}</p></Card>
          </div>

          {/* Filter */}
          <div className="mb-4">
            <select value={prodMonth} onChange={e => setProdMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">كل الأشهر</option>
              {prodMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Production Table with Edit and Delete */}
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الدجاج</th>
                  <th>النفوق</th>
                  <th>البيض</th>
                  <th>مكسور</th>
                  <th>فقاسة</th>
                  <th>استهلاك</th>
                  <th>للبيع</th>
                  <th>النسبة</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProds.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-slate-400">لا توجد سجلات إنتاج مسجلة</td>
                  </tr>
                ) : (
                  filteredProds.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{formatDate(p.date)}</td>
                      <td>{p.activeHenCount}</td>
                      <td className={p.dailyMortality > 0 ? 'text-red-600 font-bold' : ''}>{p.dailyMortality}</td>
                      <td className="font-bold">{p.totalEggsCollected}</td>
                      <td>{p.brokenEggs}</td>
                      <td>{p.incubatorEggs}</td>
                      <td>{p.personalUse}</td>
                      <td className="font-bold text-emerald-600">{p.netSaleableEggs}</td>
                      <td>
                        <span className={cn('font-bold', p.productionRate >= 70 ? 'text-emerald-600' : p.productionRate >= 50 ? 'text-amber-600' : 'text-red-600')}>
                          {formatPercent(p.productionRate)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditProdModal(p)}
                            title="تعديل السجل"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteProdId(p.id!)}
                            title="حذف السجل"
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

          {/* Edit Production Modal */}
          <Modal isOpen={showProdEditModal} onClose={() => setShowProdEditModal(false)} title="تعديل سجل الإنتاج اليومي" size="md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                <input type="date" value={prodForm.date} onChange={e => setProdForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">عدد الدجاج البياض</label>
                <input type="number" value={prodForm.activeHenCount} onChange={e => setProdForm(p => ({ ...p, activeHenCount: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">النفوق</label>
                <input type="number" value={prodForm.dailyMortality} onChange={e => setProdForm(p => ({ ...p, dailyMortality: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">إجمالي البيض</label>
                <input type="number" value={prodForm.totalEggsCollected} onChange={e => setProdForm(p => ({ ...p, totalEggsCollected: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">مكسور / تالف</label>
                <input type="number" value={prodForm.brokenEggs} onChange={e => setProdForm(p => ({ ...p, brokenEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">للفقاسة</label>
                <input type="number" value={prodForm.incubatorEggs} onChange={e => setProdForm(p => ({ ...p, incubatorEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">استهلاك شخصي</label>
                <input type="number" value={prodForm.personalUse} onChange={e => setProdForm(p => ({ ...p, personalUse: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex items-end">
                <div className="bg-blue-50 px-3 py-2 rounded-lg w-full text-center">
                  <span className="text-sm text-blue-700 font-bold">
                    صافي للبيع: {Math.max(0, prodForm.totalEggsCollected - prodForm.brokenEggs - prodForm.incubatorEggs - prodForm.personalUse)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowProdEditModal(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
                إلغاء
              </button>
              <button onClick={saveProduction} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
                حفظ التعديلات
              </button>
            </div>
          </Modal>

          {/* Delete Production Confirm */}
          <ConfirmDialog
            isOpen={deleteProdId !== null}
            onClose={() => setDeleteProdId(null)}
            onConfirm={confirmDeleteProd}
            title="حذف سجل الإنتاج"
            message="هل أنت متأكد من رغبتك في حذف هذا السجل اليومي؟ سيتم تحديث الحسابات تلقائياً."
            confirmLabel="حذف"
            confirmColor="red"
          />
        </>
      )}

      {tab === 'sales' && (
        <>
          {/* Quick Sale Button */}
          <div className="mb-6">
            <button onClick={openCreateSaleModal} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition">
              <Plus className="w-5 h-5" />
              تسجيل بيع جديد
            </button>
          </div>

          {/* Sales Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(SALE_TYPE_LABELS).map(([key, label]) => {
              const typeTotal = sales.filter(s => s.type === key).reduce((sum, s) => sum + s.total, 0);
              if (typeTotal === 0) return null;
              return (
                <Card key={key} className="p-4 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(typeTotal, sym)}</p>
                </Card>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={salesTypeFilter} onChange={e => setSalesTypeFilter(e.target.value as SaleType | 'all')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="all">كل الأنواع</option>
              {Object.entries(SALE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={salesMonth} onChange={e => setSalesMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">كل الأشهر</option>
              {saleMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="bg-emerald-50 px-4 py-2 rounded-lg text-sm font-bold text-emerald-700">
              إجمالي: {formatCurrency(totalSalesRevenue, sym)}
            </div>
          </div>

          {/* Sales Table with Edit and Delete */}
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>الكمية</th>
                  <th>الوحدة</th>
                  <th>السعر</th>
                  <th>المجموع</th>
                  <th>المشتري</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-400">لا توجد عمليات بيع مسجلة</td>
                  </tr>
                ) : (
                  filteredSales.map(s => (
                    <tr key={s.id}>
                      <td className="font-medium">{formatDate(s.date)}</td>
                      <td><Badge color="blue">{SALE_TYPE_LABELS[s.type]}</Badge></td>
                      <td>{s.quantity}</td>
                      <td>{s.unitType === 'tray' ? 'صينية' : 'وحدة'}</td>
                      <td>{formatCurrency(s.unitPrice, sym)}</td>
                      <td className="font-bold text-emerald-600">{formatCurrency(s.total, sym)}</td>
                      <td className="text-slate-500">{s.buyerName || '—'}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditSaleModal(s)}
                            title="تعديل عملية البيع"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteSaleId(s.id!)}
                            title="حذف عملية البيع"
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

          {/* Sale Form Modal (Create / Edit) */}
          <Modal isOpen={showSaleForm} onClose={() => setShowSaleForm(false)} title={editingSaleId ? "تعديل عملية البيع" : "تسجيل بيع جديد"} size="md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                <input type="date" value={saleForm.date} onChange={e => setSaleForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">النوع</label>
                <select value={saleForm.type} onChange={e => {
                  const type = e.target.value as SaleType;
                  const prices = settings?.sellingPrices;
                  let price = 0;
                  if (prices) {
                    if (type === 'eggs') price = saleForm.unitType === 'tray' ? prices.tray : prices.egg;
                    else if (type === 'fertilizedEggs') price = prices.fertilizedEgg;
                    else if (type === 'chicks') price = prices.chick;
                    else if (type === 'culledHens') price = prices.culledHen;
                    else if (type === 'males') price = prices.maleBroiler;
                    else if (type === 'manure') price = prices.manure;
                  }
                  setSaleForm(p => ({ ...p, type, unitPrice: price }));
                }} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  {Object.entries(SALE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
                <input type="number" value={saleForm.quantity} onChange={e => setSaleForm(p => ({ ...p, quantity: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوحدة</label>
                <select value={saleForm.unitType} onChange={e => {
                  const ut = e.target.value as 'unit' | 'tray';
                  const price = ut === 'tray' ? (settings?.sellingPrices.tray || 45) : (settings?.sellingPrices.egg || 1.5);
                  setSaleForm(p => ({ ...p, unitType: ut, unitPrice: saleForm.type === 'eggs' ? price : p.unitPrice }));
                }} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="unit">وحدة</option>
                  <option value="tray">صينية (30)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">سعر الوحدة ({sym})</label>
                <input type="number" step="0.1" value={saleForm.unitPrice} onChange={e => setSaleForm(p => ({ ...p, unitPrice: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المشتري</label>
                <input type="text" value={saleForm.buyerName} onChange={e => setSaleForm(p => ({ ...p, buyerName: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="col-span-2 bg-emerald-50 rounded-lg p-3 text-center">
                <span className="text-lg font-bold text-emerald-700">المجموع: {formatCurrency(saleForm.quantity * saleForm.unitPrice, sym)}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowSaleForm(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
                إلغاء
              </button>
              <button onClick={saveSale} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition">
                {editingSaleId ? 'حفظ التعديلات' : 'حفظ البيع'}
              </button>
            </div>
          </Modal>

          {/* Delete Sale Confirm */}
          <ConfirmDialog
            isOpen={deleteSaleId !== null}
            onClose={() => setDeleteSaleId(null)}
            onConfirm={confirmDeleteSale}
            title="حذف عملية البيع"
            message="هل أنت متأكد من رغبتك في حذف عملية البيع هذه؟ سيتم تعديل إجمالي المداخيل."
            confirmLabel="حذف"
            confirmColor="red"
          />
        </>
      )}
    </AppShell>
  );
}
