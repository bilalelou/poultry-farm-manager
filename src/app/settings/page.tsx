'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings, updateSettings, DEFAULT_SETTINGS } from '@/lib/db';
import type { Settings } from '@/lib/types';
import { Settings as SettingsIcon, Download, Upload, RotateCcw, Check, RefreshCw } from 'lucide-react';
import { seedDatabase } from '@/lib/seed';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  async function save() {
    const { id, ...rest } = settings;
    await updateSettings(rest);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function resetDefaults() {
    if (settings.id) {
      await db.settings.update(settings.id, DEFAULT_SETTINGS);
      setSettings({ ...DEFAULT_SETTINGS, id: settings.id });
    }
    setShowReset(false);
  }

  async function loadRealData() {
    await seedDatabase(true);
    const s = await getSettings();
    setSettings(s);
    setImportStatus('✅ تم تصفير البيانات وتحميل بيانات مشروعك الحقيقية بنجاح!');
    setTimeout(() => {
      setImportStatus('');
      window.location.href = '/dashboard';
    }, 1500);
  }

  async function exportBackup() {
    const data = {
      settings: await db.settings.toArray(),
      incubatorBatches: await db.incubatorBatches.toArray(),
      rearingBatches: await db.rearingBatches.toArray(),
      rearingWeeklyLogs: await db.rearingWeeklyLogs.toArray(),
      dailyProduction: await db.dailyProduction.toArray(),
      sales: await db.sales.toArray(),
      expenses: await db.expenses.toArray(),
      flockGroups: await db.flockGroups.toArray(),
      investors: await db.investors.toArray(),
      valuationItems: await db.valuationItems.toArray(),
      cooperativeProfile: await db.cooperativeProfile.toArray(),
      cooperativeMembers: await db.cooperativeMembers.toArray(),
      cooperativeTransactions: await db.cooperativeTransactions.toArray(),
      cooperativeMeetings: await db.cooperativeMeetings.toArray(),
      expansionPlans: await db.expansionPlans.toArray(),
      expansionPlanMonths: await db.expansionPlanMonths.toArray(),
      alerts: await db.alerts.toArray(),
      exportDate: new Date().toISOString(),
      version: '1.1.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poultry-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.incubatorBatches) { await db.incubatorBatches.clear(); await db.incubatorBatches.bulkAdd(data.incubatorBatches); }
      if (data.rearingBatches) { await db.rearingBatches.clear(); await db.rearingBatches.bulkAdd(data.rearingBatches); }
      if (data.rearingWeeklyLogs) { await db.rearingWeeklyLogs.clear(); await db.rearingWeeklyLogs.bulkAdd(data.rearingWeeklyLogs); }
      if (data.dailyProduction) { await db.dailyProduction.clear(); await db.dailyProduction.bulkAdd(data.dailyProduction); }
      if (data.sales) { await db.sales.clear(); await db.sales.bulkAdd(data.sales); }
      if (data.expenses) { await db.expenses.clear(); await db.expenses.bulkAdd(data.expenses); }
      if (data.flockGroups) { await db.flockGroups.clear(); await db.flockGroups.bulkAdd(data.flockGroups); }
      if (data.investors) { await db.investors.clear(); await db.investors.bulkAdd(data.investors); }
      if (data.valuationItems) { await db.valuationItems.clear(); await db.valuationItems.bulkAdd(data.valuationItems); }
      if (data.cooperativeMembers) { await db.cooperativeMembers.clear(); await db.cooperativeMembers.bulkAdd(data.cooperativeMembers); }
      if (data.cooperativeTransactions) { await db.cooperativeTransactions.clear(); await db.cooperativeTransactions.bulkAdd(data.cooperativeTransactions); }
      if (data.cooperativeMeetings) { await db.cooperativeMeetings.clear(); await db.cooperativeMeetings.bulkAdd(data.cooperativeMeetings); }
      if (data.settings && data.settings.length > 0) {
        await db.settings.clear();
        await db.settings.bulkAdd(data.settings);
        const s = await getSettings();
        setSettings(s);
      }

      setImportStatus('✅ تم استيراد البيانات بنجاح');
      setTimeout(() => setImportStatus(''), 5000);
    } catch (err) {
      setImportStatus('❌ خطأ في استيراد الملف');
      setTimeout(() => setImportStatus(''), 5000);
    }
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          الإعدادات والفرضيات
        </h1>
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium">
            <Check className="w-4 h-4" />
            تم الحفظ بنجاح
          </div>
        )}
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* الفقاسة */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">🥚 الفقاسة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>سعة الفقاسة (بيضة)</label>
              <input type="number" value={settings.incubatorCapacity} onChange={e => setSettings(p => ({ ...p, incubatorCapacity: +e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>تكلفة الكهرباء / دورة</label>
              <input type="number" value={settings.incubatorElectricityCost} onChange={e => setSettings(p => ({ ...p, incubatorElectricityCost: +e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>تكلفة التنظيف / دورة</label>
              <input type="number" value={settings.incubatorCleaningCost} onChange={e => setSettings(p => ({ ...p, incubatorCleaningCost: +e.target.value }))} className={inputClass} />
            </div>
          </div>
        </Card>

        {/* أسعار الأعلاف */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">🌾 أسعار الأعلاف (درهم/كغ)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>بادي (أسبوع 1-6)</label>
              <input type="number" step="0.1" value={settings.feedPrices.starter} onChange={e => setSettings(p => ({ ...p, feedPrices: { ...p.feedPrices, starter: +e.target.value } }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>نامي (أسبوع 7-18)</label>
              <input type="number" step="0.1" value={settings.feedPrices.grower} onChange={e => setSettings(p => ({ ...p, feedPrices: { ...p.feedPrices, grower: +e.target.value } }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ما قبل البيض (19-20)</label>
              <input type="number" step="0.1" value={settings.feedPrices.preLayer} onChange={e => setSettings(p => ({ ...p, feedPrices: { ...p.feedPrices, preLayer: +e.target.value } }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>بياض</label>
              <input type="number" step="0.1" value={settings.feedPrices.layer} onChange={e => setSettings(p => ({ ...p, feedPrices: { ...p.feedPrices, layer: +e.target.value } }))} className={inputClass} />
            </div>
          </div>
        </Card>

        {/* استهلاك العلف */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">📊 استهلاك العلف اليومي (غرام/دجاجة)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>بادي</label>
              <input type="number" value={settings.dailyFeedConsumption.starter} onChange={e => setSettings(p => ({ ...p, dailyFeedConsumption: { ...p.dailyFeedConsumption, starter: +e.target.value } }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>نامي</label>
              <input type="number" value={settings.dailyFeedConsumption.grower} onChange={e => setSettings(p => ({ ...p, dailyFeedConsumption: { ...p.dailyFeedConsumption, grower: +e.target.value } }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ما قبل البيض</label>
              <input type="number" value={settings.dailyFeedConsumption.preLayer} onChange={e => setSettings(p => ({ ...p, dailyFeedConsumption: { ...p.dailyFeedConsumption, preLayer: +e.target.value } }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>بياض</label>
              <input type="number" value={settings.dailyFeedConsumption.layer} onChange={e => setSettings(p => ({ ...p, dailyFeedConsumption: { ...p.dailyFeedConsumption, layer: +e.target.value } }))} className={inputClass} />
            </div>
          </div>
        </Card>

        {/* أسعار البيع */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">💰 أسعار البيع ({settings.currencySymbol})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={labelClass}>البيضة</label><input type="number" step="0.1" value={settings.sellingPrices.egg} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, egg: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>الصينية (30)</label><input type="number" step="0.1" value={settings.sellingPrices.tray} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, tray: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>بيض مخصب</label><input type="number" step="0.1" value={settings.sellingPrices.fertilizedEgg} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, fertilizedEgg: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>كتكوت</label><input type="number" step="0.1" value={settings.sellingPrices.chick} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, chick: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>دجاجة مستبعدة</label><input type="number" step="0.1" value={settings.sellingPrices.culledHen} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, culledHen: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>ذكر</label><input type="number" step="0.1" value={settings.sellingPrices.maleBroiler} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, maleBroiler: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>سماد (كيس)</label><input type="number" step="0.1" value={settings.sellingPrices.manure} onChange={e => setSettings(p => ({ ...p, sellingPrices: { ...p.sellingPrices, manure: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>سعر السوق (جاهزة)</label><input type="number" step="0.1" value={settings.marketReadyHenPrice} onChange={e => setSettings(p => ({ ...p, marketReadyHenPrice: +e.target.value }))} className={inputClass} /></div>
          </div>
        </Card>

        {/* الأهداف */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">🎯 نسب الأهداف المعيارية (%)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={labelClass}>نسبة الإخصاب</label><input type="number" value={settings.targetRates.fertility} onChange={e => setSettings(p => ({ ...p, targetRates: { ...p.targetRates, fertility: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>نسبة الفقس</label><input type="number" value={settings.targetRates.hatch} onChange={e => setSettings(p => ({ ...p, targetRates: { ...p.targetRates, hatch: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>نسبة الإنتاج</label><input type="number" value={settings.targetRates.production} onChange={e => setSettings(p => ({ ...p, targetRates: { ...p.targetRates, production: +e.target.value } }))} className={inputClass} /></div>
            <div><label className={labelClass}>الحد الأقصى للنفوق</label><input type="number" value={settings.targetRates.maxMortality} onChange={e => setSettings(p => ({ ...p, targetRates: { ...p.targetRates, maxMortality: +e.target.value } }))} className={inputClass} /></div>
          </div>
        </Card>

        {/* التربية والعملة */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">🏠 التربية والعملة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelClass}>كثافة التربية (دجاجة/م²)</label><input type="number" step="0.1" value={settings.housingDensity} onChange={e => setSettings(p => ({ ...p, housingDensity: +e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>العملة</label><input type="text" value={settings.currency} onChange={e => setSettings(p => ({ ...p, currency: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>رمز العملة</label><input type="text" value={settings.currencySymbol} onChange={e => setSettings(p => ({ ...p, currencySymbol: e.target.value }))} className={inputClass} /></div>
          </div>
        </Card>

        {/* Save Button */}
        <button onClick={save} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition text-lg">
          💾 حفظ الإعدادات
        </button>

        {/* Data Management */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4">📦 إدارة البيانات</h3>
          <div className="flex flex-wrap gap-3">
            <button onClick={loadRealData} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
              <RefreshCw className="w-5 h-5" />
              تطبيق بيانات المزرعة الحقيقية
            </button>
            <button onClick={exportBackup} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition">
              <Download className="w-5 h-5" />
              تصدير نسخة احتياطية (JSON)
            </button>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition cursor-pointer">
              <Upload className="w-5 h-5" />
              استيراد نسخة
              <input type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files?.[0]) importBackup(e.target.files[0]); }} />
            </label>
            <button onClick={() => setShowReset(true)} className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition">
              <RotateCcw className="w-5 h-5" />
              إعادة تعيين
            </button>
          </div>
          {importStatus && (
            <p className="mt-3 text-sm font-medium">{importStatus}</p>
          )}
        </Card>
      </div>

      <ConfirmDialog isOpen={showReset} onClose={() => setShowReset(false)} onConfirm={resetDefaults} title="إعادة تعيين الإعدادات" message="سيتم إعادة جميع الإعدادات إلى القيم الافتراضية. هل أنت متأكد؟" confirmLabel="إعادة تعيين" confirmColor="red" />
    </AppShell>
  );
}
