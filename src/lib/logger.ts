// ============================================================
// مسجل أخطاء النظام التلقائي (يرسل للسيرفر مع نسخة احتياطية محلية)
// ============================================================

import type { SystemLog, SystemLogLevel } from './types';

const LOCAL_LOGS_KEY = 'farm_local_system_logs';
const recentMessages = new Map<string, number>();

export async function logSystemEvent(params: {
  level?: SystemLogLevel;
  source: SystemLog['source'];
  page?: string;
  message: string;
  details?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const key = `${params.source}:${params.message}`;
  const now = Date.now();
  const last = recentMessages.get(key);
  // منع تكرار نفس الخطأ خلال 5 ثوانٍ
  if (last && now - last < 5000) return;
  recentMessages.set(key, now);

  const entry: SystemLog = {
    timestamp: new Date().toISOString(),
    level: params.level || 'error',
    source: params.source,
    page: params.page || window.location.pathname,
    message: String(params.message || 'خطأ غير معروف').slice(0, 500),
    details: params.details ? String(params.details).slice(0, 3000) : undefined,
    resolved: false,
  };

  try {
    const res = await fetch('/api/db?resource=systemLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to save log to DB');
  } catch {
    // حفظ محلياً إذا تعذر الاتصال بالسيرفر
    try {
      const existing: SystemLog[] = JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || '[]');
      existing.unshift({ ...entry, id: -Date.now() });
      localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(existing.slice(0, 100)));
    } catch {}
  }
}

export function getLocalFallbackLogs(): SystemLog[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearLocalFallbackLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_LOGS_KEY);
  } catch {}
}
