'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { seedDatabase } from '@/lib/seed';
import { computeFarmAlerts, type SmartAlert } from '@/lib/alerts-engine';
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
  Building2,
  Menu,
  X,
  ChevronLeft,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { href: '/flock', label: 'القطيع العام', icon: Users },
  { href: '/cooperative', label: 'تسيير التعاونية', icon: Building2 },
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
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const alertMenuRef = useRef<HTMLDivElement>(null);

  async function refreshAlerts() {
    setLoadingAlerts(true);
    try {
      const list = await computeFarmAlerts();
      setAlerts(list);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  }

  useEffect(() => {
    // التأكد من ملء البيانات الأولية تلقائياً في أي متصفح جديد
    seedDatabase(false);
    try {
      const saved = JSON.parse(localStorage.getItem('dismissed_farm_alerts') || '[]');
      if (Array.isArray(saved)) setDismissedIds(saved);
    } catch {}
    refreshAlerts();
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (alertMenuRef.current && !alertMenuRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    }
    if (alertsOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [alertsOpen]);

  function dismissAlert(id: string) {
    const next = [...new Set([...dismissedIds, id])];
    setDismissedIds(next);
    try {
      localStorage.setItem('dismissed_farm_alerts', JSON.stringify(next));
    } catch {}
  }

  function clearDismissed() {
    setDismissedIds([]);
    try {
      localStorage.removeItem('dismissed_farm_alerts');
    } catch {}
  }

  const visibleAlerts = alerts.filter(a => !dismissedIds.includes(a.id));

  return (
    <div className="flex h-screen overflow-hidden" suppressHydrationWarning>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-800 text-white" suppressHydrationWarning>
        <div className="p-5 border-b border-slate-700" suppressHydrationWarning>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🐔</span>
            <span>دجاجتي</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">إدارة مزرعة الدواجن</p>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto" suppressHydrationWarning>
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
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500" suppressHydrationWarning>
          الإصدار 1.0.0
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" suppressHydrationWarning>
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute right-0 top-0 bottom-0 w-72 bg-slate-800 text-white shadow-2xl" suppressHydrationWarning>
            <div className="p-5 border-b border-slate-700 flex items-center justify-between" suppressHydrationWarning>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">🐔</span>
                <span>دجاجتي</span>
              </h1>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="py-4" suppressHydrationWarning>
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
      <div className="flex-1 flex flex-col overflow-hidden" suppressHydrationWarning>
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between no-print" suppressHydrationWarning>
          <div className="flex items-center gap-3" suppressHydrationWarning>
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
          <div className="relative flex items-center gap-2" ref={alertMenuRef} suppressHydrationWarning>
            <button
              type="button"
              onClick={() => setAlertsOpen(o => !o)}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition"
              title="التنبيهات والتذكيرات الذكية"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {visibleAlerts.length > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {visibleAlerts.length}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute left-0 top-12 z-50 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">التنبيهات الذكية للمزرعة</h4>
                    <p className="text-[11px] text-slate-500">{visibleAlerts.length} تنبيه نشط</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dismissedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={clearDismissed}
                        className="text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        إظهار المخفية
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={refreshAlerts}
                      disabled={loadingAlerts}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition"
                      title="تحديث التنبيهات"
                    >
                      <RefreshCw className={cn('w-4 h-4', loadingAlerts && 'animate-spin')} />
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                  {visibleAlerts.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      لا توجد تنبيهات عاجلة حالياً — كل الأمور على ما يرام!
                    </div>
                  ) : (
                    visibleAlerts.map(alert => {
                      const style =
                        alert.type === 'danger'
                          ? 'bg-red-50/60 text-red-700'
                          : alert.type === 'warning'
                          ? 'bg-amber-50/60 text-amber-700'
                          : alert.type === 'success'
                          ? 'bg-emerald-50/60 text-emerald-700'
                          : 'bg-blue-50/40 text-blue-700';
                      return (
                        <div key={alert.id} className={cn('p-3.5 transition hover:bg-slate-50', style)}>
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={alert.href}
                              onClick={() => setAlertsOpen(false)}
                              className="flex-1 flex items-start gap-2.5"
                            >
                              {alert.type === 'danger' || alert.type === 'warning' ? (
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              ) : alert.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                              ) : (
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className="text-xs font-bold text-slate-800">{alert.title}</p>
                                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{alert.message}</p>
                              </div>
                            </Link>
                            <button
                              type="button"
                              onClick={() => dismissAlert(alert.id)}
                              className="text-[11px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded"
                              title="إخفاء التنبيه"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6" suppressHydrationWarning>
          {children}
        </main>
      </div>
    </div>
  );
}
