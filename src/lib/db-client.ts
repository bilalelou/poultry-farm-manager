// ============================================================
// عميل قاعدة البيانات الموحد (يربط تلقائياً بالسيرفر PostgreSQL مع دعم Dexie كنسخة احتياطية)
// ============================================================

import type {
  Settings,
  IncubatorBatch,
  RearingBatch,
  RearingWeeklyLog,
  DailyProduction,
  Sale,
  Expense,
} from './types';
import { db as localDexieDb } from './db-local';

// Helper for API calls
async function fetchApi<T>(resource: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/db?resource=${resource}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.statusText}`);
  }
  return res.json();
}

export const db = {
  // === Settings ===
  settings: {
    first: async () => {
      try {
        return await fetchApi<Settings>('settings');
      } catch (e) {
        return await localDexieDb.settings.toCollection().first();
      }
    },
    update: async (id: number, data: Partial<Settings>) => {
      try {
        return await fetchApi<Settings>(`settings&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.settings.update(id, data);
      }
    },
    toArray: async () => {
      const s = await db.settings.first();
      return s ? [s] : [];
    },
    toCollection: () => ({
      first: db.settings.first,
    }),
  },

  // === Incubator Batches ===
  incubatorBatches: {
    toArray: async () => {
      try {
        return await fetchApi<IncubatorBatch[]>('incubatorBatches');
      } catch (e) {
        return await localDexieDb.incubatorBatches.toArray();
      }
    },
    get: async (id: number) => {
      const all = await db.incubatorBatches.toArray();
      return all.find(b => b.id === id);
    },
    add: async (data: Omit<IncubatorBatch, 'id'>) => {
      try {
        return await fetchApi<IncubatorBatch>('incubatorBatches', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.incubatorBatches.add(data as any);
      }
    },
    update: async (id: number, data: Partial<IncubatorBatch>) => {
      try {
        return await fetchApi<IncubatorBatch>(`incubatorBatches&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.incubatorBatches.update(id, data);
      }
    },
    delete: async (id: number) => {
      try {
        return await fetchApi(`incubatorBatches&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localDexieDb.incubatorBatches.delete(id);
      }
    },
    count: async () => {
      const all = await db.incubatorBatches.toArray();
      return all.length;
    },
    clear: async () => localDexieDb.incubatorBatches.clear(),
  },

  // === Rearing Batches ===
  rearingBatches: {
    toArray: async () => {
      try {
        return await fetchApi<RearingBatch[]>('rearingBatches');
      } catch (e) {
        return await localDexieDb.rearingBatches.toArray();
      }
    },
    get: async (id: number) => {
      const all = await db.rearingBatches.toArray();
      return all.find(b => b.id === id);
    },
    add: async (data: Omit<RearingBatch, 'id'>) => {
      try {
        return await fetchApi<RearingBatch>('rearingBatches', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.rearingBatches.add(data as any);
      }
    },
    update: async (id: number, data: Partial<RearingBatch>) => {
      try {
        return await fetchApi<RearingBatch>(`rearingBatches&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.rearingBatches.update(id, data);
      }
    },
    delete: async (id: number) => {
      try {
        return await fetchApi(`rearingBatches&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localDexieDb.rearingBatches.delete(id);
      }
    },
    count: async () => {
      const all = await db.rearingBatches.toArray();
      return all.length;
    },
    clear: async () => localDexieDb.rearingBatches.clear(),
  },

  // === Weekly Logs ===
  rearingWeeklyLogs: {
    toArray: async () => {
      try {
        return await fetchApi<RearingWeeklyLog[]>('rearingWeeklyLogs');
      } catch (e) {
        return await localDexieDb.rearingWeeklyLogs.toArray();
      }
    },
    where: (key: string) => ({
      equals: (val: any) => ({
        sortBy: async (sortKey: string) => {
          try {
            return await fetchApi<RearingWeeklyLog[]>(`rearingWeeklyLogs&${key}=${val}`);
          } catch (e) {
            return await localDexieDb.rearingWeeklyLogs.where(key as any).equals(val).sortBy(sortKey as any);
          }
        },
        delete: async () => {
          // cascade handled in PostgreSQL
          try {
            return await localDexieDb.rearingWeeklyLogs.where(key as any).equals(val).delete();
          } catch (e) {}
        },
      }),
    }),
    add: async (data: any) => {
      try {
        return await fetchApi('rearingWeeklyLogs', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.rearingWeeklyLogs.add(data);
      }
    },
    delete: async (id: number) => {
      try {
        return await fetchApi(`rearingWeeklyLogs&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localDexieDb.rearingWeeklyLogs.delete(id);
      }
    },
    clear: async () => localDexieDb.rearingWeeklyLogs.clear(),
  },

  // === Daily Production ===
  dailyProduction: {
    toArray: async () => {
      try {
        return await fetchApi<DailyProduction[]>('dailyProduction');
      } catch (e) {
        return await localDexieDb.dailyProduction.toArray();
      }
    },
    add: async (data: any) => {
      try {
        return await fetchApi('dailyProduction', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.dailyProduction.add(data);
      }
    },
    update: async (id: number, data: any) => {
      try {
        return await fetchApi(`dailyProduction&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.dailyProduction.update(id, data);
      }
    },
    delete: async (id: number) => {
      try {
        return await fetchApi(`dailyProduction&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localDexieDb.dailyProduction.delete(id);
      }
    },
    clear: async () => localDexieDb.dailyProduction.clear(),
  },

  // === Sales ===
  sales: {
    toArray: async () => {
      try {
        return await fetchApi<Sale[]>('sales');
      } catch (e) {
        return await localDexieDb.sales.toArray();
      }
    },
    add: async (data: any) => {
      try {
        return await fetchApi('sales', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.sales.add(data);
      }
    },
    update: async (id: number, data: any) => {
      try {
        return await fetchApi(`sales&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.sales.update(id, data);
      }
    },
    delete: async (id: number) => {
      try {
        return await fetchApi(`sales&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localDexieDb.sales.delete(id);
      }
    },
    clear: async () => localDexieDb.sales.clear(),
  },

  // === Expenses ===
  expenses: {
    toArray: async () => {
      try {
        return await fetchApi<Expense[]>('expenses');
      } catch (e) {
        return await localDexieDb.expenses.toArray();
      }
    },
    add: async (data: any) => {
      try {
        return await fetchApi('expenses', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.expenses.add(data);
      }
    },
    update: async (id: number, data: any) => {
      try {
        return await fetchApi(`expenses&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localDexieDb.expenses.update(id, data);
      }
    },
    delete: async (id: number) => {
      try {
        return await fetchApi(`expenses&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localDexieDb.expenses.delete(id);
      }
    },
    clear: async () => localDexieDb.expenses.clear(),
  },

  // Fallbacks for plans and alerts
  expansionPlans: localDexieDb.expansionPlans,
  expansionPlanMonths: localDexieDb.expansionPlanMonths,
  alerts: localDexieDb.alerts,
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.first();
  if (s) return s;
  return {
    incubatorCapacity: 100,
    feedPrices: { starter: 5.5, grower: 5.0, preLayer: 5.0, layer: 5.0 },
    dailyFeedConsumption: { starter: 25, grower: 65, preLayer: 90, layer: 110 },
    sellingPrices: { egg: 1.5, tray: 45, fertilizedEgg: 3.5, chick: 7.0, culledHen: 40, maleBroiler: 30, manure: 15 },
    marketReadyHenPrice: 75,
    targetRates: { fertility: 85, hatch: 80, production: 75, maxMortality: 5 },
    housingDensity: 6,
    incubatorElectricityCost: 60,
    incubatorCleaningCost: 20,
    currency: 'MAD',
    currencySymbol: 'د.م',
  };
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const settings = await getSettings();
  if (settings.id) {
    await db.settings.update(settings.id, updates);
  }
}
