'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { Card, KPICard, Modal, ProgressBar, LoadingSpinner } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { Settings, DailyProduction, Expense, Sale, IncubatorBatch, RearingBatch, FlockGroup, PayableDebt } from '@/lib/types';
import { PAYABLE_CATEGORY_LABELS } from '@/lib/types';
import { formatCurrency, formatPercent, formatNumber, todayISO, addDays, getMonthKey, ARABIC_MONTHS, cn } from '@/lib/utils';
import { getActiveLayingHensFromFlock, applyDailyMortalityToFlock } from '@/lib/flock-sync';
import {
  DollarSign, TrendingDown, TrendingUp, Percent,
  Egg, Bird, BarChart3, Target, Plus, ClipboardList, Calendar, RotateCcw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type DatePreset = 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: 'الكل',
  week: 'آخر 7 أيام',
  month: 'هذا الشهر',
  quarter: 'آخر 3 أشهر',
  year: 'هذه السنة',
  custom: 'فترة مخصصة',
};

function isWithinDateRange(dateStr: string, start: string, end: string): boolean {
  if (!start && !end) return true;
  const d = (dateStr || '').slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

export default function DashboardPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw data for instant client-side date filtering
  const [rawSales, setRawSales] = useState<Sale[]>([]);
  const [rawExpenses, setRawExpenses] = useState<Expense[]>([]);
  const [rawProductions, setRawProductions] = useState<DailyProduction[]>([]);
  const [rawBatches, setRawBatches] = useState<IncubatorBatch[]>([]);
  const [rawRearingBatches, setRawRearingBatches] = useState<RearingBatch[]>([]);
  const [rawFlockGroups, setRawFlockGroups] = useState<FlockGroup[]>([]);
  const [rawPayableDebts, setRawPayableDebts] = useState<PayableDebt[]>([]);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Quick action modals
  const [showEggModal, setShowEggModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [eggForm, setEggForm] = useState({ date: todayISO(), activeHenCount: 0, dailyMortality: 0, totalEggsCollected: 0, brokenEggs: 0, incubatorEggs: 0, personalUse: 0 });
  const [expenseForm, setExpenseForm] = useState({ date: todayISO(), category: 'feed' as const, description: '', quantity: 1, unitPrice: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  async function loadData() {
    try {
      const s = await getSettings();
      setSettings(s);

      const [sales, expenses, productions, batches, rearingBatches, flockGroups, payableDebts] = await Promise.all([
        db.sales.toArray(),
        db.expenses.toArray(),
        db.dailyProduction.orderBy('date').toArray(),
        db.incubatorBatches.orderBy('startDate').toArray(),
        db.rearingBatches.toArray(),
        db.flockGroups.toArray(),
        db.payableDebts.toArray(),
      ]);

      setRawSales(sales);
      setRawExpenses(expenses);
      setRawProductions(productions);
      setRawBatches(batches);
      setRawRearingBatches(rearingBatches);
      setRawFlockGroups(flockGroups);
      setRawPayableDebts(payableDebts);

      const flockLayersCount = getActiveLayingHensFromFlock(flockGroups);
      if (flockLayersCount > 0) {
        setEggForm(prev => ({ ...prev, activeHenCount: flockLayersCount }));
      } else if (productions.length > 0) {
        const latest = productions[productions.length - 1];
        setEggForm(prev => ({ ...prev, activeHenCount: latest.activeHenCount }));
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const { startDate, endDate } = useMemo(() => {
    const today = todayISO();
    switch (datePreset) {
      case 'week':
        return { startDate: addDays(today, -6), endDate: today };
      case 'month':
        return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
      case 'quarter':
        return { startDate: addDays(today, -89), endDate: today };
      case 'year':
        return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
      case 'custom':
        return { startDate: customStart, endDate: customEnd };
      case 'all':
      default:
        return { startDate: '', endDate: '' };
    }
  }, [datePreset, customStart, customEnd]);

  const dashboardStats = useMemo(() => {
    const sales = rawSales.filter(s => isWithinDateRange(s.date, startDate, endDate));
    const expenses = rawExpenses.filter(e => isWithinDateRange(e.date, startDate, endDate));
    const productions = rawProductions.filter(p => isWithinDateRange(p.date, startDate, endDate));
    const batches = rawBatches.filter(b => isWithinDateRange(b.startDate, startDate, endDate));
    const rearingBatches = rawRearingBatches.filter(r => isWithinDateRange(r.startDate, startDate, endDate));
    const payableDebts = rawPayableDebts.filter(d => isWithinDateRange(d.date, startDate, endDate));

    // حساب نسبة النفوق الفعلية من دفعات التربية وسجلات الإنتاج اليومي ضمن الفترة
    let totalRearingDeaths = 0;
    let totalRearingInitial = 0;
    let transferredSurvivors = 0;
    for (const r of rearingBatches) {
      const initial = r.initialChickCount || 0;
      const deaths =
        r.mortalityCount !== undefined && r.mortalityCount !== null
          ? r.mortalityCount
          : r.currentHealthyCount !== undefined && r.currentHealthyCount !== null
            ? Math.max(0, initial - r.currentHealthyCount)
            : 0;
      totalRearingInitial += initial;
      totalRearingDeaths += deaths;
      if (r.status === 'transferred') {
        transferredSurvivors += Math.max(0, (r.currentHealthyCount ?? initial - deaths) - (r.malesCount || 0));
      }
    }
    const totalDailyDeaths = productions.reduce((sum, p) => sum + (p.dailyMortality || 0), 0);
    const latestProdHens = productions.length > 0
      ? productions[productions.length - 1].activeHenCount
      : rawProductions.length > 0
        ? rawProductions[rawProductions.length - 1].activeHenCount
        : rawFlockGroups.filter(f => f.category === 'layers').reduce((s, f) => s + (f.femalesCount || 0), 0);
    const adultRoosters = rawFlockGroups.filter(f => f.category === 'roosters').reduce((s, f) => s + (f.malesCount || 0), 0);
    const externalAdults = Math.max(0, latestProdHens - transferredSurvivors) + adultRoosters;
    const totalTrackedBirds = totalRearingInitial + externalAdults + totalDailyDeaths;
    const totalDeaths = totalRearingDeaths + totalDailyDeaths;
    const mortalityRate = totalTrackedBirds > 0 ? Math.round((totalDeaths / totalTrackedBirds) * 1000) / 10 : 0;
    const mortalityDetails = totalTrackedBirds > 0 ? `${totalDeaths} من ${totalTrackedBirds} طير` : '';

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
    const foundationExpenses = expenses.filter(e => e.scope === 'foundation').reduce((sum, e) => sum + e.total, 0);

    // مؤشرات الإنتاج للفترة
    const avgProductionRate = productions.length > 0
      ? productions.reduce((sum, p) => sum + p.productionRate, 0) / productions.length
      : 0;
    const totalEggsProduced = productions.reduce((sum, p) => sum + p.totalEggsCollected, 0);

    // المؤشرات الآنية للمزرعة (القطيع النشط والمخزون التراكمي الحالي)
    const flockLayersCount = getActiveLayingHensFromFlock(rawFlockGroups);
    const activeHens = flockLayersCount > 0
      ? flockLayersCount
      : rawProductions.length > 0
        ? rawProductions[rawProductions.length - 1].activeHenCount
        : 0;
    const totalNetSaleable = rawProductions.reduce((sum, p) => sum + p.netSaleableEggs, 0);
    const totalSoldAll = rawSales
      .filter(s => s.type === 'eggs')
      .reduce((sum, s) => sum + (s.unitType === 'tray' ? s.quantity * 30 : s.quantity), 0);
    const currentEggsStock = Math.max(0, totalNetSaleable - totalSoldAll);

    const hatchedBatches = batches.filter(b => b.status !== 'incubating' && b.hatchRate);
    const latestBatch = hatchedBatches.length > 0 ? hatchedBatches[hatchedBatches.length - 1] : null;

    // Monthly chart data
    const months = new Map<string, { revenue: number; expenses: number }>();
    sales.forEach(s => {
      const mk = getMonthKey(s.date);
      const existing = months.get(mk) || { revenue: 0, expenses: 0 };
      existing.revenue += s.total;
      months.set(mk, existing);
    });
    expenses.forEach(e => {
      const mk = getMonthKey(e.date);
      const existing = months.get(mk) || { revenue: 0, expenses: 0 };
      existing.expenses += e.total;
      months.set(mk, existing);
    });
    const sortedMonths = Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const monthlyData = sortedMonths.map(([m, d]) => {
      const [y, mo] = m.split('-');
      return { month: ARABIC_MONTHS[parseInt(mo) - 1] + ' ' + y, revenue: d.revenue, expenses: d.expenses, profit: d.revenue - d.expenses };
    });

    // Production trend (last 30 days when 'all', or all days in selected range)
    const trendSource = datePreset === 'all' ? productions.slice(-30) : productions;
    const productionTrend = trendSource.map(p => ({ date: p.date.substring(5), rate: Math.round(p.productionRate * 10) / 10 }));

    // Expense categories
    const catMap = new Map<string, number>();
    const catLabels: Record<string, string> = { feed: 'أعلاف', medicine: 'أدوية', electricity: 'كهرباء', water: 'ماء', heating: 'تدفئة', equipment: 'معدات', bedding: 'فرشة', transport: 'نقل', cleaning: 'تنظيف', vaccination: 'تحصينات', labor: 'عمالة', rent: 'إيجار', other: 'أخرى' };
    expenses.forEach(e => {
      const label = catLabels[e.category] || e.category;
      catMap.set(label, (catMap.get(label) || 0) + e.total);
    });
    const expenseCategories = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Debt categories (الديون التي عليّ المتبقية حسب الفئة)
    const debtMap = new Map<string, number>();
    let totalPayableRemaining = 0;
    payableDebts.forEach(d => {
      const remaining = Math.max(0, Math.round((d.totalAmount - d.paidAmount) * 100) / 100);
      if (remaining > 0) {
        const label = PAYABLE_CATEGORY_LABELS[d.category] || d.category;
        debtMap.set(label, Math.round(((debtMap.get(label) || 0) + remaining) * 100) / 100);
        totalPayableRemaining = Math.round((totalPayableRemaining + remaining) * 100) / 100;
      }
    });
    const debtCategories = Array.from(debtMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return {
      totalRevenue,
      totalExpenses,
      foundationExpenses,
      activeHens,
      avgProductionRate,
      totalEggsProduced,
      currentEggsStock,
      mortalityRate,
      mortalityDetails,
      latestBatch,
      monthlyData,
      productionTrend,
      expenseCategories,
      debtCategories,
      totalPayableRemaining,
    };
  }, [rawSales, rawExpenses, rawProductions, rawBatches, rawRearingBatches, rawFlockGroups, rawPayableDebts, startDate, endDate, datePreset]);

  async function saveEggCollection() {
    const net = eggForm.totalEggsCollected - eggForm.brokenEggs - eggForm.incubatorEggs - eggForm.personalUse;
    const rate = eggForm.activeHenCount > 0 ? (eggForm.totalEggsCollected / eggForm.activeHenCount) * 100 : 0;
    await db.dailyProduction.add({
      ...eggForm,
      netSaleableEggs: Math.max(0, net),
      productionRate: Math.round(rate * 10) / 10,
    });
    if (eggForm.dailyMortality > 0) {
      await applyDailyMortalityToFlock(eggForm.dailyMortality, eggForm.date, 'نفوق مسجل من لوحة القيادة');
    }
    setShowEggModal(false);
    setEggForm({ date: todayISO(), activeHenCount: eggForm.activeHenCount, dailyMortality: 0, totalEggsCollected: 0, brokenEggs: 0, incubatorEggs: 0, personalUse: 0 });
    loadData();
  }

  async function saveExpense() {
    await db.expenses.add({
      date: expenseForm.date,
      scope: 'general',
      type: 'operational',
      category: expenseForm.category,
      description: expenseForm.description,
      quantity: expenseForm.quantity,
      unitPrice: expenseForm.unitPrice,
      total: expenseForm.quantity * expenseForm.unitPrice,
    });
    setShowExpenseModal(false);
    setExpenseForm({ date: todayISO(), category: 'feed', description: '', quantity: 1, unitPrice: 0 });
    loadData();
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const {
    totalRevenue,
    totalExpenses,
    foundationExpenses,
    activeHens,
    avgProductionRate,
    totalEggsProduced,
    currentEggsStock,
    mortalityRate,
    mortalityDetails,
    latestBatch,
    monthlyData,
    productionTrend,
    expenseCategories,
    debtCategories,
    totalPayableRemaining,
  } = dashboardStats;

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const costPerEgg = totalEggsProduced > 0 ? totalExpenses / totalEggsProduced : 0;
  const profitPerEgg = totalEggsProduced > 0 ? netProfit / totalEggsProduced : 0;
  const breakEvenEggs = profitPerEgg > 0 ? Math.ceil(foundationExpenses / profitPerEgg) : 0;
  const sym = settings?.currencySymbol || 'د.م';

  return (
    <AppShell>
      {/* Quick Actions & Date Filter */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowEggModal(true)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-sm">
              <Egg className="w-5 h-5" />
              تسجيل جمع البيض
            </button>
            <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition shadow-sm">
              <Plus className="w-5 h-5" />
              إضافة مصروف
            </button>
          </div>

          {datePreset !== 'all' && (
            <button
              onClick={() => { setDatePreset('all'); setCustomStart(''); setCustomEnd(''); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة تعيين الفلتر
            </button>
          )}
        </div>

        {/* Date Filter Bar */}
        <Card className="p-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700 ml-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                الفترة:
              </span>
              {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(preset => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                    datePreset === preset
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {DATE_PRESET_LABELS[preset]}
                </button>
              ))}
            </div>

            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-slate-600">من:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <label className="text-xs font-medium text-slate-600">إلى:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            )}

            {datePreset !== 'all' && (startDate || endDate) && (
              <div className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg font-medium self-start lg:self-auto">
                عرض البيانات {startDate ? `من ${startDate}` : ''} {endDate ? `إلى ${endDate}` : ''}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="إجمالي المداخيل" value={formatCurrency(totalRevenue, sym)} icon={<DollarSign className="w-6 h-6" />} color="blue" />
        <KPICard title="إجمالي المصاريف" value={formatCurrency(totalExpenses, sym)} icon={<TrendingDown className="w-6 h-6" />} color="red" />
        <KPICard title="صافي الربح" value={formatCurrency(netProfit, sym)} icon={<TrendingUp className="w-6 h-6" />} color={netProfit >= 0 ? 'green' : 'red'} />
        <KPICard title="هامش الربح" value={formatPercent(profitMargin)} icon={<Percent className="w-6 h-6" />} color="amber" />
        <KPICard title="مخزون البيض حالياً" value={`${formatNumber(currentEggsStock)} بيضة`} subtitle={`سعر البيع: ${settings?.sellingPrices.egg || 1.5} ${sym}`} icon={<Egg className="w-6 h-6" />} color="purple" />
        <KPICard title="الدجاج البياض" value={formatNumber(activeHens)} subtitle="نشط حالياً" icon={<Bird className="w-6 h-6" />} color="blue" />
        <KPICard title="نسبة الإنتاج" value={formatPercent(avgProductionRate)} icon={<BarChart3 className="w-6 h-6" />} color="green" />
        <KPICard title="نقطة التعادل" value={breakEvenEggs > 0 ? `${formatNumber(breakEvenEggs)} بيضة` : '—'} icon={<Target className="w-6 h-6" />} color="amber" />
      </div>

      {/* Targets vs Actual */}
      <Card className="p-5 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          الأهداف مقابل الأداء الفعلي
        </h3>
        <div className="grid md:grid-cols-2 gap-x-8">
          <ProgressBar label="نسبة إنتاج البيض" value={avgProductionRate} target={settings?.targetRates.production || 75} />
          <ProgressBar label="نسبة الإخصاب" value={latestBatch?.fertilityRate || 0} target={settings?.targetRates.fertility || 85} />
          <ProgressBar label="نسبة التفقيس" value={latestBatch?.hatchRate || 0} target={settings?.targetRates.hatch || 80} />
          <ProgressBar
            label={`نسبة النفوق الفعلية${mortalityDetails ? ` (${mortalityDetails})` : ''} (أقل أفضل)`}
            value={mortalityRate}
            target={settings?.targetRates.maxMortality || 5}
            isLowerBetter
          />
        </div>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Revenue vs Expenses */}
        <Card className="p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4">المداخيل والمصاريف الشهرية</h3>
          <div style={{ width: '100%', height: 300 }} className="flex items-center justify-center">
            {mounted ? (
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0, sym)} />
                  <Legend />
                  <Bar dataKey="revenue" name="المداخيل" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="المصاريف" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="الربح" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-sm text-slate-400">جاري تحميل الرسم البياني...</span>
            )}
          </div>
        </Card>

        {/* Production Trend */}
        <Card className="p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4">تطور نسبة إنتاج البيض اليومي</h3>
          <div style={{ width: '100%', height: 300 }} className="flex items-center justify-center">
            {mounted ? (
              <ResponsiveContainer>
                <LineChart data={productionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" name="نسبة الإنتاج" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-sm text-slate-400">جاري تحميل الرسم البياني...</span>
            )}
          </div>
        </Card>

        {/* Expense Categories Pie (Right in RTL) */}
        <Card className="p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4">توزيع المصاريف حسب الفئة</h3>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div style={{ width: 220, height: 220 }} className="flex items-center justify-center shrink-0">
              {mounted ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={expenseCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={90} paddingAngle={2}>
                      {expenseCategories.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0, sym)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-sm text-slate-400">جاري التحميل...</span>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              {expenseCategories.length === 0 ? (
                <span className="text-sm text-slate-400">لا توجد مصاريف في هذه الفترة</span>
              ) : (
                expenseCategories.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-slate-600">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{formatCurrency(cat.value, sym)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Debt Distribution Pie (Left in RTL — الديون التي عليّ فقط) */}
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-bold text-slate-800">توزيع الديون التي عليّ حسب الفئة</h3>
            <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold">
              الإجمالي المتبقي: {formatCurrency(totalPayableRemaining, sym)}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div style={{ width: 220, height: 220 }} className="flex items-center justify-center shrink-0">
              {mounted ? (
                debtCategories.length > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={debtCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={90} paddingAngle={2}>
                        {debtCategories.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0, sym)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-sm text-emerald-600 font-bold">لا توجد ديون ✓</span>
                )
              ) : (
                <span className="text-sm text-slate-400">جاري التحميل...</span>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              {debtCategories.length === 0 ? (
                <span className="text-sm text-slate-400">لا توجد ديون مسجلة في هذه الفترة</span>
              ) : (
                debtCategories.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[(i + 3) % CHART_COLORS.length] }} />
                      <span className="text-slate-600">{cat.name}</span>
                    </div>
                    <span className="font-bold text-red-700">{formatCurrency(cat.value, sym)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Egg Collection Modal */}
      <Modal isOpen={showEggModal} onClose={() => setShowEggModal(false)} title="تسجيل جمع البيض" size="md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
            <input type="date" value={eggForm.date} onChange={e => setEggForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عدد الدجاج</label>
            <input type="number" value={eggForm.activeHenCount} onChange={e => setEggForm(p => ({ ...p, activeHenCount: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">النفوق</label>
            <input type="number" value={eggForm.dailyMortality} onChange={e => setEggForm(p => ({ ...p, dailyMortality: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">إجمالي البيض</label>
            <input type="number" value={eggForm.totalEggsCollected} onChange={e => setEggForm(p => ({ ...p, totalEggsCollected: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">مكسور/تالف</label>
            <input type="number" value={eggForm.brokenEggs} onChange={e => setEggForm(p => ({ ...p, brokenEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">للفقاسة</label>
            <input type="number" value={eggForm.incubatorEggs} onChange={e => setEggForm(p => ({ ...p, incubatorEggs: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">استهلاك شخصي</label>
            <input type="number" value={eggForm.personalUse} onChange={e => setEggForm(p => ({ ...p, personalUse: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="flex items-end">
            <div className="bg-blue-50 px-3 py-2 rounded-lg w-full text-center">
              <span className="text-sm text-blue-700 font-bold">
                صافي البيع: {Math.max(0, eggForm.totalEggsCollected - eggForm.brokenEggs - eggForm.incubatorEggs - eggForm.personalUse)}
              </span>
            </div>
          </div>
        </div>
        <button onClick={saveEggCollection} className="mt-5 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
          حفظ
        </button>
      </Modal>

      {/* Quick Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="إضافة مصروف سريع" size="md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
            <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الفئة</label>
            <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value as typeof expenseForm.category }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
              <option value="feed">أعلاف</option>
              <option value="medicine">أدوية</option>
              <option value="electricity">كهرباء</option>
              <option value="water">ماء</option>
              <option value="heating">تدفئة</option>
              <option value="vaccination">تحصينات</option>
              <option value="bedding">فرشة</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
            <input type="text" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="مثال: كيس علف 50 كغ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
            <input type="number" value={expenseForm.quantity} onChange={e => setExpenseForm(p => ({ ...p, quantity: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">سعر الوحدة</label>
            <input type="number" step="0.1" value={expenseForm.unitPrice} onChange={e => setExpenseForm(p => ({ ...p, unitPrice: +e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="col-span-2 bg-red-50 px-3 py-2 rounded-lg text-center">
            <span className="text-sm text-red-700 font-bold">المجموع: {formatCurrency(expenseForm.quantity * expenseForm.unitPrice, sym)}</span>
          </div>
        </div>
        <button onClick={saveExpense} className="mt-5 w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition">
          حفظ المصروف
        </button>
      </Modal>
    </AppShell>
  );
}
