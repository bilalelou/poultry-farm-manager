import Dexie, { type EntityTable } from 'dexie';
import type {
  Settings,
  IncubatorBatch,
  RearingBatch,
  RearingWeeklyLog,
  DailyProduction,
  Sale,
  Expense,
  ExpansionPlan,
  ExpansionPlanMonth,
  Alert,
} from './types';

// ============================================================
// قاعدة بيانات IndexedDB باستخدام Dexie.js
// ============================================================

class PoultryFarmDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  incubatorBatches!: EntityTable<IncubatorBatch, 'id'>;
  rearingBatches!: EntityTable<RearingBatch, 'id'>;
  rearingWeeklyLogs!: EntityTable<RearingWeeklyLog, 'id'>;
  dailyProduction!: EntityTable<DailyProduction, 'id'>;
  sales!: EntityTable<Sale, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  expansionPlans!: EntityTable<ExpansionPlan, 'id'>;
  expansionPlanMonths!: EntityTable<ExpansionPlanMonth, 'id'>;
  alerts!: EntityTable<Alert, 'id'>;

  constructor() {
    super('PoultryFarmDB');

    this.version(1).stores({
      settings: '++id',
      incubatorBatches: '++id, batchCode, startDate, status',
      rearingBatches: '++id, batchCode, incubatorBatchId, status',
      rearingWeeklyLogs: '++id, rearingBatchId, weekNumber',
      dailyProduction: '++id, date',
      sales: '++id, date, type',
      expenses: '++id, date, scope, type, category, batchId',
      expansionPlans: '++id, name',
      expansionPlanMonths: '++id, planId, month',
      alerts: '++id, date, type, category, isRead',
    });
  }
}

export const db = new PoultryFarmDB();

// === الإعدادات الافتراضية ===
export const DEFAULT_SETTINGS: Settings = {
  incubatorCapacity: 176,
  feedPrices: {
    starter: 5.5,   // درهم/كغ
    grower: 4.8,
    preLayer: 5.0,
    layer: 4.5,
  },
  dailyFeedConsumption: {
    starter: 25,   // غرام
    grower: 65,
    preLayer: 90,
    layer: 120,
  },
  sellingPrices: {
    egg: 1.2,
    tray: 36,
    fertilizedEgg: 2.5,
    chick: 5,
    culledHen: 35,
    maleBroiler: 25,
    manure: 15,
  },
  marketReadyHenPrice: 80,
  targetRates: {
    fertility: 85,
    hatch: 80,
    production: 75,
    maxMortality: 5,
  },
  housingDensity: 4.5,
  incubatorElectricityCost: 50,
  incubatorCleaningCost: 20,
  currency: 'MAD',
  currencySymbol: 'د.م',
};

// === دوال مساعدة لقاعدة البيانات ===

export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.toCollection().first();
  if (settings) return settings;
  // إنشاء الإعدادات الافتراضية
  const id = await db.settings.add(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, id };
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const settings = await getSettings();
  if (settings.id) {
    await db.settings.update(settings.id, updates);
  }
}

// حساب إجمالي المداخيل
export async function getTotalRevenue(startDate?: string, endDate?: string): Promise<number> {
  let query = db.sales.toCollection();
  const sales = await query.toArray();
  return sales
    .filter(s => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    })
    .reduce((sum, s) => sum + s.total, 0);
}

// حساب إجمالي المصاريف
export async function getTotalExpenses(startDate?: string, endDate?: string, scope?: string): Promise<number> {
  const expenses = await db.expenses.toArray();
  return expenses
    .filter(e => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (scope && e.scope !== scope) return false;
      return true;
    })
    .reduce((sum, e) => sum + e.total, 0);
}
