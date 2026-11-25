'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// === Modal ===
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full modal-content max-h-[90vh] flex flex-col', widths[size])}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// === Card ===
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// === KPI Card ===
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}

const KPI_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
};

export function KPICard({ title, value, subtitle, icon, trend, color = 'blue' }: KPICardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs mt-1 font-medium', trend.value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', KPI_COLORS[color])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// === Progress Bar ===
interface ProgressBarProps {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color?: 'green' | 'yellow' | 'red';
  isLowerBetter?: boolean;
}

  export function ProgressBar({ label, value, target, unit = '%', color, isLowerBetter = false }: ProgressBarProps) {
    const percent = target > 0 ? Math.min((value / target) * 100, 100) : 0;
    const autoColor =
      color ||
      (isLowerBetter
        ? value <= target
          ? 'green'
          : value <= target * 1.5
            ? 'yellow'
            : 'red'
        : percent >= 95
          ? 'green'
          : percent >= 80
            ? 'yellow'
            : 'red');
    const barColors = {
      green: 'bg-emerald-500',
      yellow: 'bg-amber-500',
      red: 'bg-red-500',
    };
    const dotColors = {
      green: 'bg-emerald-400',
      yellow: 'bg-amber-400',
      red: 'bg-red-400',
    };

    return (
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full', dotColors[autoColor])} />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </div>
          <span className="text-sm font-bold text-slate-800">
            {value.toFixed(1)}{unit} / {target}{unit}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className={cn('h-2.5 rounded-full transition-all duration-500', barColors[autoColor])}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  // === Badge ===
  interface BadgeProps {
    children: React.ReactNode;
    color?: 'blue' | 'green' | 'red' | 'amber' | 'slate' | 'purple';
  }

  const BADGE_COLORS = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  export function Badge({ children, color = 'blue' }: BadgeProps) {
    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', BADGE_COLORS[color])}>
        {children}
      </span>
    );
  }

  // === Empty State ===
  interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  }

  export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-300 flex justify-center mb-4">{icon}</div>
        <h3 className="text-lg font-bold text-slate-600 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-4 max-w-md mx-auto">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  // === Loading Spinner ===
  export function LoadingSpinner() {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // === Confirm Dialog ===
  interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmColor?: 'blue' | 'red';
  }

  export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'تأكيد', confirmColor = 'blue' }: ConfirmDialogProps) {
    if (!isOpen) return null;
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50">
            إلغاء
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={cn(
              'px-4 py-2 rounded-xl text-white font-medium',
              confirmColor === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </Modal>
    );
  }
