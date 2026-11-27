import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStrategicExpansionPlan } from '@/lib/expansion-calculator';
import type { Settings } from '@/lib/types';
import { getDynamicAgeWeeks } from '@/lib/utils';

async function recordServerError(method: string, resource: string | null, err: any) {
  if (resource === 'systemLogs') return;
  try {
    await prisma.systemLog.create({
      data: {
        timestamp: new Date().toISOString(),
        level: 'error',
        source: 'api',
        page: `/api/db?resource=${resource || 'unknown'} (${method})`,
        message: err?.message || 'Unknown server error',
        details: err?.stack ? String(err.stack).slice(0, 3000) : undefined,
        resolved: false,
      },
    });
  } catch {
    // Ignore logging errors so we never mask the original API response
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');

  try {
    switch (resource) {
      case 'settings': {
        let settings = await prisma.settings.findFirst();
        if (!settings) {
          settings = await prisma.settings.create({
            data: {
              incubatorCapacity: 605,
              feedPrices: { starter: 5.5, grower: 5.0, preLayer: 5.0, layer: 5.0 },
              dailyFeedConsumption: { starter: 25, grower: 65, preLayer: 90, layer: 110 },
              sellingPrices: { egg: 2.0, tray: 60, fertilizedEgg: 3.5, chick: 7.0, culledHen: 40, maleBroiler: 30, manure: 15 },
              marketReadyHenPrice: 75,
              targetRates: { fertility: 85, hatch: 80, production: 75, maxMortality: 5 },
              housingDensity: 6,
              incubatorElectricityCost: 60,
              incubatorCleaningCost: 20,
              currency: 'MAD',
              currencySymbol: 'د.م',
            },
          });
        }
        return NextResponse.json(settings);
      }
      case 'incubatorBatches': {
        const items = await prisma.incubatorBatch.findMany({ orderBy: { startDate: 'desc' } });
        return NextResponse.json(items);
      }
      case 'rearingBatches': {
        const items = await prisma.rearingBatch.findMany({
          include: { weeklyLogs: true },
          orderBy: { startDate: 'desc' },
        });
        return NextResponse.json(items);
      }
      case 'rearingWeeklyLogs': {
        const batchId = searchParams.get('rearingBatchId');
        const items = await prisma.rearingWeeklyLog.findMany({
          where: batchId ? { rearingBatchId: Number(batchId) } : undefined,
          orderBy: { weekNumber: 'asc' },
        });
        return NextResponse.json(items);
      }
      case 'dailyProduction': {
        const items = await prisma.dailyProduction.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'sales': {
        const items = await prisma.sale.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'expenses': {
        const items = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'flockGroups': {
        let items = await prisma.flockGroup.findMany({ orderBy: { createdAt: 'desc' } });
        // إذا كان فارغاً أول مرة، نملؤه بالمجموعات الحقيقية للمزرعة
        if (items.length === 0) {
          await prisma.flockGroup.createMany({
            data: [
              {
                name: 'القطيع البياض النشط',
                category: 'layers',
                breed: 'دجاج بلدي أصيل',
                headCount: 10,
                malesCount: 0,
                femalesCount: 10,
                ageWeeks: 28,
                housing: 'عنبر 1 - البياضات',
                healthStatus: 'ممتازة',
                notes: '10 دجاجات بياضة منتجة حالياً لمعدل 7-8 بيضات يومياً',
              },
              {
                name: 'عتوكة الاستبدال (قيد التجهيز)',
                category: 'pullets',
                breed: 'بلدي خليط',
                headCount: 22,
                malesCount: 2,
                femalesCount: 20,
                ageWeeks: 5,
                housing: 'عنبر 2 - العتوكة',
                healthStatus: 'ممتازة',
                notes: 'دفعة ATK-2611 (20 إناث بياضة و 2 ديوك)',
              },
              {
                name: 'ديوك المزرعة (فروج)',
                category: 'roosters',
                breed: 'بلدي مميز',
                headCount: 5,
                malesCount: 5,
                femalesCount: 0,
                ageWeeks: 32,
                housing: 'عنبر 1 - قسم الذكور',
                healthStatus: 'ممتازة',
                notes: '5 ديوك/فروج مخصصة للتخصيب والتلقيح',
              },
            ],
          });
          items = await prisma.flockGroup.findMany({ orderBy: { createdAt: 'desc' } });
        }
        return NextResponse.json(items);
      }
      case 'investors': {
        const items = await prisma.investor.findMany({ orderBy: { createdAt: 'desc' } });
        return NextResponse.json(items);
      }
      case 'valuationItems': {
        let items = await prisma.valuationItem.findMany({ orderBy: { id: 'asc' } });
        if (items.length === 0) {
          // بذر الأصول التقديرية الحالية لمزرعتك
          await prisma.valuationItem.createMany({
            data: [
              {
                category: 'equipment',
                name: 'فقاسة بيض أوتوماتيكية سعة 605+ بيضة',
                quantity: 1,
                unitValue: 4100,
                totalValue: 4100,
                notes: 'شراء جديد كامل التجهيز والتحكم الرقمي',
              },
              {
                category: 'livestock',
                name: 'قطيع دجاج بياض منتج (10 دجاجات)',
                quantity: 10,
                unitValue: 80,
                totalValue: 800,
                notes: 'دجاج بلدي كامل الإنتاجية في قمة العطاء',
              },
              {
                category: 'livestock',
                name: 'قطيع عتوكة قيد التجهيز (22 حبة)',
                quantity: 22,
                unitValue: 45,
                totalValue: 990,
                notes: 'دفعة ATK-2611 (20 إناث + 2 ديوك)',
              },
              {
                category: 'livestock',
                name: 'ديوك تخصيب وفروج (5 رؤوس)',
                quantity: 5,
                unitValue: 60,
                totalValue: 300,
                notes: 'سلالة بلدية مميزة للتخصيب',
              },
              {
                category: 'equipment',
                name: 'سقايات ومعالف وشبكات تدفئة وإضاءة',
                quantity: 1,
                unitValue: 650,
                totalValue: 650,
                notes: 'تجهيزات العنابر والحظائر',
              },
              {
                category: 'cash',
                name: 'مخزون بيض مخصب قيد التحضين بالفقاسة (71 بيضة)',
                quantity: 71,
                unitValue: 3.5,
                totalValue: 248.5,
                notes: 'دفعة F2611-01 (63 شراء خارجي بسعر 3.5 د.م + 8 من المزرعة)',
              },
            ],
          });
          items = await prisma.valuationItem.findMany({ orderBy: { id: 'asc' } });
        }
        return NextResponse.json(items);
      }
      case 'expansionPlans': {
        let items = await prisma.expansionPlan.findMany({
          include: { months: { orderBy: { month: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        });
        if (items.length === 0) {
          // توليد خطة الهدف (5,000 د.م صافي ربح شهري بعد سنة) تلقائياً من معطيات المزرعة الفعلية
          const [settingsRow, flocks, prods, rears, incs, vals] = await Promise.all([
            prisma.settings.findFirst(),
            prisma.flockGroup.findMany(),
            prisma.dailyProduction.findMany({ orderBy: { date: 'desc' }, take: 1 }),
            prisma.rearingBatch.findMany({ where: { status: 'rearing' } }),
            prisma.incubatorBatch.findMany({ where: { status: 'incubating' } }),
            prisma.valuationItem.findMany(),
          ]);
          const settings = (settingsRow as unknown as Settings) || {
            incubatorCapacity: 605,
            feedPrices: { starter: 5.5, grower: 5.0, preLayer: 5.0, layer: 5.0 },
            dailyFeedConsumption: { starter: 25, grower: 65, preLayer: 90, layer: 110 },
            sellingPrices: { egg: 2.0, tray: 60, fertilizedEgg: 3.5, chick: 7.0, culledHen: 40, maleBroiler: 30, manure: 15 },
            marketReadyHenPrice: 75,
            targetRates: { fertility: 85, hatch: 80, production: 75, maxMortality: 5 },
            housingDensity: 6,
            incubatorElectricityCost: 60,
            incubatorCleaningCost: 20,
            currency: 'MAD',
            currencySymbol: 'د.م',
          };
          const layerGroups = flocks.filter(f => f.category === 'layers');
          const roosterGroups = flocks.filter(f => f.category === 'roosters');
          const currentLayingHens =
            layerGroups.length > 0
              ? layerGroups.reduce((s, f) => s + (f.femalesCount || 0), 0)
              : prods[0]?.activeHenCount ?? 10;
          const currentRoosters =
            roosterGroups.length > 0 || layerGroups.length > 0
              ? roosterGroups.reduce((s, f) => s + (f.malesCount || 0), 0) +
                layerGroups.reduce((s, f) => s + (f.malesCount || 0), 0)
              : 5;
          const pendingPulletsHens = rears.reduce((s, r) => {
            const healthy = r.currentHealthyCount ?? Math.max(0, r.initialChickCount - (r.mortalityCount || 0));
            return s + Math.max(0, healthy - (r.malesCount || 0));
          }, 0);
          const pendingPulletsMales = rears.reduce((s, r) => s + (r.malesCount || 0), 0);
          const incubatingEggsCount = incs.reduce((s, b) => s + b.eggCount, 0);

          // اكتشاف سعة الفقاسة من الأصول إذا كانت مذكورة (مثلاً 605)
          let detectedCap = settings.incubatorCapacity || 605;
          const incAsset = vals.find(v => v.category === 'equipment' && v.name.includes('فقاسة'));
          if (incAsset) {
            const match = incAsset.name.match(/(\d+)/);
            if (match && Number(match[1]) > detectedCap) detectedCap = Number(match[1]);
          }

          const summary = generateStrategicExpansionPlan(
            {
              settings,
              currentLayingHens,
              currentRoosters,
              pendingPulletsHens,
              pendingPulletsMales,
              incubatingEggsCount,
              incubatorCapacity: detectedCap,
              rearingBatches: rears.map(r => {
                const healthy = r.currentHealthyCount ?? Math.max(0, r.initialChickCount - (r.mortalityCount || 0));
                return {
                  batchCode: r.batchCode || `R-${r.id}`,
                  startDate: typeof r.startDate === 'string' ? r.startDate : new Date(r.startDate).toISOString().split('T')[0],
                  currentAgeWeeks: getDynamicAgeWeeks(r.currentAgeWeeks, r.ageReferenceDate || r.createdAt, typeof r.startDate === 'string' ? r.startDate : undefined),
                  femalesCount: Math.max(0, healthy - (r.malesCount || 0)),
                  malesCount: r.malesCount || 0,
                };
              }),
              incubatorBatches: incs.map(b => ({
                batchCode: b.batchCode || `INC-${b.id}`,
                startDate: typeof b.startDate === 'string' ? b.startDate : new Date(b.startDate).toISOString().split('T')[0],
                eggCount: b.eggCount,
                fertilizedCount: b.fertilizedCount ?? undefined,
              })),
              today: new Date().toISOString().split('T')[0],
            },
            { targetMonthlyProfit: 5000, durationMonths: 12, strategy: 'incubator' }
          );

          await prisma.expansionPlan.create({
            data: {
              name: 'خطة الوصول إلى 5,000 د.م صافي ربح شهري (خلال سنة)',
              durationMonths: 12,
              targetMonthlyProfit: 5000,
              strategy: 'incubator',
              description: `خطة مبنية على معطيات المزرعة (${currentLayingHens} دجاجة بياضة + ${currentRoosters} ديوك + ${pendingPulletsHens + pendingPulletsMales} عتوكة ATK-2611 + ${incubatingEggsCount} بيضة في الفقاسة سعة ${detectedCap} بسعر ${settings.sellingPrices.egg} د.م/بيضة)`,
              startDate: new Date().toISOString().split('T')[0],
              months: {
                create: summary.months.map(m => ({
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
              },
            },
          });

          items = await prisma.expansionPlan.findMany({
            include: { months: { orderBy: { month: 'asc' } } },
            orderBy: { createdAt: 'desc' },
          });
        }
        return NextResponse.json(items);
      }
      case 'expansionPlanMonths': {
        const planId = searchParams.get('planId');
        const items = await prisma.expansionPlanMonth.findMany({
          where: planId ? { planId: Number(planId) } : undefined,
          orderBy: { month: 'asc' },
        });
        return NextResponse.json(items);
      }
      case 'cooperativeProfile': {
        let items = await prisma.cooperativeProfile.findMany({ orderBy: { id: 'asc' } });
        if (items.length === 0) {
          const created = await prisma.cooperativeProfile.create({
            data: {
              name: 'تعاونية مراعي الوادي',
              headquarters: 'دوار الخرابشة الأندلس، عين الشقف، مولاي يعقوب، فاس',
              activity: 'تربية الدواجن، تربية المواشي، إنتاج الأعلاف البديلة وتثمينها، وتسويق المنتوجات الفلاحية',
              shareUnitValue: 100,
              legalReserveRate: 10,
              foundedDate: new Date().toISOString().split('T')[0],
            },
          });
          items = [created];
        }
        return NextResponse.json(items);
      }
      case 'cooperativeMembers': {
        const items = await prisma.cooperativeMember.findMany({ orderBy: { createdAt: 'desc' } });
        return NextResponse.json(items);
      }
      case 'cooperativeTransactions': {
        const items = await prisma.cooperativeTransaction.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'cooperativeMeetings': {
        const items = await prisma.cooperativeMeeting.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'customers': {
        const items = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
        return NextResponse.json(items);
      }
      case 'debtPayments': {
        const items = await prisma.debtPayment.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'payableDebts': {
        const items = await prisma.payableDebt.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'payablePayments': {
        const items = await prisma.payablePayment.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      case 'feedMovements': {
        let items = await prisma.feedMovement.findMany({ orderBy: { date: 'desc' } });
        if (items.length === 0) {
          const feedExpenses = await prisma.expense.findMany({ where: { category: 'feed' } });
          if (feedExpenses.length > 0) {
            const initialMovements = feedExpenses.map(e => {
              // تقدير الكمية بالكيلو من الوصف أو السعر (مثلاً كيس 50 كغ بـ 250 د.م)
              const kgMatch = e.description.match(/(\d+(?:\.\d+)?)\s*(?:كغ|kg)/i);
              const qtyKg = kgMatch
                ? e.quantity * Number(kgMatch[1])
                : e.unitPrice >= 100
                  ? e.quantity * 50
                  : e.quantity;
              return {
                date: e.date,
                movementType: 'purchase',
                feedType: e.description.includes('بادي')
                  ? 'starter'
                  : e.description.includes('نامي')
                    ? 'grower'
                    : 'layer',
                quantityKg: qtyKg,
                cost: e.total,
                expenseId: e.id,
                notes: e.description,
              };
            });
            await prisma.feedMovement.createMany({ data: initialMovements });
            items = await prisma.feedMovement.findMany({ orderBy: { date: 'desc' } });
          }
        }
        return NextResponse.json(items);
      }
      case 'systemLogs': {
        const items = await prisma.systemLog.findMany({
          orderBy: { id: 'desc' },
          take: 200,
        });
        return NextResponse.json(items);
      }
      case 'flockMovements': {
        const items = await prisma.flockMovement.findMany({ orderBy: { date: 'desc' } });
        return NextResponse.json(items);
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    await recordServerError('GET', resource, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  const body = await request.json();

  try {
    switch (resource) {
      case 'settings': {
        const existing = await prisma.settings.findFirst();
        if (existing) {
          const updated = await prisma.settings.update({
            where: { id: existing.id },
            data: body,
          });
          return NextResponse.json(updated);
        } else {
          const created = await prisma.settings.create({ data: body });
          return NextResponse.json(created);
        }
      }
      case 'incubatorBatches': {
        const item = await prisma.incubatorBatch.create({ data: body });
        return NextResponse.json(item);
      }
      case 'rearingBatches': {
        const item = await prisma.rearingBatch.create({ data: body });
        return NextResponse.json(item);
      }
      case 'rearingWeeklyLogs': {
        const item = await prisma.rearingWeeklyLog.create({ data: body });
        return NextResponse.json(item);
      }
      case 'dailyProduction': {
        const item = await prisma.dailyProduction.upsert({
          where: { date: body.date },
          update: body,
          create: body,
        });
        return NextResponse.json(item);
      }
      case 'sales': {
        const item = await prisma.sale.create({ data: body });
        return NextResponse.json(item);
      }
      case 'expenses': {
        const item = await prisma.expense.create({ data: body });
        return NextResponse.json(item);
      }
      case 'flockGroups': {
        const item = await prisma.flockGroup.create({ data: body });
        return NextResponse.json(item);
      }
      case 'investors': {
        const item = await prisma.investor.create({ data: body });
        return NextResponse.json(item);
      }
      case 'valuationItems': {
        const item = await prisma.valuationItem.create({ data: body });
        return NextResponse.json(item);
      }
      case 'expansionPlans': {
        const { months, ...planData } = body;
        const item = await prisma.expansionPlan.create({
          data: {
            ...planData,
            months: Array.isArray(months) ? { create: months } : undefined,
          },
          include: { months: { orderBy: { month: 'asc' } } },
        });
        return NextResponse.json(item);
      }
      case 'expansionPlanMonths': {
        const item = await prisma.expansionPlanMonth.create({ data: body });
        return NextResponse.json(item);
      }
      case 'cooperativeProfile': {
        const existing = await prisma.cooperativeProfile.findFirst();
        if (existing) {
          const updated = await prisma.cooperativeProfile.update({ where: { id: existing.id }, data: body });
          return NextResponse.json(updated);
        }
        const created = await prisma.cooperativeProfile.create({ data: body });
        return NextResponse.json(created);
      }
      case 'cooperativeMembers': {
        const item = await prisma.cooperativeMember.create({ data: body });
        return NextResponse.json(item);
      }
      case 'cooperativeTransactions': {
        const item = await prisma.cooperativeTransaction.create({ data: body });
        return NextResponse.json(item);
      }
      case 'cooperativeMeetings': {
        const item = await prisma.cooperativeMeeting.create({ data: body });
        return NextResponse.json(item);
      }
      case 'customers': {
        const item = await prisma.customer.create({ data: body });
        return NextResponse.json(item);
      }
      case 'debtPayments': {
        const item = await prisma.debtPayment.create({ data: body });
        return NextResponse.json(item);
      }
      case 'payableDebts': {
        const item = await prisma.payableDebt.create({ data: body });
        return NextResponse.json(item);
      }
      case 'payablePayments': {
        const item = await prisma.payablePayment.create({ data: body });
        return NextResponse.json(item);
      }
      case 'feedMovements': {
        const item = await prisma.feedMovement.create({ data: body });
        return NextResponse.json(item);
      }
      case 'systemLogs': {
        const item = await prisma.systemLog.create({ data: body });
        return NextResponse.json(item);
      }
      case 'flockMovements': {
        const item = await prisma.flockMovement.create({ data: body });
        return NextResponse.json(item);
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    await recordServerError('POST', resource, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  const id = Number(searchParams.get('id'));
  const body = await request.json();
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...cleanData } = body;

  try {
    switch (resource) {
      case 'settings': {
        const updated = await prisma.settings.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'incubatorBatches': {
        const updated = await prisma.incubatorBatch.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'rearingBatches': {
        const updated = await prisma.rearingBatch.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'dailyProduction': {
        const updated = await prisma.dailyProduction.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'sales': {
        const updated = await prisma.sale.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'expenses': {
        const updated = await prisma.expense.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'flockGroups': {
        const updated = await prisma.flockGroup.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'investors': {
        const updated = await prisma.investor.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'valuationItems': {
        const updated = await prisma.valuationItem.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'expansionPlans': {
        const { months, ...planData } = cleanData;
        if (Array.isArray(months)) {
          await prisma.expansionPlanMonth.deleteMany({ where: { planId: id } });
        }
        const updated = await prisma.expansionPlan.update({
          where: { id },
          data: {
            ...planData,
            months: Array.isArray(months) ? { create: months } : undefined,
          },
          include: { months: { orderBy: { month: 'asc' } } },
        });
        return NextResponse.json(updated);
      }
      case 'cooperativeProfile': {
        const updated = await prisma.cooperativeProfile.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'cooperativeMembers': {
        const updated = await prisma.cooperativeMember.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'cooperativeTransactions': {
        const updated = await prisma.cooperativeTransaction.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'cooperativeMeetings': {
        const updated = await prisma.cooperativeMeeting.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'customers': {
        const updated = await prisma.customer.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'debtPayments': {
        const updated = await prisma.debtPayment.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'payableDebts': {
        const updated = await prisma.payableDebt.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'payablePayments': {
        const updated = await prisma.payablePayment.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'feedMovements': {
        const updated = await prisma.feedMovement.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'systemLogs': {
        const updated = await prisma.systemLog.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      case 'flockMovements': {
        const updated = await prisma.flockMovement.update({ where: { id }, data: cleanData });
        return NextResponse.json(updated);
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    await recordServerError('PUT', resource, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  const clearAll = searchParams.get('clear') === 'true';
  const id = Number(searchParams.get('id'));

  try {
    if (clearAll) {
      switch (resource) {
        case 'settings': await prisma.settings.deleteMany({}); break;
        case 'incubatorBatches': await prisma.incubatorBatch.deleteMany({}); break;
        case 'rearingBatches':
          await prisma.rearingWeeklyLog.deleteMany({});
          await prisma.rearingBatch.deleteMany({});
          break;
        case 'rearingWeeklyLogs': await prisma.rearingWeeklyLog.deleteMany({}); break;
        case 'dailyProduction': await prisma.dailyProduction.deleteMany({}); break;
        case 'sales': await prisma.sale.deleteMany({}); break;
        case 'expenses': await prisma.expense.deleteMany({}); break;
        case 'flockGroups': await prisma.flockGroup.deleteMany({}); break;
        case 'investors': await prisma.investor.deleteMany({}); break;
        case 'valuationItems': await prisma.valuationItem.deleteMany({}); break;
        case 'expansionPlans':
          await prisma.expansionPlanMonth.deleteMany({});
          await prisma.expansionPlan.deleteMany({});
          break;
        case 'expansionPlanMonths': await prisma.expansionPlanMonth.deleteMany({}); break;
        case 'cooperativeProfile': await prisma.cooperativeProfile.deleteMany({}); break;
        case 'cooperativeMembers': await prisma.cooperativeMember.deleteMany({}); break;
        case 'cooperativeTransactions': await prisma.cooperativeTransaction.deleteMany({}); break;
        case 'cooperativeMeetings': await prisma.cooperativeMeeting.deleteMany({}); break;
        case 'customers': await prisma.customer.deleteMany({}); break;
        case 'debtPayments': await prisma.debtPayment.deleteMany({}); break;
        case 'payableDebts':
          await prisma.payablePayment.deleteMany({});
          await prisma.payableDebt.deleteMany({});
          break;
        case 'payablePayments': await prisma.payablePayment.deleteMany({}); break;
        case 'feedMovements': await prisma.feedMovement.deleteMany({}); break;
        case 'systemLogs': await prisma.systemLog.deleteMany({}); break;
        case 'flockMovements': await prisma.flockMovement.deleteMany({}); break;
        default:
          return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
      }
      return NextResponse.json({ success: true, cleared: true });
    }

    switch (resource) {
      case 'incubatorBatches': {
        await prisma.incubatorBatch.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'rearingBatches': {
        await prisma.rearingWeeklyLog.deleteMany({ where: { rearingBatchId: id } });
        await prisma.rearingBatch.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'rearingWeeklyLogs': {
        await prisma.rearingWeeklyLog.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'dailyProduction': {
        await prisma.dailyProduction.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'sales': {
        await prisma.sale.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'expenses': {
        await prisma.expense.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'flockGroups': {
        await prisma.flockGroup.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'investors': {
        await prisma.investor.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'valuationItems': {
        await prisma.valuationItem.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'expansionPlans': {
        await prisma.expansionPlanMonth.deleteMany({ where: { planId: id } });
        await prisma.expansionPlan.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'expansionPlanMonths': {
        await prisma.expansionPlanMonth.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'cooperativeMembers': {
        await prisma.cooperativeMember.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'cooperativeTransactions': {
        await prisma.cooperativeTransaction.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'cooperativeMeetings': {
        await prisma.cooperativeMeeting.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'customers': {
        await prisma.customer.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'debtPayments': {
        await prisma.debtPayment.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'payableDebts': {
        await prisma.payablePayment.deleteMany({ where: { debtId: id } });
        await prisma.payableDebt.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'payablePayments': {
        await prisma.payablePayment.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'feedMovements': {
        await prisma.feedMovement.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'systemLogs': {
        await prisma.systemLog.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      case 'flockMovements': {
        await prisma.flockMovement.delete({ where: { id } });
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    await recordServerError('DELETE', resource, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
