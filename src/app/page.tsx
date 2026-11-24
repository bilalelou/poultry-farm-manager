'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { seedDatabase } from '@/lib/seed';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        await seedDatabase(true);
      } catch (err) {
        console.error('Seed error:', err);
      }
      setLoading(false);
      router.replace('/dashboard');
    }
    init();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-6xl mb-4">🐔</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">دجاجتي</h1>
        <p className="text-slate-500 mb-6">إدارة مزرعة الدواجن</p>
        {loading && (
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        )}
      </div>
    </div>
  );
}
