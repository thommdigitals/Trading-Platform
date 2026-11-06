'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './button';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Terjadi kesalahan aplikasi',
    };
  }

  override componentDidCatch(error: unknown) {
    console.error('Uncaught UI error:', error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Terjadi Kendala Tampilan</h2>
        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
          {this.state.errorMessage || 'Komponen mengalami kendala saat memuat data.'}
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={this.handleReset} variant="default" size="sm">
            <RotateCcw className="h-3.5 w-3.5" />
            Muat Ulang Komponen
          </Button>
        </div>
      </div>
    );
  }
}

