'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { Settings, ExpansionPlan, ExpansionStrategy } from '@/lib/types';
import {
  generateStrategicExpansionPlan,
  estimateMonthlyProfitPerHen,
  type FarmBaseline,
  type CalculatedMonthRow,
  type ExpansionSummary,
  type PendingRearingBatch,
  type ActiveIncubatorBatch,
} from '@/lib/expansion-calculator';
import { formatCurrency, formatNumber, todayISO, cn } from '@/lib/utils';
import {
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Save,
  Sparkles,
  Trash2,
  Egg,
  Bird,
  Warehouse,
  Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

export default function ExpansionPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [baseline, setBaseline] = useState<FarmBaseline | null>(null);
  const [savedPlans, setSavedPlans] = useState<ExpansionPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<number | null>(null);

  // Plan parameters
  const [planName, setPlanName] = useState('خطة الوصول إلى 5,000 د.م صافي ربح شهري (خلال سنة)');
  const [targetMonthlyProfit, setTargetMonthlyProfit] = useState<number>(5000);
  const [duration, setDuration] = useState<number>(12);
  const [strategy, setStrategy] = useState<ExpansionStrategy>('incubator');
  const [fillIncubatorFull, setFillIncubatorFull] = useState<boolean>(false);
  const [monthlyPulletsAdd, setMonthlyPulletsAdd] = useState<number>(25);

  // Active plan rows & calculated summary
  const [summary, setSummary] = useState<ExpansionSummary | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [s, flocks, prods, rears, incs, vals, plans] = await Promise.all([
        getSettings(),
        db.flockGroups.toArray(),
        db.dailyProduction.toArray(),
        db.rearingBatches.toArray(),
        db.incubatorBatches.toArray(),
        db.valuationItems.toArray(),
        db.expansionPlans.toArray(),
      ]);

      setSettings(s);

      // بناء خط الأساس الحي من بيانات المزرعة الفعلية في PostgreSQL
      const sortedProds = [...prods].sort((a, b) => (b.date > a.date ? 1 : -1));
      const layerGroups = flocks.filter(f => f.category === 'layers');
      const roosterGroups = flocks.filter(f => f.category === 'roosters');

      const currentLayingHens =
        layerGroups.length > 0
          ? layerGroups.reduce((sum, f) => sum + (f.femalesCount || 0), 0)
          : sortedProds[0]?.activeHenCount ?? 10;
      const currentRoosters =
        roosterGroups.length > 0 || layerGroups.length > 0
          ? roosterGroups.reduce((sum, f) => sum + (f.malesCount || 0), 0) +
            layerGroups.reduce((sum, f) => sum + (f.malesCount || 0), 0)
          : 5;

      const activeRearing = rears.filter(r => r.status === 'rearing');
      const pendingPulletsHens = activeRearing.reduce((sum, r) => {
        const healthy = r.currentHealthyCount ?? Math.max(0, r.initialChickCount - (r.mortalityCount || 0));
        return sum + Math.max(0, healthy - (r.malesCount || 0));
      }, 0);
      const pendingPulletsMales = activeRearing.reduce((sum, r) => sum + (r.malesCount || 0), 0);

      const incubatingEggsCount = incs
        .filter(b => b.status === 'incubating')
        .reduce((sum, b) => sum + b.eggCount, 0);

      let detectedCap = s.incubatorCapacity || 605;
      const incAsset = vals.find(v => v.category === 'equipment' && v.name.includes('فقاسة'));
      if (incAsset) {
        const match = incAsset.name.match(/(\d+)/);
        if (match && Number(match[1]) > detectedCap) detectedCap = Number(match[1]);
      }

      // بناء بيانات التوقيت والأعمار الحقيقية لدفعات التربية والفقاسة
      const rearingBatchesData: PendingRearingBatch[] = activeRearing.map(r => {
        const healthy = r.currentHealthyCount ?? Math.max(0, r.initialChickCount - (r.mortalityCount || 0));
        return {
          batchCode: r.batchCode || `R-${r.id}`,
          startDate: r.startDate,
          currentAgeWeeks: r.currentAgeWeeks ?? undefined,
          femalesCount: Math.max(0, healthy - (r.malesCount || 0)),
          malesCount: r.malesCount || 0,
        };
      });

      const incubatorBatchesData: ActiveIncubatorBatch[] = incs
        .filter(b => b.status === 'incubating')
        .map(b => ({
          batchCode: b.batchCode || `INC-${b.id}`,
          startDate: b.startDate,
          eggCount: b.eggCount,
          fertilizedCount: b.fertilizedCount ?? undefined,
        }));

      const farmBase: FarmBaseline = {
        settings: s,
        currentLayingHens,
        currentRoosters,
        pendingPulletsHens,
        pendingPulletsMales,
        incubatingEggsCount,
        incubatorCapacity: detectedCap,
        rearingBatches: rearingBatchesData,
        incubatorBatches: incubatorBatchesData,
        today: new Date().toISOString().split('T')[0],
      };
      setBaseline(farmBase);
      setSavedPlans(plans);

      // عرض الخطة المحفوظة تلقائياً أو حساب خطة الـ 5,000 د.م مباشرة
      if (plans.length > 0 && plans[0].months && plans[0].months.length > 0) {
        selectSavedPlan(plans[0], farmBase);
      } else {
        const computed = generateStrategicExpansionPlan(farmBase, {
          targetMonthlyProfit: 5000,
          durationMonths: 12,
          strategy: 'incubator',
        });
        setSummary(computed);
      }
    } catch (err) {
      console.error('Error loading expansion data:', err);
    } finally {
      setLoading(false);
    }
  }

  function selectSavedPlan(plan: ExpansionPlan, farmBase?: FarmBaseline) {
    const base = farmBase || baseline;
    setActivePlanId(plan.id || null);
    setPlanName(plan.name);
    setDuration(plan.durationMonths || 12);
    const tgt = plan.targetMonthlyProfit || 5000;
    const strat = (plan.strategy || 'incubator') as ExpansionStrategy;
    setTargetMonthlyProfit(tgt);
    setStrategy(strat);
    const hasFullBatch = (plan.months || []).some(m => (m.incubatorEggsUsed || 0) >= (base?.incubatorCapacity || 605));
    setFillIncubatorFull(hasFullBatch || strat === 'pullets_100_full_inc');

    if (plan.months && plan.months.length > 0 && base) {
      const rows: CalculatedMonthRow[] = plan.months.map(m => ({
        month: m.month,
        addedHens: m.addedHens,
        incubatorEggsUsed: m.incubatorEggsUsed || 0,
        source: m.source,
        estimatedMortality: m.estimatedMortality,
        netActiveHens: m.netActiveHens,
        requiredSpaceM2: m.requiredSpaceM2,
        monthlyFeedKg: m.monthlyFeedKg,
        feedCost: m.feedCost,
        rearingCost: m.rearingCost || 0,
        expectedEggProduction: m.expectedEggProduction,
        eggsSold: Math.max(0, m.expectedEggProduction - Math.min(m.incubatorEggsUsed || 0, Math.floor(m.expectedEggProduction / 3))),
        eggSalesRevenue: Math.max(0, m.expectedRevenue - (m.maleSalesRevenue || 0)),
        externalEggCost: 0,
        maleSalesRevenue: m.maleSalesRevenue || 0,
        expectedRevenue: m.expectedRevenue,
        operationalCost: m.operationalCost,
        expectedProfit: m.expectedProfit,
        cumulativeProfit: m.cumulativeProfit,
        selfFinancingGap: m.selfFinancingGap,
        roostersCount: Math.max(base.currentRoosters, Math.ceil(m.netActiveHens / 12)),
        milestoneNote: m.milestoneNote || '',
      }));

      let minCumCash = 0;
      let breakEvenMonth: number | null = null;
      let targetReachedMonth: number | null = null;
      for (const r of rows) {
        if (r.cumulativeProfit < minCumCash) minCumCash = r.cumulativeProfit;
        if (breakEvenMonth === null && r.month > 1 && minCumCash < 0 && r.cumulativeProfit > 0) breakEvenMonth = r.month;
        if (targetReachedMonth === null && r.expectedProfit >= tgt) targetReachedMonth = r.month;
      }

      const profitPerHen = estimateMonthlyProfitPerHen(base.settings);
      const last = rows[rows.length - 1];
      setSummary({
        months: rows,
        targetHensNeeded: Math.ceil((tgt * 1.05) / Math.max(5, profitPerHen)),
        netProfitPerHenMonth: Math.round(profitPerHen * 10) / 10,
        finalActiveHens: last?.netActiveHens || 0,
        finalMonthlyProfit: last?.expectedProfit || 0,
        totalCumulativeProfit: last?.cumulativeProfit || 0,
        maxWorkingCapitalGap: Math.round(Math.abs(minCumCash)),
        breakEvenMonth,
        targetReachedMonth,
        totalIncubatorEggsUsed: rows.reduce((s, r) => s + (r.incubatorEggsUsed || 0), 0),
        totalMalesSoldRevenue: rows.reduce((s, r) => s + (r.maleSalesRevenue || 0), 0),
      });
    }
  }

  function recalculateSmartPlan(
    customStrategy?: ExpansionStrategy,
    customTarget?: number,
    customDuration?: number,
    customFillFull?: boolean,
    customPulletsPerMonth?: number
  ) {
    if (!baseline) return;
    const tgt = customTarget ?? targetMonthlyProfit;
    const dur = customDuration ?? duration;
    const strat = customStrategy ?? strategy;
    const fillFull = customFillFull ?? fillIncubatorFull;
    const pulletsPerMo = customPulletsPerMonth ?? monthlyPulletsAdd;

    const computed = generateStrategicExpansionPlan(baseline, {
      targetMonthlyProfit: tgt,
      durationMonths: dur,
      strategy: strat,
      fillIncubatorFull: fillFull,
      monthlyPulletsAdd: pulletsPerMo,
      pulletTargetHens: 100,
    });
    setSummary(computed);
    setActivePlanId(null);
    if (strat === 'pullets_100_full_inc') {
      setPlanName(
        fillFull
          ? `خطة 100 دجاجة (+${pulletsPerMo} عتوكة/شهر) + ملء الفقاسة ${baseline.incubatorCapacity} بيضة`
          : `خطة الوصول لـ 100 دجاجة (+${pulletsPerMo} عتوكة/شهر) لتخفيف العبء المالي`
      );
    } else if (strat === 'incubator') {
      setPlanName(
        fillFull
          ? `خطة ملء الفقاسة بالكامل (${baseline.incubatorCapacity} بيضة) لهدف ${formatNumber(tgt)} د.م`
          : `خطة الوصول إلى ${formatNumber(tgt)} د.م شهرياً عبر الفقاسة (${dur} شهراً)`
      );
    } else if (strat === 'hybrid') {
      setPlanName(`خطة هجينة (فقاسة + عتوكة) لهدف ${formatNumber(tgt)} د.م شهرياً (${dur} شهراً)`);
    } else {
      setPlanName(`خطة سريعة (شراء عتوكة) لهدف ${formatNumber(tgt)} د.م شهرياً (${dur} شهراً)`);
    }
  }

  function updateManualRow(index: number, field: 'addedHens' | 'source', value: number | string) {
    if (!summary || !baseline || !settings) return;
    const rows = summary.months.map(r => ({ ...r }));
    if (field === 'addedHens') rows[index].addedHens = Math.max(0, Number(value) || 0);
    if (field === 'source') rows[index].source = value as 'incubator' | 'purchased';

    // إعادة حساب التراكمي للقطيع والأرباح انطلاقاً من القطيع الحالي
    let activeHens = baseline.currentLayingHens;
    let cumProfit = 0;
    let minCumCash = 0;
    let breakEvenMonth: number | null = null;
    let targetReachedMonth: number | null = null;

    const prodRate = (settings.targetRates.production || 75) / 100;
    const eggPrice = settings.sellingPrices.egg || 2.0;
    const layerFeedG = settings.dailyFeedConsumption.layer || 110;
    const layerFeedPrice = settings.feedPrices.layer || 5.0;
    const density = settings.housingDensity || 6;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const mortality = i === 0 ? 0 : Math.round(activeHens * 0.005);
      activeHens = Math.max(0, activeHens - mortality + r.addedHens);

      const expectedEggProduction = Math.round(activeHens * 30 * prodRate);
      const eggsToInc = r.incubatorEggsUsed || 0;
      const internalDiverted = Math.min(eggsToInc, Math.floor(expectedEggProduction / 3));
      const eggsSold = Math.max(0, expectedEggProduction - internalDiverted);
      const eggSalesRevenue = Math.round(eggsSold * eggPrice);
      const expectedRevenue = eggSalesRevenue + (r.maleSalesRevenue || 0);

      const roostersCount = Math.max(baseline.currentRoosters, Math.ceil(activeHens / 12));
      const monthlyFeedKg = Math.round(((activeHens + roostersCount) * layerFeedG * 30 / 1000) * 10) / 10;
      const feedCost = Math.round(monthlyFeedKg * layerFeedPrice);
      const operationalCost = Math.round(feedCost + activeHens * 2 + (r.rearingCost || 0));
      const expectedProfit = Math.round(expectedRevenue - operationalCost);
      cumProfit += expectedProfit;

      if (cumProfit < minCumCash) minCumCash = cumProfit;
      if (breakEvenMonth === null && r.month > 1 && minCumCash < 0 && cumProfit > 0) breakEvenMonth = r.month;
      if (targetReachedMonth === null && expectedProfit >= targetMonthlyProfit) targetReachedMonth = r.month;

      rows[i] = {
        ...r,
        estimatedMortality: mortality,
        netActiveHens: activeHens,
        requiredSpaceM2: Math.ceil((activeHens + roostersCount) / density),
        monthlyFeedKg,
        feedCost,
        expectedEggProduction,
        eggsSold,
        eggSalesRevenue,
        expectedRevenue,
        operationalCost,
        expectedProfit,
        cumulativeProfit: Math.round(cumProfit),
        selfFinancingGap: expectedProfit < 0 ? Math.abs(expectedProfit) : 0,
        roostersCount,
      };
    }

    const last = rows[rows.length - 1];
    setSummary({
      ...summary,
      months: rows,
      finalActiveHens: last?.netActiveHens || 0,
      finalMonthlyProfit: last?.expectedProfit || 0,
      totalCumulativeProfit: Math.round(cumProfit),
      maxWorkingCapitalGap: Math.round(Math.abs(minCumCash)),
      breakEvenMonth,
      targetReachedMonth,
    });
  }

  async function savePlanToPostgres() {
    if (!summary || !baseline) return;
    setSaving(true);
    try {
      const payload = {
        name: planName.trim() || 'خطة التوسع المخصصة',
        durationMonths: duration,
        targetMonthlyProfit,
        strategy,
        description: `خطة مبنية على ${baseline.currentLayingHens} دجاجة بياضة + ${baseline.currentRoosters} ديوك + ${baseline.pendingPulletsHens + baseline.pendingPulletsMales} عتوكة + ${baseline.incubatingEggsCount} بيضة في الفقاسة (سعة ${baseline.incubatorCapacity}) (الهدف: ${targetMonthlyProfit} د.م/شهر)`,
        startDate: todayISO(),
        months: summary.months.map(m => ({
          month: m.month,
          addedHens: m.addedHens,
          incubatorEggsUsed: m.incubatorEggsUsed || 0,
          source: m.source,
          estimatedMortality: m.estimatedMortality,
          netActiveHens: m.netActiveHens,
          requiredSpaceM2: m.requiredSpaceM2,
          monthlyFeedKg: m.monthlyFeedKg,
          feedCost: m.feedCost,
          rearingCost: m.rearingCost || 0,
          expectedEggProduction: m.expectedEggProduction,
          maleSalesRevenue: m.maleSalesRevenue || 0,
          expectedRevenue: m.expectedRevenue,
          operationalCost: m.operationalCost,
          expectedProfit: m.expectedProfit,
          cumulativeProfit: m.cumulativeProfit,
          selfFinancingGap: m.selfFinancingGap,
          milestoneNote: m.milestoneNote || '',
        })),
      };

      let savedId = activePlanId;
      if (activePlanId) {
        await db.expansionPlans.update(activePlanId, payload);
      } else {
        savedId = await db.expansionPlans.add(payload);
      }

      const refreshed = await db.expansionPlans.toArray();
      setSavedPlans(refreshed);
      if (savedId) setActivePlanId(savedId);
      setSaveNotice('✅ تم حفظ خطة التوسع في قاعدة بيانات PostgreSQL بنجاح');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err) {
      console.error('Failed to save expansion plan:', err);
      setSaveNotice('❌ حدث خطأ أثناء حفظ الخطة');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeletePlan() {
    if (!deletePlanId) return;
    await db.expansionPlans.delete(deletePlanId);
    setDeletePlanId(null);
    const refreshed = await db.expansionPlans.toArray();
    setSavedPlans(refreshed);
    if (refreshed.length > 0) {
      selectSavedPlan(refreshed[0]);
    } else if (baseline) {
      recalculateSmartPlan();
    }
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const months = summary?.months || [];
  const chartData = months.map(m => ({
    month: `شهر ${m.month}`,
    hens: m.netActiveHens,
    revenue: Math.round(m.expectedRevenue),
    costs: Math.round(m.operationalCost),
    monthlyProfit: Math.round(m.expectedProfit),
    cumulativeProfit: Math.round(m.cumulativeProfit),
  }));

  const targetMet = (summary?.finalMonthlyProfit || 0) >= targetMonthlyProfit;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Target className="w-7 h-7 text-blue-600" />
            خطة التوسع الاستراتيجية للوصول للربح المستهدف
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            محاكاة حقيقية مبنية على قطيعك الحالي، الفقاسة، أسعار البيض والعلف المسجلة في المزرعة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={savePlanToPostgres}
            disabled={saving || !summary}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ...' : activePlanId ? 'حفظ التعديلات' : 'حفظ الخطة في قاعدة البيانات'}
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm">
          {saveNotice}
        </div>
      )}

      {/* Live Farm Baseline Card */}
      {baseline && settings && (
        <Card className="p-5 mb-6 bg-gradient-to-l from-blue-50 via-white to-slate-50 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              المعطيات الحالية المقروءة تلقائياً من مزرعتك:
            </h3>
            <Badge color="blue">سعة الفقاسة: {baseline.incubatorCapacity} بيضة</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">القطيع الحالي النشط</p>
              <p className="text-lg font-black text-pink-700">{baseline.currentLayingHens} دجاجة</p>
              <p className="text-[11px] text-blue-700 font-bold mt-0.5">+ {baseline.currentRoosters} ديوك</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">عتوكة تدخل (1-2 شهر)</p>
              <p className="text-lg font-black text-amber-600">{baseline.pendingPulletsHens + baseline.pendingPulletsMales} طير</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{baseline.pendingPulletsHens} أنثى + {baseline.pendingPulletsMales} ذكور</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">بيض بالفقاسة حالياً</p>
              <p className="text-lg font-black text-blue-700">{baseline.incubatingEggsCount} بيضة</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {baseline.incubatorBatches?.[0]
                  ? `منذ ${Math.max(1, Math.floor((new Date(baseline.today).getTime() - new Date(baseline.incubatorBatches[0].startDate).getTime()) / 86400000) + 1)} أيام`
                  : 'سعة ' + baseline.incubatorCapacity}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">البيض / بيع الذكور</p>
              <p className="text-lg font-black text-emerald-700">{settings.sellingPrices.egg} {sym}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">الديك (3-4 ش): {settings.sellingPrices.maleBroiler} {sym}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">تكلفة علف البياض</p>
              <p className="text-lg font-black text-slate-800">{settings.feedPrices.layer} {sym}/كغ</p>
              <p className="text-[11px] text-slate-500 mt-0.5">نسبة الإخصاب: {settings.targetRates.fertility}%</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <p className="text-xs text-emerald-700 font-bold">ربح الدجاجة الشهري</p>
              <p className="text-lg font-black text-emerald-800">~{summary?.netProfitPerHenMonth || 25} {sym}</p>
              <p className="text-[11px] text-emerald-700 font-medium mt-0.5">مبيعات الذكور: {formatCurrency(summary?.totalMalesSoldRevenue || 0, sym)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Saved Plans Selector (if any) */}
      {savedPlans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs font-bold text-slate-500">الخطط المحفوظة:</span>
          {savedPlans.map(p => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition cursor-pointer',
                activePlanId === p.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
              onClick={() => selectSavedPlan(p)}
            >
              <span>{p.name}</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setDeletePlanId(p.id!);
                }}
                className={cn(
                  'p-0.5 rounded hover:bg-red-500 hover:text-white transition',
                  activePlanId === p.id ? 'text-blue-100' : 'text-slate-400'
                )}
                title="حذف الخطة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Plan Setup & Goal Controls */}
      <Card className="p-5 mb-6">
        <h3 className="font-bold text-slate-800 mb-4">⚙️ إعداد وتعديل هدف التوسع</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">اسم الخطة</label>
            <input
              type="text"
              value={planName}
              onChange={e => setPlanName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-700 mb-1">🎯 صافي الربح الشهري المستهدف ({sym})</label>
            <input
              type="number"
              step="500"
              min="500"
              value={targetMonthlyProfit}
              onChange={e => {
                const v = Math.max(500, +e.target.value || 5000);
                setTargetMonthlyProfit(v);
              }}
              className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-black text-emerald-800 bg-emerald-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">المدة</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDuration(12);
                  recalculateSmartPlan(strategy, targetMonthlyProfit, 12);
                }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-bold transition',
                  duration === 12 ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-600'
                )}
              >
                سنة (12 شهر)
              </button>
              <button
                onClick={() => {
                  setDuration(24);
                  recalculateSmartPlan(strategy, targetMonthlyProfit, 24);
                }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-bold transition',
                  duration === 24 ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-600'
                )}
              >
                سنتان
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">استراتيجية التوسع</label>
            <select
              value={strategy}
              onChange={e => {
                const st = e.target.value as ExpansionStrategy;
                const nextFill = st === 'pullets_100_full_inc' ? true : fillIncubatorFull;
                setStrategy(st);
                if (st === 'pullets_100_full_inc') setFillIncubatorFull(true);
                recalculateSmartPlan(st, targetMonthlyProfit, duration, nextFill, monthlyPulletsAdd);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium"
            >
              <option value="pullets_100_full_inc">100 دجاجة (+25-30 عتوكة/شهر) + ملء الفقاسة 605</option>
              <option value="incubator">تفقيس ذاتي (من بيض المزرعة)</option>
              <option value="hybrid">هجين (فقاسة + شراء عتوكة)</option>
              <option value="purchased">شراء عتوكة جاهزة (سريع)</option>
            </select>
          </div>
        </div>

        {/* خيارات التخصيص: ملء الفقاسة 605 + عدد العتوكة الشهري */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fillIncubatorFull}
              onChange={e => {
                const checked = e.target.checked;
                setFillIncubatorFull(checked);
                recalculateSmartPlan(strategy, targetMonthlyProfit, duration, checked, monthlyPulletsAdd);
              }}
              disabled={strategy === 'purchased'}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span className="text-sm font-bold text-slate-800">
              🥚 خيار ملء الفقاسة بالكامل ({baseline?.incubatorCapacity || 605} بيضة في الدورة)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              (يستخدم بيض المزرعة + شراء خارجي إذا لزم لتفادي تشغيل الفقاسة شبه فارغة)
            </span>
          </label>

          {strategy === 'pullets_100_full_inc' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-800">🐔 العتوكة الشهرية (حتى 100 دجاجة):</span>
              {[25, 28, 30].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setMonthlyPulletsAdd(n);
                    recalculateSmartPlan(strategy, targetMonthlyProfit, duration, fillIncubatorFull, n);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition',
                    monthlyPulletsAdd === n
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-50'
                  )}
                >
                  {n}/شهر
                </button>
              ))}
              <input
                type="number"
                min={10}
                max={50}
                value={monthlyPulletsAdd}
                onChange={e => {
                  const v = Math.max(10, Math.min(50, +e.target.value || 25));
                  setMonthlyPulletsAdd(v);
                  recalculateSmartPlan(strategy, targetMonthlyProfit, duration, fillIncubatorFull, v);
                }}
                className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-xs font-bold text-center bg-white"
              />
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            لتحقيق صافي ربح شهري قدره <strong>{formatCurrency(targetMonthlyProfit, sym)}</strong> بسعر البيضة{' '}
            <strong>{settings?.sellingPrices.egg} {sym}</strong>، تحتاج تقريباً إلى{' '}
            <strong className="text-blue-700">{summary?.targetHensNeeded || 209} دجاجة بياضة نشطة</strong>.
          </p>
          <button
            onClick={() => recalculateSmartPlan()}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            توليد وحساب الخطة الآن
          </button>
        </div>
      </Card>

      {summary && months.length > 0 && (
        <>
          {/* Goal & Cashflow Status Banner */}
          <Card
            className={cn(
              'p-5 mb-6 border-2',
              targetMet ? 'border-emerald-300 bg-emerald-50/70' : 'border-amber-300 bg-amber-50/70'
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {targetMet ? (
                  <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={cn('font-black text-lg', targetMet ? 'text-emerald-900' : 'text-amber-900')}>
                    {targetMet
                      ? `✓ الهدف محقق! تصل لصافي ربح ${formatCurrency(summary.finalMonthlyProfit, sym)} / شهر بحلول الشهر ${summary.targetReachedMonth || duration}`
                      : `الربح المتوقع في الشهر ${duration}: ${formatCurrency(summary.finalMonthlyProfit, sym)} / شهر`}
                  </h3>
                  <p className="text-sm text-slate-700 mt-1">
                    {summary.maxWorkingCapitalGap > 0
                      ? `تحتاج خلال الأشهر الأولى للتأسيس والنمو إلى سيولة مؤقتة (رأس مال دوار) تبلغ أقصاها ${formatCurrency(summary.maxWorkingCapitalGap, sym)}${summary.breakEvenMonth ? `، وتُسترد بالكامل في الشهر ${summary.breakEvenMonth} لتبدأ الأرباح الصافية` : ''}.`
                      : 'التدفق النقدي إيجابي وذاتي التمويل بالكامل طوال مدة الخطة!'}
                  </p>
                </div>
              </div>
              <div className="text-left md:text-right shrink-0 bg-white px-4 py-2.5 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">صافي الربح التراكمي ({duration} شهراً)</p>
                <p className="text-2xl font-black text-emerald-700">{formatCurrency(summary.totalCumulativeProfit, sym)}</p>
              </div>
            </div>
          </Card>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">القطيع البياض بنهاية الخطة</span>
                <Bird className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-700">{formatNumber(summary.finalActiveHens)} <span className="text-xs font-normal">دجاجة</span></p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">الربح الشهري في الشهر {duration}</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700">{formatCurrency(summary.finalMonthlyProfit, sym)}</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">البيض المطلوب للتفقيس</span>
                <Egg className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-700">{formatNumber(summary.totalIncubatorEggsUsed)} <span className="text-xs font-normal">بيضة</span></p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">المساحة المطلوبة للعنبر</span>
                <Warehouse className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-purple-700">{months[months.length - 1]?.requiredSpaceM2 || 0} <span className="text-xs font-normal">م²</span></p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">أقصى سيولة مؤقتة للعلف</span>
                <Wallet className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-2xl font-black text-slate-800">{formatCurrency(summary.maxWorkingCapitalGap, sym)}</p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-800 mb-3">نمو القطيع البياض وصافي الربح الشهري مقابل الهدف</h3>
              <div style={{ width: '100%', height: 270 }} className="flex items-center justify-center">
                {mounted ? (
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any, name: any) => name === 'القطيع البياض' ? `${v} دجاجة` : formatCurrency(Number(v) || 0, sym)} />
                      <Legend />
                      <ReferenceLine yAxisId="left" y={targetMonthlyProfit} stroke="#10b981" strokeDasharray="4 4" label="الهدف 5000" />
                      <Line yAxisId="left" type="monotone" dataKey="monthlyProfit" name="صافي الربح الشهري" stroke="#10b981" strokeWidth={3} />
                      <Line yAxisId="right" type="monotone" dataKey="hens" name="القطيع البياض" stroke="#2563eb" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-sm text-slate-400">جاري تحميل الرسم البياني...</span>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-800 mb-3">المداخيل مقابل التكاليف التشغيلية والتربية</h3>
              <div style={{ width: '100%', height: 270 }} className="flex items-center justify-center">
                {mounted ? (
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0, sym)} />
                      <Legend />
                      <Bar dataKey="revenue" name="المداخيل (بيض + ديوك)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="costs" name="التكاليف (علف بياض + تربية)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-sm text-slate-400">جاري تحميل الرسم البياني...</span>
                )}
              </div>
            </Card>
          </div>

          {/* Monthly Roadmap Table */}
          <Card className="overflow-x-auto mb-6">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800">📋 خارطة الطريق الشهرية التفصيلية ({duration} شهراً)</h3>
                <p className="text-xs text-slate-500">تشمل دخول دفعاتك الحالية، مواعيد التفقيس، مبيعات الديوك، وتكاليف التربية الشهرية</p>
              </div>
              <Badge color="green">بيع الذكور محسوب بسعر {settings?.sellingPrices.maleBroiler || 30} {sym}</Badge>
            </div>
            <table className="data-table text-xs md:text-sm">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>دخول للإنتاج</th>
                  <th>تفقيس (بيضة)</th>
                  <th>القطيع البياض</th>
                  <th>المساحة</th>
                  <th>العلف (بياض)</th>
                  <th>ت. التربية</th>
                  <th>البيض المنتج</th>
                  <th>بيع الذكور</th>
                  <th>إجمالي الدخل</th>
                  <th>صافي الشهر</th>
                  <th>التراكمي</th>
                  <th>أهم الأحداث والمراحل</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr
                    key={m.month}
                    className={cn(
                      m.expectedProfit >= targetMonthlyProfit ? 'bg-emerald-50/70' : m.expectedProfit < 0 ? 'bg-red-50/30' : ''
                    )}
                  >
                    <td className="font-bold whitespace-nowrap">شهر {m.month}</td>
                    <td>
                      <input
                        type="number"
                        value={m.addedHens}
                        onChange={e => updateManualRow(i, 'addedHens', +e.target.value)}
                        className="w-14 px-1.5 py-1 border border-slate-300 rounded text-center font-bold"
                      />
                    </td>
                    <td className="font-bold text-blue-700">
                      {m.incubatorEggsUsed && m.incubatorEggsUsed > 0 ? `${m.incubatorEggsUsed} 🥚` : '—'}
                    </td>
                    <td className="font-black text-blue-800">{m.netActiveHens}</td>
                    <td className="whitespace-nowrap">{m.requiredSpaceM2} م²</td>
                    <td className="whitespace-nowrap">{m.monthlyFeedKg.toFixed(0)} كغ</td>
                    <td className="text-amber-700 whitespace-nowrap">
                      {m.rearingCost && m.rearingCost > 0 ? formatCurrency(m.rearingCost, sym) : '—'}
                    </td>
                    <td>{formatNumber(m.expectedEggProduction)}</td>
                    <td className="text-emerald-700 font-medium whitespace-nowrap">
                      {m.maleSalesRevenue && m.maleSalesRevenue > 0 ? formatCurrency(m.maleSalesRevenue, sym) : '—'}
                    </td>
                    <td className="text-emerald-700 font-bold whitespace-nowrap">{formatCurrency(m.expectedRevenue, sym)}</td>
                    <td
                      className={cn(
                        'font-black whitespace-nowrap',
                        m.expectedProfit >= targetMonthlyProfit
                          ? 'text-emerald-700'
                          : m.expectedProfit >= 0
                          ? 'text-slate-700'
                          : 'text-red-600'
                      )}
                    >
                      {formatCurrency(m.expectedProfit, sym)}
                    </td>
                    <td
                      className={cn(
                        'font-bold whitespace-nowrap',
                        m.cumulativeProfit >= 0 ? 'text-blue-700' : 'text-red-600'
                      )}
                    >
                      {formatCurrency(m.cumulativeProfit, sym)}
                    </td>
                    <td className="text-xs text-slate-600 min-w-[200px]">{m.milestoneNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <ConfirmDialog
        isOpen={deletePlanId !== null}
        onClose={() => setDeletePlanId(null)}
        onConfirm={confirmDeletePlan}
        title="حذف خطة التوسع"
        message="هل أنت متأكد من حذف هذه الخطة المحفوظة من قاعدة البيانات؟"
        confirmLabel="حذف"
        confirmColor="red"
      />
    </AppShell>
  );
}
