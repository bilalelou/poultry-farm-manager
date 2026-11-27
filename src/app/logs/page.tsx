'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db } from '@/lib/db';
import type { SystemLog, SystemLogLevel } from '@/lib/types';
import { getLocalFallbackLogs, clearLocalFallbackLogs } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  Terminal, RefreshCw, Trash2, CheckCircle2, Copy, Check,
  AlertTriangle, Info, Search, ChevronDown, ChevronUp
} from 'lucide-react';

const LEVEL_LABELS: Record<SystemLogLevel, string> = {
  error: 'خطأ',
  warn: 'تحذير',
  info: 'معلومة',
};

const SOURCE_LABELS: Record<string, string> = {
  api: 'الخادم (API)',
  client: 'المتصفح (JS)',
  ui: 'واجهة (React)',
  db: 'قاعدة البيانات',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'all' | SystemLogLevel>('all');
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const serverLogs = await db.systemLogs.toArray();
      const localLogs = getLocalFallbackLogs();
      setLogs([...localLogs, ...serverLogs]);
    } catch {
      setLogs(getLocalFallbackLogs());
    } finally {
      setLoading(false);
    }
  }

  async function toggleResolved(log: SystemLog) {
    if (!log.id || log.id < 0) return;
    await db.systemLogs.update(log.id, { resolved: !log.resolved });
    loadLogs();
  }

  async function deleteLog(id?: number) {
    if (!id || id < 0) return;
    await db.systemLogs.delete(id);
    loadLogs();
  }

  async function clearAllLogs() {
    await db.systemLogs.clear();
    clearLocalFallbackLogs();
    setShowClearConfirm(false);
    loadLogs();
  }

  function copyLog(log: SystemLog) {
    const text = `[${log.level.toUpperCase()}] ${log.timestamp}\nSource: ${log.source} | Page: ${log.page || '-'}\nMessage: ${log.message}\n${log.details ? `Details:\n${log.details}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id || 0);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const stats = useMemo(() => {
    const errors = logs.filter(l => l.level === 'error').length;
    const unresolvedErrors = logs.filter(l => l.level === 'error' && !l.resolved).length;
    const warns = logs.filter(l => l.level === 'warn').length;
    const infos = logs.filter(l => l.level === 'info').length;
    return { total: logs.length, errors, unresolvedErrors, warns, infos };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (filterLevel !== 'all' && l.level !== filterLevel) return false;
      if (onlyUnresolved && l.resolved) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          l.message.toLowerCase().includes(q) ||
          (l.page || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [logs, filterLevel, onlyUnresolved, searchQuery]);

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Terminal className="w-7 h-7 text-slate-700" />
            <span>سجل الأخطاء والنظام (Logs)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            يظهر هنا أي خطأ يحدث في الواجهة أو السيرفر تلقائياً لتسهيل المتابعة والإصلاح دون فتح الكود
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          {logs.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition"
            >
              <Trash2 className="w-4 h-4" />
              مسح السجل
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs font-bold text-slate-500 mb-1">إجمالي السجلات</p>
          <p className="text-2xl font-black text-slate-800">{stats.total}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-50 to-white border-red-200">
          <p className="text-xs font-bold text-red-700 mb-1">أخطاء غير محلولة</p>
          <p className="text-2xl font-black text-red-900">{stats.unresolvedErrors}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <p className="text-xs font-bold text-amber-700 mb-1">تحذيرات</p>
          <p className="text-2xl font-black text-amber-900">{stats.warns}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <p className="text-xs font-bold text-blue-700 mb-1">معلومات</p>
          <p className="text-2xl font-black text-blue-900">{stats.infos}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث في الرسائل أو الصفحة..."
            className="w-full pr-9 pl-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          />
        </div>
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value as 'all' | SystemLogLevel)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="all">كل المستويات</option>
          <option value="error">أخطاء فقط</option>
          <option value="warn">تحذيرات فقط</option>
          <option value="info">معلومات فقط</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyUnresolved}
            onChange={e => setOnlyUnresolved(e.target.checked)}
            className="rounded"
          />
          <span>غير المحلولة فقط</span>
        </label>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">لا توجد أخطاء مسجلة!</h3>
          <p className="text-sm text-slate-500">التطبيق يعمل بشكل سليم بدون أي مشاكل مسجلة.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log, idx) => {
            const keyId = log.id ?? idx;
            const isExpanded = expandedId === keyId;
            return (
              <Card
                key={keyId}
                className={cn(
                  'p-4 transition',
                  log.resolved ? 'opacity-60 bg-slate-50' : log.level === 'error' ? 'border-red-200' : ''
                )}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {log.level === 'error' ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : log.level === 'warn' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Info className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge color={log.level === 'error' ? 'red' : log.level === 'warn' ? 'amber' : 'blue'}>
                          {LEVEL_LABELS[log.level] || log.level}
                        </Badge>
                        <Badge color="slate">{SOURCE_LABELS[log.source] || log.source}</Badge>
                        {log.page && (
                          <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded" dir="ltr">
                            {log.page}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400" dir="ltr">
                          {new Date(log.timestamp).toLocaleString('ar-MA')}
                        </span>
                        {log.resolved && <Badge color="green">تم الحل ✓</Badge>}
                      </div>
                      <p className="text-sm font-bold text-slate-800 break-words">{log.message}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {log.details && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : keyId)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        التفاصيل
                      </button>
                    )}
                    <button
                      onClick={() => copyLog(log)}
                      title="نسخ الخطأ"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      {copiedId === keyId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === keyId ? 'تم النسخ' : 'نسخ'}
                    </button>
                    {log.id && log.id > 0 && (
                      <>
                        <button
                          onClick={() => toggleResolved(log)}
                          title={log.resolved ? 'إعادة فتح' : 'تحديد كمحلول'}
                          className={cn(
                            'p-1.5 rounded-lg transition',
                            log.resolved
                              ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          )}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteLog(log.id)}
                          title="حذف السجل"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && log.details && (
                  <pre
                    dir="ltr"
                    className="mt-3 p-3 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-x-auto max-h-64 whitespace-pre-wrap"
                  >
                    {log.details}
                  </pre>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearAllLogs}
        title="مسح سجل الأخطاء"
        message="هل أنت متأكد من مسح جميع سجلات الأخطاء الحالية؟"
        confirmLabel="مسح الكل"
        confirmColor="red"
      />
    </AppShell>
  );
}
