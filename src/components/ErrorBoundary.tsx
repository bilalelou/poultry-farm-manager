'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';
import { logSystemEvent } from '@/lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'حدث خطأ غير متوقع في واجهة الصفحة',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logSystemEvent({
      level: 'error',
      source: 'ui',
      message: error?.message || 'React Render Error',
      details: `${error?.stack || ''}\n--- Component Stack ---\n${info?.componentStack || ''}`,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-2xl border border-red-200 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">حدث خطأ غير متوقع في هذه الصفحة</h2>
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl mb-4 font-mono break-words" dir="ltr">
            {this.state.errorMessage}
          </p>
          <p className="text-xs text-slate-500 mb-5">
            تم تسجيل هذا الخطأ تلقائياً في سجل الأخطاء (Logs) لتسهيل متابعته وإصلاحه.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </button>
            <Link
              href="/logs"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition"
            >
              <Terminal className="w-4 h-4" />
              عرض سجل الأخطاء (Logs)
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
