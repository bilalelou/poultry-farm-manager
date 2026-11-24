'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Card, Badge, EmptyState, LoadingSpinner } from '@/components/ui';
import { db } from '@/lib/db';
import type { RearingBatch, RearingWeeklyLog } from '@/lib/types';
import { REARING_STATUS_LABELS } from '@/lib/types';
import { formatDate, getRearingWeek, getFeedPhase, getFeedPhaseName, cn } from '@/lib/utils';
import { TrendingUp, Bird } from 'lucide-react';

const statusColors = { rearing: 'amber' as const, completed: 'green' as const, transferred: 'blue' as const };

export default function RearingListPage() {
  const [batches, setBatches] = useState<RearingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        const b = await db.rearingBatches.toArray();
        b.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        setBatches(b);
      } catch (err) {
        console.error('Error loading rearing batches:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'all' ? batches : batches.filter(b => b.status === filter);

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">تتبع النمو والتربية</h1>
          <p className="text-sm text-slate-500">{batches.length} دفعة مسجلة</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'rearing', 'completed', 'transferred'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {f === 'all' ? 'الكل' : REARING_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Bird className="w-16 h-16" />} title="لا توجد دفعات تربية" description="يتم إنشاء دفعات التربية تلقائياً عند نقل الكتاكيت من الفقاسة" />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(batch => {
            const week = getRearingWeek(batch.startDate);
            const phase = getFeedPhase(week);
            return (
              <Link key={batch.id} href={`/rearing/${batch.id}`}>
                <Card className="p-5 hover:shadow-md transition-shadow h-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-slate-800">{batch.batchCode}</span>
                    <Badge color={statusColors[batch.status]}>{REARING_STATUS_LABELS[batch.status]}</Badge>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-500">الأسبوع {Math.min(week, 20)} / 20</span>
                      <Badge color={phase === 'starter' ? 'amber' : phase === 'grower' ? 'blue' : 'purple'}>{getFeedPhaseName(phase)}</Badge>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(Math.min(week, 20) / 20) * 100}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><span>📅 تاريخ البدء</span><span className="font-medium">{formatDate(batch.startDate)}</span></div>
                    <div className="flex justify-between"><span>🐥 العدد الابتدائي</span><span className="font-medium">{batch.initialChickCount}</span></div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
