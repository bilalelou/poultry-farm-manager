// ============================================================
// عميل قاعدة البيانات المتوافق بالكامل مع واجهات Dexie والمتصل بـ PostgreSQL
// ============================================================

import type {
  Settings,
  IncubatorBatch,
  RearingBatch,
  RearingWeeklyLog,
  DailyProduction,
  Sale,
  Expense,
  FlockGroup,
  Investor,
  ValuationItem,
} from './types';
import { db as localDexieDb } from './db-local';

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

function createTableHandler<T extends { id?: number }>(resource: string, localTable: any) {
  return {
    toArray: async (): Promise<T[]> => {
      try {
        return await fetchApi<T[]>(resource);
      } catch (e) {
        return await localTable.toArray();
      }
    },
    get: async (id: number): Promise<T | undefined> => {
      try {
        const all = await fetchApi<T[]>(resource);
        return all.find((item: any) => item.id === id);
      } catch (e) {
        return await localTable.get(id);
      }
    },
    add: async (data: any): Promise<any> => {
      try {
        const created = await fetchApi<T>(resource, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return (created as any).id;
      } catch (e) {
        return await localTable.add(data);
      }
    },
    bulkAdd: async (dataArr: any[]): Promise<any> => {
      for (const item of dataArr) {
        await fetchApi(resource, {
          method: 'POST',
          body: JSON.stringify(item),
        }).catch(() => {});
      }
      return localTable.bulkAdd ? localTable.bulkAdd(dataArr).catch(() => {}) : undefined;
    },
    update: async (id: number | undefined, data: any): Promise<any> => {
      if (id === undefined) return;
      try {
        return await fetchApi(`${resource}&id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (e) {
        return await localTable.update(id, data);
      }
    },
    delete: async (id: number): Promise<any> => {
      try {
        return await fetchApi(`${resource}&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        return await localTable.delete(id);
      }
    },
    clear: async (): Promise<any> => {
      return localTable.clear ? localTable.clear() : Promise.resolve();
    },
    count: async (): Promise<number> => {
      try {
        const all = await fetchApi<T[]>(resource);
        return all.length;
      } catch (e) {
        return await localTable.count();
      }
    },
    orderBy: (key: string) => ({
      reverse: () => ({
        toArray: async (): Promise<T[]> => {
          try {
            const all = await fetchApi<T[]>(resource);
            return all.sort((a: any, b: any) => (b[key] > a[key] ? 1 : -1));
          } catch (e) {
            return await localTable.orderBy(key).reverse().toArray();
          }
        },
      }),
      toArray: async (): Promise<T[]> => {
        try {
          const all = await fetchApi<T[]>(resource);
          return all.sort((a: any, b: any) => (a[key] > b[key] ? 1 : -1));
        } catch (e) {
          return await localTable.orderBy(key).toArray();
        }
      },
    }),
    where: (key: string) => ({
      equals: (val: any) => ({
        sortBy: async (sortKey: string): Promise<T[]> => {
          try {
            return await fetchApi<T[]>(`${resource}&${key}=${val}`);
          } catch (e) {
            return await localTable.where(key).equals(val).sortBy(sortKey);
          }
        },
        delete: async (): Promise<any> => {
          try {
            return await localTable.where(key).equals(val).delete();
          } catch (e) {}
        },
      }),
    }),
    toCollection: () => ({
      first: async (): Promise<T | undefined> => {
        try {
          const res = await fetchApi<any>(resource);
          return Array.isArray(res) ? res[0] : res;
        } catch (e) {
          return await localTable.toCollection().first();
        }
      },
    }),
  };
}

export const db = {
  settings: createTableHandler<Settings>('settings', localDexieDb.settings),
  incubatorBatches: createTableHandler<IncubatorBatch>('incubatorBatches', localDexieDb.incubatorBatches),
  rearingBatches: createTableHandler<RearingBatch>('rearingBatches', localDexieDb.rearingBatches),
  rearingWeeklyLogs: createTableHandler<RearingWeeklyLog>('rearingWeeklyLogs', localDexieDb.rearingWeeklyLogs),
  dailyProduction: createTableHandler<DailyProduction>('dailyProduction', localDexieDb.dailyProduction),
  sales: createTableHandler<Sale>('sales', localDexieDb.sales),
  expenses: createTableHandler<Expense>('expenses', localDexieDb.expenses),
  flockGroups: createTableHandler<FlockGroup>('flockGroups', {
    toArray: async () => [],
    get: async () => undefined,
    add: async () => 1,
    update: async () => {},
    delete: async () => {},
    clear: async () => {},
    count: async () => 0,
  }),
  investors: createTableHandler<Investor>('investors', {
    toArray: async () => [],
    get: async () => undefined,
    add: async () => 1,
    update: async () => {},
    delete: async () => {},
    clear: async () => {},
    count: async () => 0,
  }),
  valuationItems: createTableHandler<ValuationItem>('valuationItems', {
    toArray: async () => [],
    get: async () => undefined,
    add: async () => 1,
    update: async () => {},
    delete: async () => {},
    clear: async () => {},
    count: async () => 0,
  }),
  expansionPlans: localDexieDb.expansionPlans,
  expansionPlanMonths: localDexieDb.expansionPlanMonths,
  alerts: localDexieDb.alerts,
};

export const DEFAULT_SETTINGS: Settings = {
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

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.toCollection().first();
  if (s) return s;
  return DEFAULT_SETTINGS;
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const settings = await getSettings();
  if (settings.id) {
    await db.settings.update(settings.id, updates);
  }
}
