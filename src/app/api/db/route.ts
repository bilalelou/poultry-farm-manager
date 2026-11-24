import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
                name: 'ديوك التخصيب الرئيسية',
                category: 'roosters',
                breed: 'بلدي مميز',
                headCount: 2,
                malesCount: 2,
                femalesCount: 0,
                ageWeeks: 32,
                housing: 'عنبر 1 - قسم الذكور',
                healthStatus: 'ممتازة',
                notes: 'مخصصة لتخصيب البيض لدفعة الفقاسة',
              },
            ],
          });
          items = await prisma.flockGroup.findMany({ orderBy: { createdAt: 'desc' } });
        }
        return NextResponse.json(items);
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
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
        const item = await prisma.dailyProduction.create({ data: body });
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
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  const id = Number(searchParams.get('id'));
  const body = await request.json();

  try {
    switch (resource) {
      case 'settings': {
        const updated = await prisma.settings.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      case 'incubatorBatches': {
        const updated = await prisma.incubatorBatch.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      case 'rearingBatches': {
        const updated = await prisma.rearingBatch.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      case 'dailyProduction': {
        const updated = await prisma.dailyProduction.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      case 'sales': {
        const updated = await prisma.sale.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      case 'expenses': {
        const updated = await prisma.expense.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      case 'flockGroups': {
        const updated = await prisma.flockGroup.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  const id = Number(searchParams.get('id'));

  try {
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
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
