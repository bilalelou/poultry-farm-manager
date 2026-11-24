'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { seedDatabase } from '@/lib/seed';
import {
  LayoutDashboard,
  Egg,
  TrendingUp,
  CalendarDays,
  Wallet,
  Target,
  Settings,
  Users,
  Briefcase,
  Menu,
  X,
  ChevronLeft,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { href: '/flock', label: 'القطيع العام', icon: Users },
  { href: '/investors', label: 'المستثمرون وقيمة المشروع', icon: Briefcase },
  { href: '/incubator', label: 'الفقاسة', icon: Egg },
  { href: '/rearing', label: 'التربية', icon: TrendingUp },
  { href: '/production', label: 'الإنتاج والمبيعات', icon: CalendarDays },
  { href: '/expenses', label: 'المصاريف', icon: Wallet },
  { href: '/expansion', label: 'خطة التوسع', icon: Target },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // التأكد من ملء البيانات الأولية تلقائياً في أي متصفح جديد
    seedDatabase(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-800 text-white">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🐔</span>
            <span>دجاجتي</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">إدارة مزرعة الدواجن</p>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
                {isActive && <ChevronLeft className="w-4 h-4 mr-auto" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          الإصدار 1.0.0
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute right-0 top-0 bottom-0 w-72 bg-slate-800 text-white shadow-2xl">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">🐔</span>
                <span>دجاجتي</span>
              </h1>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="py-4">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold text-slate-800">
              {NAV_ITEMS.find(i => pathname === i.href || pathname?.startsWith(i.href + '/'))?.label || 'لوحة القيادة'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-slate-100">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
