'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, LoadingSpinner } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type { Settings } from '@/lib/types';
import { formatCurrency, formatNumber, todayISO, cn } from '@/lib/utils';
import { Target, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface MonthPlan {
  month: number;
  addedHens: number;
  source: 'incubator' | 'purchased';
  // Calculated
  estimatedMortality: number;
  netActiveHens: number;
  requiredSpaceM2: number;
  monthlyFeedKg: number;
  feedCost: number;
  expectedEggProduction: number;
  expectedRevenue: number;
  operationalCost: number;
  expectedProfit: number;
  cumulativeProfit: number;
}

export default function ExpansionPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState('خطة التوسع الأولى');
  const [duration, setDuration] = useState(12);
  const [planData, setPlanData] = useState<MonthPlan[]>([]);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => { getSettings().then(s => { setSettings(s); setLoading(false); }); }, []);

  function generatePlan() {
    if (!settings) return;
    const months: MonthPlan[] = [];
    let cumActiveHens = 0;
    let cumProfit = 0;

    for (let m = 1; m <= duration; m++) {
      const plan: MonthPlan = {
        month: m,
        addedHens: 0,
        source: 'purchased',
        estimatedMortality: 0,
        netActiveHens: 0,
        requiredSpaceM2: 0,
        monthlyFeedKg: 0,
        feedCost: 0,
        expectedEggProduction: 0,
        expectedRevenue: 0,
        operationalCost: 0,
        expectedProfit: 0,
        cumulativeProfit: 0,
      };

      // Apply mortality to existing hens
      const mortality = Math.round(cumActiveHens * 0.003); // ~0.3% monthly
      cumActiveHens = Math.max(0, cumActiveHens - mortality);
      plan.estimatedMortality = mortality;
      plan.netActiveHens = cumActiveHens;
      plan.requiredSpaceM2 = Math.ceil(cumActiveHens / settings.housingDensity);
      plan.monthlyFeedKg = (cumActiveHens * settings.dailyFeedConsumption.layer * 30) / 1000;
      plan.feedCost = plan.monthlyFeedKg * settings.feedPrices.layer;
      plan.expectedEggProduction = Math.round(cumActiveHens * 30 * (settings.targetRates.production / 100));
      plan.expectedRevenue = plan.expectedEggProduction * settings.sellingPrices.egg;
      plan.operationalCost = plan.feedCost + (cumActiveHens * 2); // 2 MAD/hen for other costs
      plan.expectedProfit = plan.expectedRevenue - plan.operationalCost;
      cumProfit += plan.expectedProfit;
      plan.cumulativeProfit = cumProfit;

      months.push(plan);
    }

    setPlanData(months);
    setShowPlan(true);
  }

  function updateMonth(monthIndex: number, field: 'addedHens' | 'source', value: number | string) {
    if (!settings) return;
    const updated = [...planData];
    if (field === 'addedHens') updated[monthIndex].addedHens = value as number;
    if (field === 'source') updated[monthIndex].source = value as 'incubator' | 'purchased';

    // Recalculate from this month forward
    let cumActiveHens = 0;
    let cumProfit = 0;

    for (let i = 0; i < updated.length; i++) {
      // Add hens from this month
      const added = updated[i].addedHens;
      if (updated[i].source === 'incubator') {
        // Incubator: 50% female, available after 5 months
        if (i >= 5) {
          const sourceMonth = i - 5;
          // Check if that month had incubator additions
        }
        // For simplicity: add females directly but halved
        cumActiveHens += Math.floor(added * 0.5);
      } else {
        cumActiveHens += added;
      }

      const mortality = Math.round(cumActiveHens * 0.003);
      cumActiveHens = Math.max(0, cumActiveHens - mortality);

      updated[i].estimatedMortality = mortality;
      updated[i].netActiveHens = cumActiveHens;
      updated[i].requiredSpaceM2 = Math.ceil(cumActiveHens / settings.housingDensity);
      updated[i].monthlyFeedKg = (cumActiveHens * settings.dailyFeedConsumption.layer * 30) / 1000;
      updated[i].feedCost = updated[i].monthlyFeedKg * settings.feedPrices.layer;
      updated[i].expectedEggProduction = Math.round(cumActiveHens * 30 * (settings.targetRates.production / 100));
      updated[i].expectedRevenue = updated[i].expectedEggProduction * settings.sellingPrices.egg;
      updated[i].operationalCost = updated[i].feedCost + (cumActiveHens * 2);
      updated[i].expectedProfit = updated[i].expectedRevenue - updated[i].operationalCost;
      cumProfit += updated[i].expectedProfit;
      updated[i].cumulativeProfit = cumProfit;
    }

    setPlanData(updated);
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const sym = settings?.currencySymbol || 'د.م';
  const totalAddedHens = planData.reduce((s, m) => s + m.addedHens, 0);
  const finalHens = planData.length > 0 ? planData[planData.length - 1].netActiveHens : 0;
  const totalProfit = planData.length > 0 ? planData[planData.length - 1].cumulativeProfit : 0;

  // Self-financing: cost of rearing one batch (5 months)
  const rearingCostPerBatch = settings ? (settings.incubatorCapacity * 0.5 * 70) : 5000; // Approximate cost
  const selfFinanced = totalProfit >= rearingCostPerBatch;
  const gap = rearingCostPerBatch - totalProfit;

  // Chart data
  const chartData = planData.map(m => ({
    month: `شهر ${m.month}`,
    hens: m.netActiveHens,
    revenue: Math.round(m.expectedRevenue),
    costs: Math.round(m.operationalCost),
    profit: Math.round(m.cumulativeProfit),
  }));

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Target className="w-6 h-6 text-blue-600" />
        محاكي خطة التوسع
      </h1>

      {/* Plan Setup */}
      <Card className="p-5 mb-6">
        <h3 className="font-bold text-slate-800 mb-4">⚙️ إعداد الخطة</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الخطة</label>
            <input type="text" value={planName} onChange={e => setPlanName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المدة (شهر)</label>
            <div className="flex gap-2">
              <button onClick={() => setDuration(12)} className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition', duration === 12 ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-600')}>12 شهر</button>
              <button onClick={() => setDuration(24)} className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition', duration === 24 ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-600')}>24 شهر</button>
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={generatePlan} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
              إنشاء الخطة
            </button>
          </div>
        </div>
      </Card>

      {showPlan && planData.length > 0 && (
        <>
          {/* Self-Financing Indicator */}
          <Card className={cn('p-5 mb-6 border-2', selfFinanced ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50')}>
            <div className="flex items-center gap-3">
              {selfFinanced ? (
                <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />
              )}
              <div>
                <h3 className={cn('font-bold text-lg', selfFinanced ? 'text-emerald-800' : 'text-red-800')}>
                  {selfFinanced ? 'التمويل الذاتي كافٍ ✓' : 'يحتاج تمويل خارجي'}
                </h3>
                <p className="text-sm text-slate-600">
                  {selfFinanced
                    ? `الأرباح المتراكمة (${formatCurrency(totalProfit, sym)}) تغطي تكلفة تربية الدفعة الجديدة`
                    : `المبلغ المطلوب: ${formatCurrency(Math.max(0, gap), sym)}`
                  }
                </p>
              </div>
            </div>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">الدجاج المضاف</p><p className="text-xl font-bold">{formatNumber(totalAddedHens)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">القطيع النهائي</p><p className="text-xl font-bold text-blue-600">{formatNumber(finalHens)}</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">المساحة المطلوبة</p><p className="text-xl font-bold">{planData[planData.length - 1]?.requiredSpaceM2 || 0} م²</p></Card>
            <Card className="p-4 text-center"><p className="text-xs text-slate-500">الربح التراكمي</p><p className={cn('text-xl font-bold', totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(totalProfit, sym)}</p></Card>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-800 mb-3">نمو حجم القطيع</h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="hens" name="عدد الدجاج" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-800 mb-3">المداخيل مقابل التكاليف</h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v) || 0, sym)} />
                    <Legend />
                    <Bar dataKey="revenue" name="المداخيل" fill="#10b981" />
                    <Bar dataKey="costs" name="التكاليف" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Monthly Planning Table */}
          <Card className="overflow-x-auto mb-6">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">📋 الجدول الشهري (أدخل عدد الدجاج المضاف لكل شهر)</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>دجاج مضاف</th>
                  <th>المصدر</th>
                  <th>النفوق</th>
                  <th>القطيع</th>
                  <th>المساحة</th>
                  <th>العلف</th>
                  <th>البيض</th>
                  <th>المداخيل</th>
                  <th>الربح</th>
                  <th>تراكمي</th>
                </tr>
              </thead>
              <tbody>
                {planData.map((m, i) => (
                  <tr key={m.month}>
                    <td className="font-bold">شهر {m.month}</td>
                    <td>
                      <input type="number" value={m.addedHens} onChange={e => updateMonth(i, 'addedHens', +e.target.value)} className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm" />
                    </td>
                    <td>
                      <select value={m.source} onChange={e => updateMonth(i, 'source', e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs">
                        <option value="purchased">شراء</option>
                        <option value="incubator">فقاسة</option>
                      </select>
                    </td>
                    <td className="text-red-500">{m.estimatedMortality}</td>
                    <td className="font-bold text-blue-600">{m.netActiveHens}</td>
                    <td>{m.requiredSpaceM2} م²</td>
                    <td>{m.monthlyFeedKg.toFixed(0)} كغ</td>
                    <td>{formatNumber(m.expectedEggProduction)}</td>
                    <td className="text-emerald-600">{formatCurrency(m.expectedRevenue, sym)}</td>
                    <td className={cn('font-medium', m.expectedProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(m.expectedProfit, sym)}</td>
                    <td className={cn('font-bold', m.cumulativeProfit >= 0 ? 'text-blue-600' : 'text-red-600')}>{formatCurrency(m.cumulativeProfit, sym)}</td>
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
