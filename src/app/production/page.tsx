'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings, updateSettings } from '@/lib/db';
import type { DailyProduction, Sale, Settings, SaleType, Customer, DebtPayment, PaymentStatus, FlockGroup } from '@/lib/types';
import { SALE_TYPE_LABELS, PAYMENT_STATUS_LABELS, COOP_PAYMENT_LABELS } from '@/lib/types';
import { getActiveLayingHensFromFlock, applyDailyMortalityToFlock } from '@/lib/flock-sync';
import { formatCurrency, formatPercent, formatNumber, formatDate, todayISO, getMonthKey, cn } from '@/lib/utils';
import { Egg, ShoppingCart, Plus, Edit2, Trash2, CheckCircle2, PackageCheck, Users, HandCoins, Phone, MapPin, AlertCircle } from 'lucide-react';

function getSalePaidAmount(sale: Sale): number {
  if (sale.paymentStatus === 'unpaid') return sale.paidAmount ?? 0;
  if (sale.paymentStatus === 'partial') return sale.paidAmount ?? 0;
  return sale.paidAmount ?? sale.total;
}

function getSaleRemainingDebt(sale: Sale): number {
  return Math.max(0, Math.round((sale.total - getSalePaidAmount(sale)) * 100) / 100);
}

export default function ProductionPage() {
  const [tab, setTab] = useState<'production' | 'sales' | 'debts'>('production');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Production state
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [flockGroups, setFlockGroups] = useState<FlockGroup[]>([]);
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
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<number | null>(null);
  const [saleForm, setSaleForm] = useState({
    date: todayISO(), type: 'eggs' as SaleType, quantity: 0,
    unitType: 'tray' as 'unit' | 'tray', unitPrice: 45, buyerName: '',
    customerId: '' as string | number, paymentStatus: 'paid' as PaymentStatus, paidAmount: 0, notes: '',
  });

  // "تم البيع" (Sell Inventory) Modal state
  const [showQuickSellModal, setShowQuickSellModal] = useState(false);
  const [quickSellQuantity, setQuickSellQuantity] = useState(0);
  const [quickSellUnitType, setQuickSellUnitType] = useState<'unit' | 'tray'>('tray');
  const [quickSellUnitPrice, setQuickSellUnitPrice] = useState(45);
  const [quickSellBuyer, setQuickSellBuyer] = useState('');
  const [quickSellCustomerId, setQuickSellCustomerId] = useState<string | number>('');
  const [quickSellPaymentStatus, setQuickSellPaymentStatus] = useState<PaymentStatus>('paid');
  const [quickSellPaidAmount, setQuickSellPaidAmount] = useState(0);

  // Customers & Debts state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [payDebtForm, setPayDebtForm] = useState({
    date: todayISO(),
    customerId: undefined as number | undefined,
    customerName: '',
    saleId: undefined as number | undefined,
    amount: 0,
    maxAmount: 0,
    paymentMethod: 'cash' as 'cash' | 'bank' | 'check',
    notes: '',
  });

  // Edit Selling Prices Modal state
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingEggPrice, setEditingEggPrice] = useState(1.5);
  const [editingTrayPrice, setEditingTrayPrice] = useState(45);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, prods, sl, custs, pays, fg] = await Promise.all([
      getSettings(),
      db.dailyProduction.orderBy('date').reverse().toArray(),
      db.sales.orderBy('date').reverse().toArray(),
      db.customers.toArray(),
      db.debtPayments.toArray(),
      db.flockGroups.toArray(),
    ]);
    setSettings(s);
    setProductions(prods);
    setFlockGroups(fg);

    const flockLayersCount = getActiveLayingHensFromFlock(fg);
    if (flockLayersCount > 0) {
      setProdForm(prev => ({ ...prev, activeHenCount: flockLayersCount }));
    } else if (prods.length > 0) {
      setProdForm(prev => ({ ...prev, activeHenCount: Math.max(0, prods[0].activeHenCount - prods[0].dailyMortality) }));
    }
    setSales(sl);
    setCustomers(custs);
    setDebtPayments(pays);
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
      if (prodForm.dailyMortality > 0) {
        await applyDailyMortalityToFlock(prodForm.dailyMortality, prodForm.date, 'نفوق مسجل من صفحة الإنتاج اليومي');
      }
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
      customerId: '',
      paymentStatus: 'paid',
      paidAmount: settings?.sellingPrices.tray || 45,
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
      customerId: sale.customerId || '',
      paymentStatus: sale.paymentStatus || 'paid',
      paidAmount: getSalePaidAmount(sale),
      notes: sale.notes || '',
    });
    setShowSaleForm(true);
  }

  async function saveSale() {
    const total = saleForm.quantity * saleForm.unitPrice;
    const paidAmount =
      saleForm.paymentStatus === 'paid'
        ? total
        : saleForm.paymentStatus === 'unpaid'
          ? 0
          : Math.min(total, Math.max(0, Number(saleForm.paidAmount) || 0));
    const paymentStatus: PaymentStatus =
      paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const selectedCust = saleForm.customerId
      ? customers.find(c => c.id === Number(saleForm.customerId))
      : undefined;

    const payload = {
      date: saleForm.date,
      type: saleForm.type,
      quantity: saleForm.quantity,
      unitType: saleForm.unitType,
      unitPrice: saleForm.unitPrice,
      total,
      customerId: selectedCust ? selectedCust.id : null,
      buyerName: selectedCust ? selectedCust.name : saleForm.buyerName,
      paidAmount,
      paymentStatus,
      notes: saleForm.notes,
    };

    if (editingSaleId) {
      await db.sales.update(editingSaleId, payload);
    } else {
      await db.sales.add(payload);
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

  // --- Quick "تم البيع" (Sell Current Eggs Stock) ---
  function openQuickSell(availableEggs: number) {
    const defaultTrayPrice = settings?.sellingPrices.tray || 45;
    const defaultUnitPrice = settings?.sellingPrices.egg || 1.5;

    // إذا كان المجموع 30 أو أكثر، نقترح البيع بالصواني
    if (availableEggs >= 30) {
      const trays = Math.floor(availableEggs / 30);
      setQuickSellUnitType('tray');
      setQuickSellQuantity(trays);
      setQuickSellUnitPrice(defaultTrayPrice);
    } else {
      setQuickSellUnitType('unit');
      setQuickSellQuantity(availableEggs > 0 ? availableEggs : 1);
      setQuickSellUnitPrice(defaultUnitPrice);
    }
    setQuickSellBuyer('');
    setQuickSellCustomerId('');
    setQuickSellPaymentStatus('paid');
    setQuickSellPaidAmount(0);
    setShowQuickSellModal(true);
  }

  async function executeQuickSell() {
    const total = quickSellQuantity * quickSellUnitPrice;
    const paidAmount =
      quickSellPaymentStatus === 'paid'
        ? total
        : quickSellPaymentStatus === 'unpaid'
          ? 0
          : Math.min(total, Math.max(0, Number(quickSellPaidAmount) || 0));
    const paymentStatus: PaymentStatus =
      paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
    const selectedCust = quickSellCustomerId
      ? customers.find(c => c.id === Number(quickSellCustomerId))
      : undefined;

    await db.sales.add({
      date: todayISO(),
      type: 'eggs',
      quantity: Number(quickSellQuantity),
      unitType: quickSellUnitType,
      unitPrice: Number(quickSellUnitPrice),
      total,
      customerId: selectedCust ? selectedCust.id : null,
      buyerName: selectedCust ? selectedCust.name : (quickSellBuyer || 'بيع مباشر'),
      paidAmount,
      paymentStatus,
      notes: 'تم البيع السريع من المخزون الحالي',
    });
    setShowQuickSellModal(false);
    loadData();
  }

  // --- Customers & Debts Actions ---
  function openCreateCustomerModal() {
    setEditingCustomerId(null);
    setCustomerForm({ name: '', phone: '', address: '', notes: '' });
    setShowCustomerModal(true);
  }

  function openEditCustomerModal(c: Customer) {
    setEditingCustomerId(c.id || null);
    setCustomerForm({ name: c.name, phone: c.phone || '', address: c.address || '', notes: c.notes || '' });
    setShowCustomerModal(true);
  }

  async function saveCustomer() {
    if (!customerForm.name.trim()) return;
    if (editingCustomerId) {
      await db.customers.update(editingCustomerId, customerForm);
    } else {
      await db.customers.add(customerForm);
    }
    setShowCustomerModal(false);
    setEditingCustomerId(null);
    loadData();
  }

  async function confirmDeleteCustomer() {
    if (deleteCustomerId) {
      await db.customers.delete(deleteCustomerId);
      setDeleteCustomerId(null);
      loadData();
    }
  }

  function openPayDebtModal(opts: { customerId?: number; customerName: string; saleId?: number; remainingDebt: number }) {
    setPayDebtForm({
      date: todayISO(),
      customerId: opts.customerId,
      customerName: opts.customerName,
      saleId: opts.saleId,
      amount: opts.remainingDebt,
      maxAmount: opts.remainingDebt,
      paymentMethod: 'cash',
      notes: '',
    });
    setShowPayDebtModal(true);
  }

  async function executeDebtPayment() {
    const payAmt = Math.max(0, Number(payDebtForm.amount) || 0);
    if (payAmt <= 0 || !payDebtForm.customerName.trim()) return;

    await db.debtPayments.add({
      date: payDebtForm.date,
      customerId: payDebtForm.customerId || null,
      customerName: payDebtForm.customerName,
      saleId: payDebtForm.saleId || null,
      amount: payAmt,
      paymentMethod: payDebtForm.paymentMethod,
      notes: payDebtForm.notes || undefined,
    });

    // توزيع الدفعة على الفواتير غير الخالصة (إما فاتورة محددة أو الأقدم أولاً)
    let remainingToApply = payAmt;
    const targetSales = payDebtForm.saleId
      ? sales.filter(s => s.id === payDebtForm.saleId)
      : sales
          .filter(s => {
            const matchesCust = payDebtForm.customerId
              ? s.customerId === payDebtForm.customerId
              : (s.buyerName || '').trim() === payDebtForm.customerName.trim();
            return matchesCust && getSaleRemainingDebt(s) > 0;
          })
          .sort((a, b) => a.date.localeCompare(b.date));

    for (const s of targetSales) {
      if (remainingToApply <= 0) break;
      const owed = getSaleRemainingDebt(s);
      if (owed <= 0) continue;
      const applied = Math.min(owed, remainingToApply);
      const newPaid = Math.round((getSalePaidAmount(s) + applied) * 100) / 100;
      const newStatus: PaymentStatus = newPaid >= s.total - 0.01 ? 'paid' : 'partial';
      await db.sales.update(s.id!, {
        paidAmount: newPaid,
        paymentStatus: newStatus,
      });
      remainingToApply = Math.round((remainingToApply - applied) * 100) / 100;
    }

    setShowPayDebtModal(false);
    loadData();
  }

  async function confirmDeletePayment() {
    if (!deletePaymentId) return;
    const payment = debtPayments.find(p => p.id === deletePaymentId);
    if (payment && payment.amount > 0) {
      let remainingToRevert = payment.amount;
      const candidateSales = payment.saleId
        ? sales.filter(s => s.id === payment.saleId)
        : sales
            .filter(s => {
              const matchesCust = payment.customerId
                ? s.customerId === payment.customerId
                : (s.buyerName || '').trim() === payment.customerName.trim();
              return matchesCust && getSalePaidAmount(s) > 0;
            })
            // عكس التوزيع: نخصم من الأحدث فالأقدم
            .sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0));

      for (const s of candidateSales) {
        if (remainingToRevert <= 0 || !s.id) break;
        const currentPaid = getSalePaidAmount(s);
        if (currentPaid <= 0) continue;
        const revertAmt = Math.min(currentPaid, remainingToRevert);
        const newPaid = Math.max(0, Math.round((currentPaid - revertAmt) * 100) / 100);
        const newStatus: PaymentStatus =
          newPaid >= s.total - 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
        await db.sales.update(s.id, {
          paidAmount: newPaid,
          paymentStatus: newStatus,
        });
        remainingToRevert = Math.round((remainingToRevert - revertAmt) * 100) / 100;
      }
    }
    await db.debtPayments.delete(deletePaymentId);
    setDeletePaymentId(null);
    loadData();
  }

  // --- Change Selling Prices ---
  function openPriceModal() {
    setEditingEggPrice(settings?.sellingPrices.egg || 1.5);
    setEditingTrayPrice(settings?.sellingPrices.tray || 45);
    setShowPriceModal(true);
  }

  async function saveNewPrices() {
    if (settings) {
      const updatedSellingPrices = {
        ...settings.sellingPrices,
        egg: Number(editingEggPrice),
        tray: Number(editingTrayPrice),
      };
      await updateSettings({
        sellingPrices: updatedSellingPrices,
      });
      setShowPriceModal(false);
      loadData();
    }
  }

  // تجميع حسابات الزبائن والديون (دمج جدول الزبائن مع المبيعات الآجلة/الجزئية)
  const customerLedger = useMemo(() => {
    type LedgerRow = {
      key: string;
      customerId?: number;
      name: string;
      phone?: string;
      address?: string;
      notes?: string;
      totalPurchases: number;
      totalPaid: number;
      remainingDebt: number;
      salesCount: number;
      isRegistered: boolean;
    };

    const map = new Map<string, LedgerRow>();

    for (const c of customers) {
      map.set(`id:${c.id}`, {
        key: `id:${c.id}`,
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        notes: c.notes,
        totalPurchases: 0,
        totalPaid: 0,
        remainingDebt: 0,
        salesCount: 0,
        isRegistered: true,
      });
    }

    for (const s of sales) {
      const paid = getSalePaidAmount(s);
      const owed = getSaleRemainingDebt(s);
      let key = s.customerId ? `id:${s.customerId}` : '';
      if (!key || !map.has(key)) {
        const bName = (s.buyerName || '').trim();
        if (!bName || bName === 'بيع مباشر') continue;
        // مطابقة بالاسم مع زبون مسجل إن وجد
        const matchedCust = customers.find(c => c.name.trim() === bName);
        if (matchedCust) {
          key = `id:${matchedCust.id}`;
        } else {
          key = `name:${bName}`;
          if (!map.has(key)) {
            map.set(key, {
              key,
              name: bName,
              totalPurchases: 0,
              totalPaid: 0,
              remainingDebt: 0,
              salesCount: 0,
              isRegistered: false,
            });
          }
        }
      }
      const row = map.get(key)!;
      row.totalPurchases += s.total;
      row.totalPaid += paid;
      row.remainingDebt = Math.round((row.remainingDebt + owed) * 100) / 100;
      row.salesCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.remainingDebt - a.remainingDebt || b.totalPurchases - a.totalPurchases);
  }, [customers, sales]);

  const totalOutstandingDebt = useMemo(
    () => sales.reduce((sum, s) => sum + getSaleRemainingDebt(s), 0),
    [sales]
  );
  const debtorsCount = useMemo(
    () => customerLedger.filter(c => c.remainingDebt > 0).length,
    [customerLedger]
  );
  const totalDebtPaymentsCollected = useMemo(
    () => debtPayments.reduce((sum, p) => sum + p.amount, 0),
    [debtPayments]
  );

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const unitEggPrice = settings?.sellingPrices.egg || 1.5;
  const trayEggPrice = settings?.sellingPrices.tray || 45;

  // الحساب الشامل لمخزون البيض المتوفر للبيع (Total Saleable Eggs minus Total Eggs Sold)
  const allTimeProducedNetSaleable = productions.reduce((s, p) => s + p.netSaleableEggs, 0);
  const allTimeSoldEggsUnits = sales
    .filter(s => s.type === 'eggs')
    .reduce((s, sl) => s + (sl.unitType === 'tray' ? sl.quantity * 30 : sl.quantity), 0);
  
  const currentEggsStock = Math.max(0, allTimeProducedNetSaleable - allTimeSoldEggsUnits);
  const currentStockEstimatedValue = currentEggsStock * unitEggPrice;

  // فلترة حسب الشهر للعرض في الجدول
  const filteredProds = prodMonth ? productions.filter(p => getMonthKey(p.date) === prodMonth) : productions;
  const avgRate = filteredProds.length > 0 ? filteredProds.reduce((s, p) => s + p.productionRate, 0) / filteredProds.length : 0;
  const totalEggs = filteredProds.reduce((s, p) => s + p.totalEggsCollected, 0);
  const totalSaleable = filteredProds.reduce((s, p) => s + p.netSaleableEggs, 0);

  let filteredSales = salesTypeFilter === 'all' ? sales : sales.filter(s => s.type === salesTypeFilter);
  if (salesMonth) filteredSales = filteredSales.filter(s => getMonthKey(s.date) === salesMonth);
  if (salesPaymentFilter !== 'all') {
    filteredSales = filteredSales.filter(s => (s.paymentStatus || 'paid') === salesPaymentFilter);
  }
  const totalSalesRevenue = filteredSales.reduce((s, sl) => s + sl.total, 0);

  const prodMonths = [...new Set(productions.map(p => getMonthKey(p.date)))].sort().reverse();
  const saleMonths = [...new Set(sales.map(s => getMonthKey(s.date)))].sort().reverse();

  return (
    <AppShell>
      {/* 🌟 بطاقة المخزون الفوري وسعر البيع وزر "تم البيع" 🌟 */}
      <Card className="p-5 mb-6 bg-gradient-to-l from-blue-50 via-indigo-50/40 to-white border-blue-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                <Egg className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">مجموع البيض الموجود حالياً (المخزون الجاهز)</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-blue-900">{formatNumber(currentEggsStock)}</span>
                  <span className="text-sm text-blue-700 font-bold">بيضة</span>
                  {currentEggsStock >= 30 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                      ≈ {Math.floor(currentEggsStock / 30)} صينية و {currentEggsStock % 30} بيضة
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />

            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-500 font-medium">سعر البيع المعتمد</p>
                <button
                  onClick={openPriceModal}
                  title="تغيير سعر البيع"
                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold text-slate-800">{formatCurrency(unitEggPrice, sym)}</span>
                <span className="text-xs text-slate-400">للبيضة</span>
                <span className="text-slate-300">|</span>
                <span className="text-lg font-bold text-slate-800">{formatCurrency(trayEggPrice, sym)}</span>
                <span className="text-xs text-slate-400">للصينية (30)</span>
              </div>
            </div>

            <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />

            <div>
              <p className="text-xs text-slate-500 font-medium">القيمة المالية للمخزون الحالي</p>
              <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{formatCurrency(currentStockEstimatedValue, sym)}</p>
            </div>
          </div>

          {/* زر "تم البيع" الرئيسي */}
          <button
            onClick={() => openQuickSell(currentEggsStock)}
            className="w-full md:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition transform active:scale-95 text-base"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>تم البيع</span>
          </button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button onClick={() => setTab('production')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'production' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <span className="flex items-center gap-2"><Egg className="w-4 h-4" />الإنتاج اليومي</span>
        </button>
        <button onClick={() => setTab('sales')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'sales' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />سجل المبيعات</span>
        </button>
        <button onClick={() => setTab('debts')} className={cn('px-5 py-2 rounded-lg text-sm font-medium transition', tab === 'debts' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            الزبائن والديون
            {totalOutstandingDebt > 0 && (
              <span className="px-1.5 py-0.5 text-[11px] font-bold bg-red-100 text-red-700 rounded-full">
                {formatCurrency(totalOutstandingDebt, sym)}
              </span>
            )}
          </span>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  عدد الدجاج
                  {getActiveLayingHensFromFlock(flockGroups) > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold mr-1">
                      (مربوط بالقطيع: {getActiveLayingHensFromFlock(flockGroups)})
                    </span>
                  )}
                </label>
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
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">إجمالي البيض المجموع</p><p className="text-xl font-bold text-slate-800">{formatNumber(totalEggs)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">صافي البيض المعد للبيع</p><p className="text-xl font-bold text-emerald-600">{formatNumber(totalSaleable)}</p></Card>
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
          <div className="mb-6 flex gap-3">
            <button onClick={openCreateSaleModal} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition">
              <Plus className="w-5 h-5" />
              تسجيل بيع جديد
            </button>
            <button onClick={() => openQuickSell(currentEggsStock)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
              <PackageCheck className="w-5 h-5" />
              بيع من المخزون الحالي ({currentEggsStock} بيضة)
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
            <select value={salesPaymentFilter} onChange={e => setSalesPaymentFilter(e.target.value as PaymentStatus | 'all')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="all">كل حالات الدفع</option>
              <option value="paid">خالص</option>
              <option value="partial">مدفوع جزئياً</option>
              <option value="unpaid">كريدي (غير مدفوع)</option>
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
                  <th>الدفع</th>
                  <th>المشتري</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-slate-400">لا توجد عمليات بيع مسجلة</td>
                  </tr>
                ) : (
                  filteredSales.map(s => {
                    const remaining = getSaleRemainingDebt(s);
                    const status: PaymentStatus = s.paymentStatus || (remaining > 0 ? 'partial' : 'paid');
                    return (
                      <tr key={s.id}>
                        <td className="font-medium">{formatDate(s.date)}</td>
                        <td><Badge color="blue">{SALE_TYPE_LABELS[s.type]}</Badge></td>
                        <td>{s.quantity}</td>
                        <td>{s.unitType === 'tray' ? 'صينية' : 'وحدة'}</td>
                        <td>{formatCurrency(s.unitPrice, sym)}</td>
                        <td className="font-bold text-emerald-600">{formatCurrency(s.total, sym)}</td>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <Badge color={status === 'paid' ? 'green' : status === 'partial' ? 'amber' : 'red'}>
                              {PAYMENT_STATUS_LABELS[status]}
                            </Badge>
                            {remaining > 0 && (
                              <span className="text-[11px] font-bold text-red-600">
                                باقي: {formatCurrency(remaining, sym)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-slate-500">{s.buyerName || '—'}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {remaining > 0 && (
                              <button
                                onClick={() =>
                                  openPayDebtModal({
                                    customerId: s.customerId,
                                    customerName: s.buyerName || 'زبون غير محدد',
                                    saleId: s.id,
                                    remainingDebt: remaining,
                                  })
                                }
                                title="تسديد الدين"
                                className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                              >
                                تسديد
                              </button>
                            )}
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
                    );
                  })
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
                  <option value="unit">وحدة (بيضة)</option>
                  <option value="tray">صينية (30 بيضة)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">سعر الوحدة ({sym})</label>
                <input type="number" step="0.1" value={saleForm.unitPrice} onChange={e => setSaleForm(p => ({ ...p, unitPrice: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اختر زبوناً مسجلاً</label>
                <select
                  value={saleForm.customerId}
                  onChange={e => {
                    const cid = e.target.value;
                    const c = customers.find(x => x.id === Number(cid));
                    setSaleForm(p => ({ ...p, customerId: cid, buyerName: c ? c.name : p.buyerName }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">-- زبون جديد / غير مسجل --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {!saleForm.customerId && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم المشتري</label>
                  <input type="text" value={saleForm.buyerName} onChange={e => setSaleForm(p => ({ ...p, buyerName: e.target.value }))} placeholder="اكتب اسم المشتري..." className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">حالة الدفع</label>
                <select
                  value={saleForm.paymentStatus}
                  onChange={e => {
                    const st = e.target.value as PaymentStatus;
                    const tot = saleForm.quantity * saleForm.unitPrice;
                    setSaleForm(p => ({
                      ...p,
                      paymentStatus: st,
                      paidAmount: st === 'paid' ? tot : st === 'unpaid' ? 0 : p.paidAmount,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="paid">خالص (مدفوع بالكامل)</option>
                  <option value="partial">مدفوع جزئياً (تسبيق)</option>
                  <option value="unpaid">كريدي (غير مدفوع)</option>
                </select>
              </div>
              {saleForm.paymentStatus === 'partial' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ المدفوع ({sym})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={saleForm.paidAmount}
                    onChange={e => setSaleForm(p => ({ ...p, paidAmount: +e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}
              <div className="col-span-2 bg-emerald-50 rounded-lg p-3 text-center">
                <span className="text-lg font-bold text-emerald-700">المجموع: {formatCurrency(saleForm.quantity * saleForm.unitPrice, sym)}</span>
                {saleForm.paymentStatus !== 'paid' && (
                  <p className="text-xs font-bold text-red-600 mt-1">
                    الدين المسجل (المتبقي): {formatCurrency(
                      Math.max(0, saleForm.quantity * saleForm.unitPrice - (saleForm.paymentStatus === 'unpaid' ? 0 : saleForm.paidAmount)),
                      sym
                    )}
                  </p>
                )}
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

      {tab === 'debts' && (
        <>
          {/* Debts KPI Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-gradient-to-br from-red-50 to-white border-red-200">
              <p className="text-xs font-bold text-red-700 mb-1">إجمالي الديون المستحقة (الكريدي)</p>
              <p className="text-2xl font-black text-red-900">{formatCurrency(totalOutstandingDebt, sym)}</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-1">عدد الزبائن المدينين</p>
              <p className="text-2xl font-black text-amber-900">{debtorsCount} <span className="text-sm font-normal text-slate-500">زبون</span></p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <p className="text-xs font-bold text-emerald-700 mb-1">إجمالي الديون المحصلة</p>
              <p className="text-2xl font-black text-emerald-900">{formatCurrency(totalDebtPaymentsCollected, sym)}</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-1">الزبائن المسجلون</p>
              <p className="text-2xl font-black text-blue-900">{customers.length} <span className="text-sm font-normal text-slate-500">زبون</span></p>
            </Card>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              دفتر الزبائن والديون
            </h3>
            <button
              onClick={openCreateCustomerModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة زبون جديد
            </button>
          </div>

          {/* Customers & Debts Table */}
          <Card className="overflow-x-auto mb-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الزبون</th>
                  <th>الهاتف / العنوان</th>
                  <th>عدد المشتريات</th>
                  <th>إجمالي المشتريات</th>
                  <th>المدفوع</th>
                  <th>الدين المتبقي</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {customerLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      لا يوجد زبائن أو ديون مسجلة بعد. أضف زبوناً أو سجّل عملية بيع آجلة (كريدي).
                    </td>
                  </tr>
                ) : (
                  customerLedger.map(row => (
                    <tr key={row.key}>
                      <td>
                        <div className="font-bold text-slate-800">{row.name}</div>
                        {!row.isRegistered && (
                          <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">من سجل المبيعات</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-500">
                        {row.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {row.phone}</div>}
                        {row.address && <div className="flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {row.address}</div>}
                        {!row.phone && !row.address && '—'}
                      </td>
                      <td>{row.salesCount}</td>
                      <td className="font-medium text-slate-700">{formatCurrency(row.totalPurchases, sym)}</td>
                      <td className="font-medium text-emerald-600">{formatCurrency(row.totalPaid, sym)}</td>
                      <td>
                        {row.remainingDebt > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {formatCurrency(row.remainingDebt, sym)}
                          </span>
                        ) : (
                          <Badge color="green">خالص ✓</Badge>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.remainingDebt > 0 && (
                            <button
                              onClick={() =>
                                openPayDebtModal({
                                  customerId: row.customerId,
                                  customerName: row.name,
                                  remainingDebt: row.remainingDebt,
                                })
                              }
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
                            >
                              <HandCoins className="w-3.5 h-3.5" />
                              تسديد
                            </button>
                          )}
                          {row.isRegistered && row.customerId && (
                            <>
                              <button
                                onClick={() => {
                                  const cust = customers.find(c => c.id === row.customerId);
                                  if (cust) openEditCustomerModal(cust);
                                }}
                                title="تعديل الزبون"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteCustomerId(row.customerId!)}
                                title="حذف الزبون"
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          {/* Debt Payments History */}
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-600" />
            سجل تسديدات الديون
          </h3>
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الزبون</th>
                  <th>المبلغ المسدد</th>
                  <th>طريقة الدفع</th>
                  <th>ملاحظات</th>
                  <th className="text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {debtPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">لا توجد تسديدات مسجلة بعد</td>
                  </tr>
                ) : (
                  debtPayments.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{formatDate(p.date)}</td>
                      <td className="font-bold text-slate-800">{p.customerName}</td>
                      <td className="font-bold text-emerald-600">{formatCurrency(p.amount, sym)}</td>
                      <td><Badge color="blue">{COOP_PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod}</Badge></td>
                      <td className="text-slate-500 text-xs">{p.notes || '—'}</td>
                      <td className="text-center">
                        <button
                          onClick={() => setDeletePaymentId(p.id!)}
                          title="حذف السجل"
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

      {/* 🚀 Modal "تم البيع" السريع 🚀 */}
      <Modal isOpen={showQuickSellModal} onClose={() => setShowQuickSellModal(false)} title="تسجيل عملية البيع (تم البيع)" size="md">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">البيض المتوفر حالياً بالمزرعة</p>
              <p className="text-xl font-bold text-blue-950">{currentEggsStock} بيضة</p>
            </div>
            <div className="text-left text-xs text-blue-700">
              <p>سعر البيضة: {formatCurrency(unitEggPrice, sym)}</p>
              <p>سعر الصينية: {formatCurrency(trayEggPrice, sym)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">طريقة البيع (الوحدة)</label>
              <select
                value={quickSellUnitType}
                onChange={e => {
                  const ut = e.target.value as 'unit' | 'tray';
                  setQuickSellUnitType(ut);
                  setQuickSellUnitPrice(ut === 'tray' ? trayEggPrice : unitEggPrice);
                  if (ut === 'tray') {
                    setQuickSellQuantity(Math.max(1, Math.floor(currentEggsStock / 30) || 1));
                  } else {
                    setQuickSellQuantity(currentEggsStock > 0 ? currentEggsStock : 1);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="tray">بالصينية (30 بيضة)</option>
                <option value="unit">بالوحدة (بيضة مفرقة)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                الكمية المباعة ({quickSellUnitType === 'tray' ? 'صواني' : 'بيضات'})
              </label>
              <input
                type="number"
                min="1"
                value={quickSellQuantity}
                onChange={e => setQuickSellQuantity(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">سعر البيع للـ {quickSellUnitType === 'tray' ? 'صينية' : 'بيضة'} ({sym})</label>
              <input
                type="number"
                step="0.1"
                value={quickSellUnitPrice}
                onChange={e => setQuickSellUnitPrice(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اختر الزبون</label>
              <select
                value={quickSellCustomerId}
                onChange={e => {
                  const cid = e.target.value;
                  setQuickSellCustomerId(cid);
                  const c = customers.find(x => x.id === Number(cid));
                  if (c) setQuickSellBuyer(c.name);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">-- بيع مباشر / زبون جديد --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {!quickSellCustomerId && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم المشتري / الزبون</label>
                <input
                  type="text"
                  placeholder="اختياري (سوق، بقالة، شخص...)"
                  value={quickSellBuyer}
                  onChange={e => setQuickSellBuyer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">حالة الدفع</label>
              <select
                value={quickSellPaymentStatus}
                onChange={e => {
                  const st = e.target.value as PaymentStatus;
                  setQuickSellPaymentStatus(st);
                  if (st === 'paid') setQuickSellPaidAmount(quickSellQuantity * quickSellUnitPrice);
                  else if (st === 'unpaid') setQuickSellPaidAmount(0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="paid">خالص (نقداً)</option>
                <option value="partial">تسبيق (دفع جزئي)</option>
                <option value="unpaid">كريدي (غير مدفوع)</option>
              </select>
            </div>
            {quickSellPaymentStatus === 'partial' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ المدفوع ({sym})</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={quickSellPaidAmount}
                  onChange={e => setQuickSellPaidAmount(+e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-700 font-medium mb-1">إجمالي المبلغ المحصل من البيع</p>
            <p className="text-2xl font-black text-emerald-800">{formatCurrency(quickSellQuantity * quickSellUnitPrice, sym)}</p>
            <p className="text-xs text-slate-500 mt-1">
              (سيتم خصم {quickSellUnitType === 'tray' ? quickSellQuantity * 30 : quickSellQuantity} بيضة من المخزون وإضافتها لمداخيل المشروع)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowQuickSellModal(false)}
              className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={executeQuickSell}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-md"
            >
              تأكيد وحفظ البيع ✓
            </button>
          </div>
        </div>
      </Modal>

      {/* 🏷️ Modal تغيير أسعار البيع 🏷️ */}
      <Modal isOpen={showPriceModal} onClose={() => setShowPriceModal(false)} title="تعديل أسعار بيع البيض الافتراضية" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            تعديل الأسعار هنا سيحدث الأسعار الافتراضية للبيع في النظام وأسعار الحساب التقديري للمخزون.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">سعر البيضة الواحدة ({sym})</label>
            <input
              type="number"
              step="0.1"
              value={editingEggPrice}
              onChange={e => setEditingEggPrice(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">سعر الصينية (30 بيضة) ({sym})</label>
            <input
              type="number"
              step="0.5"
              value={editingTrayPrice}
              onChange={e => setEditingTrayPrice(+e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowPriceModal(false)}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={saveNewPrices}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm"
            >
              حفظ الأسعار
            </button>
          </div>
        </div>
      </Modal>

      {/* Customer Add / Edit Modal */}
      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title={editingCustomerId ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الزبون / المحل *</label>
            <input
              type="text"
              value={customerForm.name}
              onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))}
              placeholder="مثال: بقالة الأندلس، السي محمد..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={customerForm.phone}
                onChange={e => setCustomerForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="06..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العنوان / الدوار</label>
              <input
                type="text"
                value={customerForm.address}
                onChange={e => setCustomerForm(p => ({ ...p, address: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea
              value={customerForm.notes}
              onChange={e => setCustomerForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCustomerModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
              إلغاء
            </button>
            <button onClick={saveCustomer} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition">
              {editingCustomerId ? 'حفظ التعديلات' : 'إضافة الزبون'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Pay Debt Modal */}
      <Modal isOpen={showPayDebtModal} onClose={() => setShowPayDebtModal(false)} title={`تسديد دين — ${payDebtForm.customerName}`} size="md">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-xs text-red-700 font-medium">إجمالي الدين المستحق حالياً</p>
            <p className="text-2xl font-black text-red-800">{formatCurrency(payDebtForm.maxAmount, sym)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التسديد</label>
              <input
                type="date"
                value={payDebtForm.date}
                onChange={e => setPayDebtForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">طريقة الدفع</label>
              <select
                value={payDebtForm.paymentMethod}
                onChange={e => setPayDebtForm(p => ({ ...p, paymentMethod: e.target.value as 'cash' | 'bank' | 'check' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="cash">نقداً</option>
                <option value="bank">تحويل بنكي</option>
                <option value="check">شيك</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ المسدد ({sym})</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              max={payDebtForm.maxAmount}
              value={payDebtForm.amount}
              onChange={e => setPayDebtForm(p => ({ ...p, amount: +e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-emerald-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <input
              type="text"
              value={payDebtForm.notes}
              onChange={e => setPayDebtForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="اختياري..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowPayDebtModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
              إلغاء
            </button>
            <button onClick={executeDebtPayment} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-sm">
              تأكيد التسديد ✓
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Customer Confirm */}
      <ConfirmDialog
        isOpen={deleteCustomerId !== null}
        onClose={() => setDeleteCustomerId(null)}
        onConfirm={confirmDeleteCustomer}
        title="حذف الزبون"
        message="هل أنت متأكد من حذف هذا الزبون من الدفتر؟ ستبقى فواتير المبيعات المسجلة باسمه."
        confirmLabel="حذف"
        confirmColor="red"
      />

      {/* Delete Debt Payment Confirm */}
      <ConfirmDialog
        isOpen={deletePaymentId !== null}
        onClose={() => setDeletePaymentId(null)}
        onConfirm={confirmDeletePayment}
        title="حذف سجل التسديد"
        message="هل أنت متأكد من حذف هذا التسديد من السجل؟ سيتم إرجاع المبلغ إلى الدين المتبقي على الزبون وتحديث حالة الفاتورة."
        confirmLabel="حذف"
        confirmColor="red"
      />
    </AppShell>
  );
}
