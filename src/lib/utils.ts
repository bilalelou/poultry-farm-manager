// ============================================================
// دوال مساعدة عامة
// ============================================================

import type { FeedPhase } from './types';

/**
 * تنسيق العملة
 */
export function formatCurrency(amount: number | null | undefined, symbol: string = 'د.م'): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `${val.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

/**
 * تنسيق النسبة المئوية
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

/**
 * تنسيق الأرقام
 */
export function formatNumber(value: number | null | undefined): string {
  const val = typeof value === 'number' && !isNaN(value) ? value : 0;
  return val.toLocaleString('ar-MA');
}

/**
 * تنسيق التاريخ بالعربية
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-MA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * تنسيق التاريخ القصير
 */
export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * حساب عدد الأيام بين تاريخين
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * إضافة أيام لتاريخ
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * إضافة أسابيع لتاريخ
 */
export function addWeeks(dateStr: string, weeks: number): string {
  return addDays(dateStr, weeks * 7);
}

/**
 * تحديد المرحلة الغذائية حسب رقم الأسبوع
 */
export function getFeedPhase(weekNumber: number): FeedPhase {
  if (weekNumber <= 6) return 'starter';
  if (weekNumber <= 18) return 'grower';
  return 'preLayer';
}

/**
 * اسم المرحلة الغذائية بالعربية
 */
export function getFeedPhaseName(phase: FeedPhase): string {
  switch (phase) {
    case 'starter': return 'بادي';
    case 'grower': return 'نامي';
    case 'preLayer': return 'ما قبل البيض';
  }
}

/**
 * حساب يوم الفقاسة الحالي
 */
export function getIncubatorDay(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1); // اليوم 1 هو يوم البداية
}

/**
 * تحديد مرحلة الفقاسة
 */
export function getIncubatorPhase(day: number): 'phase1' | 'phase2' | 'hatched' {
  if (day <= 18) return 'phase1';
  if (day <= 21) return 'phase2';
  return 'hatched';
}

/**
 * حالة اللون حسب النسبة والهدف
 */
export function getStatusColor(actual: number, target: number, isLowerBetter: boolean = false): 'green' | 'yellow' | 'red' {
  const ratio = isLowerBetter ? target / Math.max(actual, 0.01) : actual / target;
  if (ratio >= 0.95) return 'green';
  if (ratio >= 0.80) return 'yellow';
  return 'red';
}

/**
 * إنشاء رمز دفعة فريد
 */
export function generateBatchCode(prefix: string = 'B'): string {
  if (typeof window === 'undefined') return `${prefix}000000-00`;
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${prefix}${year}${month}${day}-${random}`;
}

/**
 * تاريخ اليوم بصيغة ISO
 */
export function todayISO(): string {
  if (typeof window === 'undefined') return '2026-01-01';
  return new Date().toISOString().split('T')[0];
}

/**
 * حساب أسبوع التربية الحالي
 */
export function getRearingWeek(startDate: string): number {
  const days = daysBetween(startDate, todayISO());
  return Math.min(Math.ceil(days / 7), 20);
}

/**
 * تلوين المؤشرات
 */
export const STATUS_COLORS = {
  green: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', bar: 'bg-emerald-500' },
  yellow: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', bar: 'bg-amber-500' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', bar: 'bg-red-500' },
};

/**
 * أسماء الأشهر بالعربية
 */
export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
];

/**
 * الحصول على شهر من تاريخ ISO بصيغة YYYY-MM
 */
export function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

/**
 * cn - دالة لدمج أسماء الأصناف
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
