import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALL_TABLES = [
  'Settings',
  'IncubatorBatch',
  'RearingBatch',
  'RearingWeeklyLog',
  'DailyProduction',
  'Sale',
  'Customer',
  'DebtPayment',
  'PayableDebt',
  'PayablePayment',
  'FeedMovement',
  'Expense',
  'ExpansionPlan',
  'ExpansionPlanMonth',
  'Alert',
  'FlockGroup',
  'FlockMovement',
  'Investor',
  'ValuationItem',
  'CooperativeProfile',
  'CooperativeMember',
  'CooperativeTransaction',
  'CooperativeMeeting',
  'SystemLog',
] as const;

function sanitizeDateField(val: unknown): Date | undefined {
  if (!val) return undefined;
  const d = new Date(String(val));
  if (!isNaN(d.getTime())) return d;
  return undefined;
}

function cleanRow(
  row: Record<string, unknown>,
  stripKeys: string[] = []
): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (stripKeys.includes(k)) continue;
    if (k === 'createdAt' || k === 'updatedAt') {
      const dt = sanitizeDateField(v);
      if (dt) copy[k] = dt;
      continue;
    }
    copy[k] = v;
  }
  return copy;
}

export async function GET() {
  try {
    const [
      settings,
      incubatorBatches,
      rearingBatches,
      rearingWeeklyLogs,
      dailyProduction,
      sales,
      customers,
      debtPayments,
      payableDebts,
      payablePayments,
      feedMovements,
      expenses,
      expansionPlans,
      expansionPlanMonths,
      alerts,
      flockGroups,
      flockMovements,
      investors,
      valuationItems,
      cooperativeProfile,
      cooperativeMembers,
      cooperativeTransactions,
      cooperativeMeetings,
      systemLogs,
    ] = await Promise.all([
      prisma.settings.findMany({ orderBy: { id: 'asc' } }),
      prisma.incubatorBatch.findMany({ orderBy: { id: 'asc' } }),
      prisma.rearingBatch.findMany({ orderBy: { id: 'asc' } }),
      prisma.rearingWeeklyLog.findMany({ orderBy: { id: 'asc' } }),
      prisma.dailyProduction.findMany({ orderBy: { id: 'asc' } }),
      prisma.sale.findMany({ orderBy: { id: 'asc' } }),
      prisma.customer.findMany({ orderBy: { id: 'asc' } }),
      prisma.debtPayment.findMany({ orderBy: { id: 'asc' } }),
      prisma.payableDebt.findMany({ orderBy: { id: 'asc' } }),
      prisma.payablePayment.findMany({ orderBy: { id: 'asc' } }),
      prisma.feedMovement.findMany({ orderBy: { id: 'asc' } }),
      prisma.expense.findMany({ orderBy: { id: 'asc' } }),
      prisma.expansionPlan.findMany({ orderBy: { id: 'asc' } }),
      prisma.expansionPlanMonth.findMany({ orderBy: { id: 'asc' } }),
      prisma.alert.findMany({ orderBy: { id: 'asc' } }),
      prisma.flockGroup.findMany({ orderBy: { id: 'asc' } }),
      prisma.flockMovement.findMany({ orderBy: { id: 'asc' } }),
      prisma.investor.findMany({ orderBy: { id: 'asc' } }),
      prisma.valuationItem.findMany({ orderBy: { id: 'asc' } }),
      prisma.cooperativeProfile.findMany({ orderBy: { id: 'asc' } }),
      prisma.cooperativeMember.findMany({ orderBy: { id: 'asc' } }),
      prisma.cooperativeTransaction.findMany({ orderBy: { id: 'asc' } }),
      prisma.cooperativeMeeting.findMany({ orderBy: { id: 'asc' } }),
      prisma.systemLog.findMany({ orderBy: { id: 'asc' } }),
    ]);

    return NextResponse.json({
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      settings,
      incubatorBatches,
      rearingBatches,
      rearingWeeklyLogs,
      dailyProduction,
      sales,
      customers,
      debtPayments,
      payableDebts,
      payablePayments,
      feedMovements,
      expenses,
      expansionPlans,
      expansionPlanMonths,
      alerts,
      flockGroups,
      flockMovements,
      investors,
      valuationItems,
      cooperativeProfile,
      cooperativeMembers,
      cooperativeTransactions,
      cooperativeMeetings,
      systemLogs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'ملف النسخة الاحتياطية غير صالح' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const insertTable = async (
        key: string,
        clearFn: () => Promise<unknown>,
        createFn: (rows: never[]) => Promise<unknown>,
        stripKeys: string[] = []
      ) => {
        if (!Array.isArray(data[key])) return;
        await clearFn();
        const rows = (data[key] as Record<string, unknown>[]).map((r) =>
          cleanRow(r, stripKeys)
        );
        if (rows.length > 0) {
          await createFn(rows as never[]);
        }
      };

      // حذف الجداول التابعة أولاً لتجنب قيود المفاتيح الخارجية
      if (Array.isArray(data.rearingWeeklyLogs) || Array.isArray(data.rearingBatches)) {
        await tx.rearingWeeklyLog.deleteMany({});
      }
      if (Array.isArray(data.expansionPlanMonths) || Array.isArray(data.expansionPlans)) {
        await tx.expansionPlanMonth.deleteMany({});
      }

      await insertTable('settings', () => tx.settings.deleteMany({}), (rows) => tx.settings.createMany({ data: rows }));
      await insertTable('incubatorBatches', () => tx.incubatorBatch.deleteMany({}), (rows) => tx.incubatorBatch.createMany({ data: rows }));
      await insertTable('rearingBatches', () => tx.rearingBatch.deleteMany({}), (rows) => tx.rearingBatch.createMany({ data: rows }), ['weeklyLogs']);
      await insertTable('rearingWeeklyLogs', () => tx.rearingWeeklyLog.deleteMany({}), (rows) => tx.rearingWeeklyLog.createMany({ data: rows }));
      await insertTable('dailyProduction', () => tx.dailyProduction.deleteMany({}), (rows) => tx.dailyProduction.createMany({ data: rows }));
      await insertTable('customers', () => tx.customer.deleteMany({}), (rows) => tx.customer.createMany({ data: rows }));
      await insertTable('sales', () => tx.sale.deleteMany({}), (rows) => tx.sale.createMany({ data: rows }));
      await insertTable('debtPayments', () => tx.debtPayment.deleteMany({}), (rows) => tx.debtPayment.createMany({ data: rows }));
      await insertTable('payableDebts', () => tx.payableDebt.deleteMany({}), (rows) => tx.payableDebt.createMany({ data: rows }));
      await insertTable('payablePayments', () => tx.payablePayment.deleteMany({}), (rows) => tx.payablePayment.createMany({ data: rows }));
      await insertTable('expenses', () => tx.expense.deleteMany({}), (rows) => tx.expense.createMany({ data: rows }));
      await insertTable('feedMovements', () => tx.feedMovement.deleteMany({}), (rows) => tx.feedMovement.createMany({ data: rows }));
      await insertTable('flockGroups', () => tx.flockGroup.deleteMany({}), (rows) => tx.flockGroup.createMany({ data: rows }));
      await insertTable('flockMovements', () => tx.flockMovement.deleteMany({}), (rows) => tx.flockMovement.createMany({ data: rows }));
      await insertTable('investors', () => tx.investor.deleteMany({}), (rows) => tx.investor.createMany({ data: rows }));
      await insertTable('valuationItems', () => tx.valuationItem.deleteMany({}), (rows) => tx.valuationItem.createMany({ data: rows }));
      await insertTable('expansionPlans', () => tx.expansionPlan.deleteMany({}), (rows) => tx.expansionPlan.createMany({ data: rows }), ['months']);
      await insertTable('expansionPlanMonths', () => tx.expansionPlanMonth.deleteMany({}), (rows) => tx.expansionPlanMonth.createMany({ data: rows }));
      await insertTable('alerts', () => tx.alert.deleteMany({}), (rows) => tx.alert.createMany({ data: rows }));
      await insertTable('cooperativeProfile', () => tx.cooperativeProfile.deleteMany({}), (rows) => tx.cooperativeProfile.createMany({ data: rows }));
      await insertTable('cooperativeMembers', () => tx.cooperativeMember.deleteMany({}), (rows) => tx.cooperativeMember.createMany({ data: rows }));
      await insertTable('cooperativeTransactions', () => tx.cooperativeTransaction.deleteMany({}), (rows) => tx.cooperativeTransaction.createMany({ data: rows }));
      await insertTable('cooperativeMeetings', () => tx.cooperativeMeeting.deleteMany({}), (rows) => tx.cooperativeMeeting.createMany({ data: rows }));
      await insertTable('systemLogs', () => tx.systemLog.deleteMany({}), (rows) => tx.systemLog.createMany({ data: rows }));

      // مزامنة تسلسل الأرقام التلقائية (SERIAL sequences) في PostgreSQL بعد استيراد المعرّفات
      for (const table of ALL_TABLES) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false);`
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import error';
    try {
      await prisma.systemLog.create({
        data: {
          timestamp: new Date().toISOString(),
          level: 'error',
          source: 'api',
          page: '/api/backup (POST)',
          message,
          details: err instanceof Error ? err.stack?.slice(0, 3000) : undefined,
        },
      });
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
