import * as React from 'react';
import { cn } from '@/utils/cn';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  secondary: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  outline: 'bg-transparent text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-tight',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

